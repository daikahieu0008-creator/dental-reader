import type { SiteCategory, SitePost } from "./types"
import { normalizeUrl } from "./wordpress"

export async function detectRss(baseUrl: string): Promise<string | null> {
  const normalized = normalizeUrl(baseUrl)
  const candidatePaths = ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml"]

  for (const path of candidatePaths) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${normalized}${path}`, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml" },
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.ok) {
        const text = await res.text()
        if (text.includes("<rss") || text.includes("<feed") || text.includes("<channel")) {
          return `${normalized}${path}`
        }
      }
    } catch {
      // try next
    }
  }

  return null
}

export function parseRssFeed(
  siteId: string,
  xmlText: string,
): { title: string; description: string; categories: SiteCategory[]; posts: SitePost[] } {
  const titleMatch = xmlText.match(/<title>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/title>/i)
  const descMatch = xmlText.match(/<description>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/description>/i)

  const siteTitle = (titleMatch ? titleMatch[1] || titleMatch[2] : siteId).trim()
  const siteDesc = (descMatch ? descMatch[1] || descMatch[2] : "").trim()

  const itemRegex = /<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi
  const items = xmlText.match(itemRegex) || []

  const categoriesMap = new Map<string, number>()
  const posts: SitePost[] = []

  items.forEach((itemXml, index) => {
    const itemTitleMatch = itemXml.match(/<title>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/title>/i)
    const itemLinkMatch = itemXml.match(/<link>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/link>|<link[^>]*href=["'](.*?)["']/i)
    const itemDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>|<updated>(.*?)<\/updated>|<dc:date>(.*?)<\/dc:date>/i)
    const itemDescMatch = itemXml.match(/<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>|<summary(?:[^>]*)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/summary>/i)
    const itemContentMatch = itemXml.match(/<content:encoded>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/content:encoded>|<content(?:[^>]*)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/content>/i)
    const catMatch = itemXml.match(/<category(?:[^>]*)>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/category>/i)
    const mediaMatch = itemXml.match(/<media:content[^>]*url=["'](.*?)["']|<enclosure[^>]*url=["'](.*?)["'][^>]*type=["']image|<img[^>]*src=["'](.*?)["']/i)

    const title = (itemTitleMatch ? itemTitleMatch[1] || itemTitleMatch[2] : `Bài viết ${index + 1}`).trim()
    const link = (itemLinkMatch ? itemLinkMatch[1] || itemLinkMatch[2] || itemLinkMatch[3] : "").trim()
    const date = (itemDateMatch ? itemDateMatch[1] || itemDateMatch[2] || itemDateMatch[3] : new Date().toISOString()).trim()
    const rawExcerpt = (itemDescMatch ? itemDescMatch[1] || itemDescMatch[2] || itemDescMatch[3] || itemDescMatch[4] : "").trim()
    const rawContent = (itemContentMatch ? itemContentMatch[1] || itemContentMatch[2] || itemContentMatch[3] || itemContentMatch[4] : rawExcerpt).trim()
    const categoryName = (catMatch ? catMatch[1] || catMatch[2] : "Chung").trim() || "Chung"
    const featuredMedia = (mediaMatch ? mediaMatch[1] || mediaMatch[2] || mediaMatch[3] || mediaMatch[4] : "").trim()

    categoriesMap.set(categoryName, (categoriesMap.get(categoryName) || 0) + 1)

    posts.push({
      id: link || `${siteId}-post-${index}`,
      siteId,
      categoryName,
      title,
      link,
      date,
      excerpt: rawExcerpt.replace(/<[^>]+>/g, "").slice(0, 200),
      content: rawContent || rawExcerpt,
      featuredMedia,
    })
  })

  const categories: SiteCategory[] = Array.from(categoriesMap.entries()).map(([name, count], idx) => ({
    id: `rss-cat-${idx}`,
    siteId,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    count,
  }))

  posts.forEach((p) => {
    const matched = categories.find((c) => c.name === p.categoryName)
    if (matched) {
      p.categoryId = matched.id
    }
  })

  return {
    title: siteTitle,
    description: siteDesc,
    categories,
    posts,
  }
}
