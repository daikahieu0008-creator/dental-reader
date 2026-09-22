/**
 * RSS-Style Category Downloader for DentalAI Reader
 * 
 * Implements:
 * - 10 initial posts loading
 * - Local-first offline persistence (never re-fetch existing from network)
 * - Delta checking (page 1 check for new incoming posts)
 * - Batch fetch (+10, +50, all) with 200ms staggered throttle between requests
 * - Category completion & page offset tracking
 */

import {
  getCategoryState,
  getPostsByCategory,
  savePosts,
  updateCategoryState,
} from "../../storage/database.ts"
import { cacheThumbnailOffline, saveArticleHtml } from "../../storage/file-storage.ts"
import type { SitePost } from "./types.ts"
import { fetchWordPressPostsByCategory } from "./wordpress.ts"

export interface DownloadProgress {
  currentLoaded: number
  totalInBatch: number
  isComplete: boolean
  statusText: string
}

const THROTTLE_DELAY_MS = 200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Loads category posts initially:
 * 1. Returns local cached posts if available.
 * 2. If cached, asynchronously checks page 1 for delta/new posts.
 * 3. If not cached, fetches first 10 posts and persists them.
 */
export async function loadCategoryPostsInitial({
  siteUrl,
  siteId,
  categoryId,
  onDeltaUpdated,
}: {
  siteUrl: string
  siteId: string
  categoryId: string
  onDeltaUpdated?: (posts: SitePost[]) => void
}): Promise<SitePost[]> {
  const localPosts = await getPostsByCategory(siteId, categoryId)

  if (localPosts.length > 0) {
    // Background delta check on page 1 for any new articles published recently
    checkForNewPosts({ siteUrl, siteId, categoryId, existingPosts: localPosts })
      .then((newItems) => {
        if (newItems.length > 0 && onDeltaUpdated) {
          onDeltaUpdated([...newItems, ...localPosts])
        }
      })
      .catch(() => {})

    return localPosts
  }

  // Not cached yet: fetch first 10 posts from WordPress REST API
  const result = await fetchWordPressPostsByCategory(
    siteId,
    siteUrl,
    categoryId,
    undefined,
    1,
    10,
  )
  const firstPage = result.posts

  // Save HTML bodies to disk and cache thumbnails locally
  for (const post of firstPage) {
    if (post.content) {
      const path = await saveArticleHtml(post.id, post.content)
      ;(post as any).htmlPath = path
      post.isDownloaded = true
    }
    const rawThumb = post.thumbnail || post.featuredMedia
    if (rawThumb && rawThumb.startsWith("http")) {
      try {
        const localThumb = await cacheThumbnailOffline(rawThumb, post.id)
        post.thumbnail = localThumb
        post.featuredMedia = localThumb
      } catch {}
    }
  }

  await savePosts(firstPage)
  await updateCategoryState(siteId, categoryId, 1, firstPage.length < 10)

  return firstPage
}

/**
 * Checks page 1 to detect any new articles published since last visit
 */
async function checkForNewPosts({
  siteUrl,
  siteId,
  categoryId,
  existingPosts,
}: {
  siteUrl: string
  siteId: string
  categoryId: string
  existingPosts: SitePost[]
}): Promise<SitePost[]> {
  try {
    const res = await fetchWordPressPostsByCategory(
      siteId,
      siteUrl,
      categoryId,
      undefined,
      1,
      10,
    )
    const page1 = res.posts

    const existingIds = new Set(existingPosts.map((p) => p.id))
    const trulyNewPosts = page1.filter((p) => !existingIds.has(p.id))

    if (trulyNewPosts.length > 0) {
      for (const p of trulyNewPosts) {
        if (p.content) {
          const path = await saveArticleHtml(p.id, p.content)
          ;(p as any).htmlPath = path
          p.isDownloaded = true
        }
      }
      await savePosts(trulyNewPosts)
    }

    return trulyNewPosts
  } catch {
    return []
  }
}

/**
 * Batch downloads additional posts (+10, +50, or all)
 * Staggers network requests by 200ms to be polite to the host website.
 */
export async function batchDownloadCategoryPosts({
  siteUrl,
  siteId,
  categoryId,
  batchSize, // 10, 50, or Infinity (all)
  onProgress,
}: {
  siteUrl: string
  siteId: string
  categoryId: string
  batchSize: number
  onProgress?: (progress: DownloadProgress) => void
}): Promise<SitePost[]> {
  const state = await getCategoryState(siteId, categoryId)
  let currentPage = state.pageOffset
  let isCategoryDone = state.isCompleted
  let fetchedInBatch = 0
  const newlyFetched: SitePost[] = []

  const perPage = 10
  const maxPagesToFetch =
    batchSize === Infinity ? 999 : Math.ceil(batchSize / perPage)

  for (let step = 0; step < maxPagesToFetch; step++) {
    if (isCategoryDone) break

    currentPage++

    // Throttle delay to avoid bursting the source site
    if (step > 0) {
      await sleep(THROTTLE_DELAY_MS)
    }

    if (onProgress) {
      onProgress({
        currentLoaded: fetchedInBatch,
        totalInBatch: batchSize === Infinity ? 600 : batchSize,
        isComplete: false,
        statusText: `Đang tải trang ${currentPage}...`,
      })
    }

    try {
      const res = await fetchWordPressPostsByCategory(
        siteId,
        siteUrl,
        categoryId,
        undefined,
        currentPage,
        perPage,
      )
      const posts = res.posts

      if (!posts || posts.length === 0) {
        isCategoryDone = true
        break
      }

      for (const p of posts) {
        if (p.content) {
          const path = await saveArticleHtml(p.id, p.content)
          ;(p as any).htmlPath = path
          p.isDownloaded = true
        }
        const rawThumb = p.thumbnail || p.featuredMedia
        if (rawThumb && rawThumb.startsWith("http")) {
          try {
            const localThumb = await cacheThumbnailOffline(rawThumb, p.id)
            p.thumbnail = localThumb
            p.featuredMedia = localThumb
          } catch {}
        }
        newlyFetched.push(p)
      }

      fetchedInBatch += posts.length
      await savePosts(posts)

      if (posts.length < perPage) {
        isCategoryDone = true
        break
      }
    } catch (err: any) {
      // If 400 Bad Request on out-of-range page
      isCategoryDone = true
      break
    }
  }

  await updateCategoryState(siteId, categoryId, currentPage, isCategoryDone)

  if (onProgress) {
    onProgress({
      currentLoaded: fetchedInBatch,
      totalInBatch: fetchedInBatch,
      isComplete: true,
      statusText: isCategoryDone ? "Đã tải toàn bộ chuyên mục!" : "Tải hoàn tất!",
    })
  }

  return newlyFetched
}
