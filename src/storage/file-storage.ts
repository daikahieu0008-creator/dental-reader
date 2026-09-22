/**
 * File Storage Manager for DentalAI Reader
 * Saves raw HTML articles directly to disk (expo-file-system)
 * to avoid blowing up SQLite or AsyncStorage memory limits.
 */

let memoryHtmlCache = new Map<string, string>()

export async function saveArticleHtml(
  postId: string | number,
  htmlContent: string,
): Promise<string> {
  const safeId = String(postId).replace(/[^a-zA-Z0-9_-]/g, "_")
  const fileName = `article_${safeId}.html`

  try {
    const FileSystem = await import("expo-file-system")
    const dirUri = `${FileSystem.documentDirectory}articles/`

    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(dirUri)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true })
    }

    const fileUri = `${dirUri}${fileName}`
    await FileSystem.writeAsStringAsync(fileUri, htmlContent, {
      encoding: FileSystem.EncodingType.UTF8,
    })
    return fileUri
  } catch {
    // Fallback in test/node environments
    memoryHtmlCache.set(String(postId), htmlContent)
    return `memory://${postId}`
  }
}

export async function readArticleHtml(filePathOrUri: string): Promise<string> {
  if (!filePathOrUri) return ""

  if (filePathOrUri.startsWith("memory://")) {
    const id = filePathOrUri.replace("memory://", "")
    return memoryHtmlCache.get(id) || ""
  }

  try {
    const FileSystem = await import("expo-file-system")
    return await FileSystem.readAsStringAsync(filePathOrUri, {
      encoding: FileSystem.EncodingType.UTF8,
    })
  } catch {
    return memoryHtmlCache.get(filePathOrUri) || ""
  }
}

export async function cacheThumbnailOffline(
  imageUrl: string,
  postId: string | number,
): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith("http")) return imageUrl

  const safeId = String(postId).replace(/[^a-zA-Z0-9_-]/g, "_")
  const ext = imageUrl.split(".").pop()?.split("?")[0] || "jpg"
  const fileName = `thumb_${safeId}.${ext}`

  try {
    const FileSystem = await import("expo-file-system")
    const dirUri = `${FileSystem.documentDirectory}thumbnails/`

    const dirInfo = await FileSystem.getInfoAsync(dirUri)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true })
    }

    const fileUri = `${dirUri}${fileName}`
    const fileInfo = await FileSystem.getInfoAsync(fileUri)
    if (fileInfo.exists) {
      return fileUri
    }

    const downloadRes = await FileSystem.downloadAsync(imageUrl, fileUri)
    return downloadRes.uri
  } catch {
    return imageUrl
  }
}

