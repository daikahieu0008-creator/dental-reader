/**
 * High-Performance Image Cache Service for DentalAI Reader
 * - Scans and maintains an in-memory Set of existing local thumbnail files
 * - Provides synchronous 0ms local path resolution for instant (Frame 0) rendering
 * - Downloads and permanently persists thumbnails into FileSystem.documentDirectory
 * - Shares caching between website favicons and category post thumbnails
 */

import * as FileSystem from "expo-file-system"

// In-memory set of file names that physically exist on disk (e.g. 'thumb_12345.jpg')
const knownCachedFiles = new Set<string>()

// Fast lookup map: remoteUrl -> localFileUri
const urlToLocalMap = new Map<string, string>()

// In-flight download promises to avoid duplicate simultaneous downloads
const downloadInFlight = new Map<string, Promise<string>>()

let isIndexInitialized = false

const getBaseDir = (): string => {
  return FileSystem.documentDirectory || FileSystem.cacheDirectory || ""
}

export const getThumbnailsDir = (): string => {
  const base = getBaseDir()
  return base.endsWith("/") ? `${base}thumbnails/` : `${base}/thumbnails/`
}

export function hashUrl(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i)
    hash |= 0
  }
  return String(Math.abs(hash))
}

export function getCleanExtension(url: string): string {
  try {
    const clean = url.split("?")[0].split("#")[0]
    const ext = clean.split(".").pop()?.toLowerCase() || "jpg"
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      return ext
    }
  } catch {}
  return "jpg"
}

export function getCacheFileName(url: string): string {
  return `thumb_${hashUrl(url)}.${getCleanExtension(url)}`
}

/**
 * Initializes the disk index by scanning the thumbnails folder once.
 * Runs in a few milliseconds and allows synchronous 0ms cache hits.
 */
export async function initThumbnailCacheIndex(): Promise<void> {
  if (isIndexInitialized) return
  try {
    const dir = getThumbnailsDir()
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
      isIndexInitialized = true
      return
    }
    const files = await FileSystem.readDirectoryAsync(dir)
    for (const f of files) {
      knownCachedFiles.add(f)
    }
    isIndexInitialized = true
  } catch (err) {
    console.warn("initThumbnailCacheIndex error:", err)
  }
}

// Kick off index scan immediately upon module load
initThumbnailCacheIndex().catch(() => {})

/**
 * Synchronously checks if a remote URL is already downloaded to local disk.
 * Returns local file URI if cached, or null if not yet downloaded.
 * This ensures Frame 0 instant display with 0ms delay!
 */
export function getLocalCachedUri(remoteUrl?: string | null): string | null {
  if (!remoteUrl) return null
  if (remoteUrl.startsWith("file://") || remoteUrl.startsWith("/")) return remoteUrl
  if (!remoteUrl.startsWith("http")) return remoteUrl

  if (urlToLocalMap.has(remoteUrl)) {
    return urlToLocalMap.get(remoteUrl)!
  }

  const fileName = getCacheFileName(remoteUrl)
  if (knownCachedFiles.has(fileName)) {
    const fullUri = `${getThumbnailsDir()}${fileName}`
    urlToLocalMap.set(remoteUrl, fullUri)
    return fullUri
  }

  return null
}

/**
 * Downloads a remote image and permanently saves it to the local thumbnails directory.
 * If already cached, returns the local URI immediately.
 */
export async function getOrDownloadLocalImage(
  remoteUrl?: string | null,
): Promise<string | null> {
  if (!remoteUrl) return null
  if (remoteUrl.startsWith("file://") || remoteUrl.startsWith("/")) return remoteUrl
  if (!remoteUrl.startsWith("http")) return remoteUrl

  // 1. Instant return if already in index
  const cached = getLocalCachedUri(remoteUrl)
  if (cached) return cached

  const fileName = getCacheFileName(remoteUrl)
  const dir = getThumbnailsDir()
  const localUri = `${dir}${fileName}`

  // 2. Check if file physically exists on disk
  try {
    const info = await FileSystem.getInfoAsync(localUri)
    if (info.exists && info.size && info.size > 0) {
      knownCachedFiles.add(fileName)
      urlToLocalMap.set(remoteUrl, localUri)
      return localUri
    }
  } catch {}

  // 3. Reuse active download if one is already in flight
  if (downloadInFlight.has(remoteUrl)) {
    try {
      return await downloadInFlight.get(remoteUrl)!
    } catch {
      return remoteUrl
    }
  }

  // 4. Download and persist
  const downloadPromise = (async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(dir)
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
      }

      const res = await FileSystem.downloadAsync(remoteUrl, localUri)
      if (res.status === 200) {
        knownCachedFiles.add(fileName)
        urlToLocalMap.set(remoteUrl, res.uri)
        return res.uri
      }
      return remoteUrl
    } catch (err) {
      return remoteUrl
    } finally {
      downloadInFlight.delete(remoteUrl)
    }
  })()

  downloadInFlight.set(remoteUrl, downloadPromise)
  return downloadPromise
}
