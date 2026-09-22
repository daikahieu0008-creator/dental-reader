import React, { useEffect, useState } from "react"
import { Image, type ImageProps, StyleSheet, View } from "react-native"
import * as FileSystem from "expo-file-system"

// In-memory lookup map of verified local file paths: remoteUrl -> localFilePath
const localPathMemoryCache = new Map<string, string>()

// In-flight download promises to avoid duplicate simultaneous downloads
const downloadInFlight = new Map<string, Promise<string>>()

/**
 * Generates a stable and safe local file path for caching images
 */
function getCachePath(remoteUrl: string): string {
  let hash = 0
  for (let i = 0; i < remoteUrl.length; i++) {
    hash = ((hash << 5) - hash) + remoteUrl.charCodeAt(i)
    hash |= 0
  }
  const cleanExt = remoteUrl.split(".").pop()?.split("?")[0]?.slice(0, 4) || "jpg"
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || ""
  return `${baseDir}thumbnails/thumb_${Math.abs(hash)}.${cleanExt}`
}

/**
 * Returns the local file URI if cached, or downloads it permanently to FileSystem.documentDirectory
 */
export async function getOrDownloadLocalImage(remoteUrl?: string | null): Promise<string | null> {
  if (!remoteUrl) return null

  // If already a local path
  if (remoteUrl.startsWith("file://") || remoteUrl.startsWith("/")) {
    return remoteUrl
  }

  // Not an HTTP url
  if (!remoteUrl.startsWith("http")) {
    return remoteUrl
  }

  // Check in-memory cache (0ms instant return)
  if (localPathMemoryCache.has(remoteUrl)) {
    return localPathMemoryCache.get(remoteUrl)!
  }

  const localUri = getCachePath(remoteUrl)

  // Check if file already exists permanently on disk
  try {
    const info = await FileSystem.getInfoAsync(localUri)
    if (info.exists && info.size && info.size > 0) {
      localPathMemoryCache.set(remoteUrl, localUri)
      return localUri
    }
  } catch {}

  // If download is already in progress for this URL, reuse promise
  if (downloadInFlight.has(remoteUrl)) {
    try {
      return await downloadInFlight.get(remoteUrl)!
    } catch {
      return remoteUrl
    }
  }

  // Start background download
  const downloadPromise = (async () => {
    try {
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || ""
      const dirUri = `${baseDir}thumbnails/`
      const dirInfo = await FileSystem.getInfoAsync(dirUri)
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true })
      }

      const res = await FileSystem.downloadAsync(remoteUrl, localUri)
      if (res.status === 200) {
        localPathMemoryCache.set(remoteUrl, res.uri)
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

interface CachedImageProps extends Omit<ImageProps, "source"> {
  uri?: string | null
  fallback?: React.ReactNode
}

export function CachedImage({
  uri,
  style,
  fallback,
  resizeMode = "cover",
  ...rest
}: CachedImageProps) {
  const [sourceUri, setSourceUri] = useState<string | null>(() => {
    if (!uri) return null
    if (uri.startsWith("file://") || uri.startsWith("/")) return uri
    return localPathMemoryCache.get(uri) || null
  })
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
    if (!uri) {
      setSourceUri(null)
      return
    }

    if (uri.startsWith("file://") || uri.startsWith("/")) {
      setSourceUri(uri)
      return
    }

    if (localPathMemoryCache.has(uri)) {
      setSourceUri(localPathMemoryCache.get(uri)!)
      return
    }

    let isMounted = true
    getOrDownloadLocalImage(uri).then((resolved) => {
      if (isMounted && resolved) {
        setSourceUri(resolved)
      }
    })

    return () => {
      isMounted = false
    }
  }, [uri])

  if (hasError || (!sourceUri && !uri)) {
    return fallback ? <>{fallback}</> : null
  }

  return (
    <Image
      source={{ uri: sourceUri || uri || undefined }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setHasError(true)}
      {...rest}
    />
  )
}
