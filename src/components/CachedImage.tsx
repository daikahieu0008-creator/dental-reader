import React, { useEffect, useState } from "react"
import { Image, type ImageProps } from "react-native"
import {
  getLocalCachedUri,
  getOrDownloadLocalImage,
  initThumbnailCacheIndex,
} from "../storage/image-cache"

export { getLocalCachedUri, getOrDownloadLocalImage, initThumbnailCacheIndex }

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
  // Synchronous cache hit on Frame 0: 0ms delay!
  const [sourceUri, setSourceUri] = useState<string | null>(() => getLocalCachedUri(uri))
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
    if (!uri) {
      setSourceUri(null)
      return
    }

    // Check synchronous cache first
    const instant = getLocalCachedUri(uri)
    if (instant) {
      setSourceUri(instant)
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
