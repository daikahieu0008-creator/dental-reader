import type { SiteCategory, SitePost } from "./types"

export function normalizeUrl(input: string): string {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }
  return url.replace(/\/+$/, "")
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return ""
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8230;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

export async function detectWordPress(baseUrl: string): Promise<boolean> {
  const normalized = normalizeUrl(baseUrl)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(`${normalized}/wp-json/wp/v2/categories?per_page=1`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

export async function fetchWordPressSiteInfo(
  baseUrl: string,
): Promise<{ name: string; description: string; favicon?: string }> {
  const normalized = normalizeUrl(baseUrl)
  const domain = new URL(normalized).hostname
  const googleFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  try {
    const res = await fetch(`${normalized}/wp-json`, {
      headers: { Accept: "application/json" },
    })
    if (res.ok) {
      const data = await res.json()
      let icon = data.site_icon_url
      if (!icon || icon.endsWith(".ico") || icon.includes("favicon.ico")) {
        icon = googleFavicon
      }
      return {
        name: decodeHtmlEntities(data.name || domain),
        description: decodeHtmlEntities(data.description || ""),
        favicon: icon,
      }
    }
  } catch {
    // fallback
  }

  return {
    name: domain,
    description: "",
    favicon: googleFavicon,
  }
}

export async function fetchWordPressCategories(
  siteId: string,
  baseUrl: string,
): Promise<SiteCategory[]> {
  const normalized = normalizeUrl(baseUrl)
  const categories: SiteCategory[] = []
  let page = 1
  let hasMore = true

  while (hasMore && page <= 5) {
    try {
      const res = await fetch(
        `${normalized}/wp-json/wp/v2/categories?per_page=100&page=${page}&hide_empty=true`,
        { headers: { Accept: "application/json" } },
      )
      if (!res.ok) break

      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) break

      for (const item of data) {
        categories.push({
          id: item.id,
          siteId,
          name: decodeHtmlEntities(item.name || ""),
          slug: item.slug || "",
          count: item.count || 0,
          description: decodeHtmlEntities(item.description || ""),
        })
      }

      const totalPages = Number(res.headers.get("X-WP-TotalPages") || "1")
      if (page >= totalPages) {
        hasMore = false
      } else {
        page++
      }
    } catch {
      break
    }
  }

  return categories
}

export async function fetchWordPressPostsByCategory(
  siteId: string,
  baseUrl: string,
  categoryId: string | number,
  categoryName?: string,
  page = 1,
  perPage = 100,
): Promise<{ posts: SitePost[]; hasMore: boolean; total: number }> {
  const normalized = normalizeUrl(baseUrl)
  const url = `${normalized}/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${perPage}&page=${page}&_embed=1`

  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} when fetching posts`)
  }

  const total = Number(res.headers.get("X-WP-Total") || "0")
  const totalPages = Number(res.headers.get("X-WP-TotalPages") || "1")
  const data = await res.json()

  const posts: SitePost[] = data.map((item: any) => {
    let featuredMediaUrl = ""
    try {
      const media = item._embedded?.["wp:featuredmedia"]?.[0]
      featuredMediaUrl =
        media?.source_url || media?.media_details?.sizes?.medium?.source_url || ""
    } catch {
      // ignore
    }

    return {
      id: item.id,
      siteId,
      categoryId,
      categoryName,
      title: decodeHtmlEntities(item.title?.rendered || ""),
      link: item.link || "",
      date: item.date || "",
      excerpt: decodeHtmlEntities(
        (item.excerpt?.rendered || "").replace(/<[^>]+>/g, "").trim(),
      ),
      content: item.content?.rendered || "",
      featuredMedia: featuredMediaUrl,
    }
  })

  return {
    posts,
    hasMore: page < totalPages,
    total,
  }
}

export async function fetchAllWordPressPostsForCategory(
  siteId: string,
  baseUrl: string,
  categoryId: string | number,
  categoryName?: string,
  onProgress?: (current: number, total: number) => void,
): Promise<SitePost[]> {
  const allPosts: SitePost[] = []
  let page = 1
  let hasMore = true
  let totalPosts = 0

  while (hasMore) {
    const result = await fetchWordPressPostsByCategory(
      siteId,
      baseUrl,
      categoryId,
      categoryName,
      page,
      100,
    )
    totalPosts = result.total || allPosts.length + result.posts.length
    allPosts.push(...result.posts)

    if (onProgress) {
      onProgress(allPosts.length, totalPosts)
    }

    if (!result.hasMore || result.posts.length === 0) {
      hasMore = false
    } else {
      page++
    }
  }

  return allPosts
}
