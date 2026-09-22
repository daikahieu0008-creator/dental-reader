export interface SiteMetadata {
  id: string
  name: string
  url: string
  description?: string
  favicon?: string
  type: "wordpress" | "rss"
  customPrompt?: string
  createdAt: number
  categoryCount?: number
  postCount?: number
  starredOrder?: number
}

export interface SiteCategory {
  id: string | number
  siteId: string
  name: string
  slug: string
  count: number
  description?: string
}

export interface SitePost {
  id: string | number
  siteId: string
  categoryId?: string | number
  categoryName?: string
  title: string
  slug?: string
  url?: string
  link?: string
  date?: string
  publishedAt?: string
  excerpt: string
  content: string
  author?: string
  thumbnail?: string
  featuredMedia?: string
  isDownloaded?: boolean
  isHidden?: boolean
  geminiSummary?: string
  modelUsed?: string
  summaryConsistent?: boolean
}

export interface SiteDetectionResult {
  success: boolean
  site?: SiteMetadata
  categories?: SiteCategory[]
  initialPosts?: SitePost[]
  error?: string
}
