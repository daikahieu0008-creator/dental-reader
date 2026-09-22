/**
 * SQLite Database Manager for DentalAI Reader
 * Uses expo-sqlite with FTS5 for instant local search and category pagination tracking.
 */

import type { SiteCategory, SiteMetadata, SitePost } from "../services/site-scraper/types.ts"

export interface TelegramBook {
  fileId: string
  title: string
  author: string
  sizeMb: number
  postDate: string
  messageId: number
  caption?: string
}

export interface CategoryPaginationState {
  siteId: string
  categoryId: string
  pageOffset: number
  isCompleted: boolean
  lastCheckedAt: number
}

// Fallback in-memory structures for Node.js / test environments
const memSites: SiteMetadata[] = []
const memCategories: Map<string, SiteCategory[]> = new Map()
const memCategoryStates: Map<string, CategoryPaginationState> = new Map()
const memPosts: Map<string, SitePost> = new Map()
const memTelegramBooks: TelegramBook[] = []

let sqliteDbInstance: any = null

export async function getDb(): Promise<any> {
  if (sqliteDbInstance) return sqliteDbInstance

  try {
    const SQLite = await import("expo-sqlite")
    sqliteDbInstance = await SQLite.openDatabaseAsync("dental_reader_v2.db")
    await initDatabase(sqliteDbInstance)
    return sqliteDbInstance
  } catch {
    return null
  }
}

export async function initDatabase(db?: any): Promise<void> {
  const activeDb = db || (await getDb())
  if (!activeDb) return

  await activeDb.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      favicon TEXT,
      type TEXT,
      created_at INTEGER,
      category_count INTEGER,
      post_count INTEGER
    );

    CREATE TABLE IF NOT EXISTS categories (
      site_id TEXT,
      id TEXT,
      name TEXT NOT NULL,
      slug TEXT,
      count INTEGER,
      page_offset INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      last_checked_at INTEGER DEFAULT 0,
      PRIMARY KEY (site_id, id)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      site_id TEXT,
      category_id TEXT,
      title TEXT NOT NULL,
      slug TEXT,
      url TEXT,
      excerpt TEXT,
      author TEXT,
      published_at TEXT,
      thumbnail TEXT,
      is_downloaded INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      html_path TEXT,
      gemini_summary TEXT,
      model_used TEXT,
      summary_consistent INTEGER DEFAULT 1,
      created_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_posts_cat ON posts (site_id, category_id);

    -- FTS5 full-text search table for instant offline article search
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      title,
      excerpt,
      content='posts',
      content_rowid='rowid'
    );

    -- FTS5 table for offline Telegram PDF Library
    CREATE VIRTUAL TABLE IF NOT EXISTS telegram_books USING fts5(
      file_id,
      title,
      author,
      size_mb,
      post_date,
      message_id,
      caption
    );
  `)

  try {
    await activeDb.execAsync("ALTER TABLE sites ADD COLUMN custom_prompt TEXT;")
  } catch {}
}

// ---------------- Site Custom Prompt Methods ----------------

const memSitePrompts = new Map<string, string>()

export async function getSiteCustomPrompt(siteId: string): Promise<string | null> {
  const db = await getDb()
  if (!db) return memSitePrompts.get(siteId) || null
  try {
    const row: any = await db.getFirstAsync("SELECT custom_prompt FROM sites WHERE id = ?", [siteId])
    return row?.custom_prompt || memSitePrompts.get(siteId) || null
  } catch {
    return memSitePrompts.get(siteId) || null
  }
}

export async function saveSiteCustomPrompt(siteId: string, prompt: string): Promise<void> {
  memSitePrompts.set(siteId, prompt)
  const db = await getDb()
  if (!db) return
  try {
    await db.runAsync("UPDATE sites SET custom_prompt = ? WHERE id = ?", [prompt, siteId])
  } catch (err) {
    console.error("Error saving site custom prompt:", err)
  }
}

// ---------------- Site Methods ----------------

export async function getSites(): Promise<SiteMetadata[]> {
  const db = await getDb()
  if (!db) return memSites

  const rows = await db.getAllAsync("SELECT * FROM sites ORDER BY created_at ASC")
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    description: r.description,
    favicon: r.favicon,
    type: r.type,
    createdAt: r.created_at,
    categoryCount: r.category_count,
    postCount: r.post_count,
  }))
}

export async function saveSite(site: SiteMetadata): Promise<void> {
  const db = await getDb()
  if (!db) {
    const idx = memSites.findIndex((s) => s.id === site.id)
    if (idx >= 0) memSites[idx] = site
    else memSites.push(site)
    return
  }

  await db.runAsync(
    `INSERT OR REPLACE INTO sites (id, name, url, description, favicon, type, created_at, category_count, post_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      site.id,
      site.name,
      site.url,
      site.description || "",
      site.favicon || "",
      site.type,
      site.createdAt,
      site.categoryCount || 0,
      site.postCount || 0,
    ],
  )
}

// ---------------- Category Methods ----------------

export async function getCategories(siteId: string): Promise<SiteCategory[]> {
  const db = await getDb()
  if (!db) return memCategories.get(siteId) || []

  const rows = await db.getAllAsync(
    "SELECT * FROM categories WHERE site_id = ? ORDER BY count DESC",
    [siteId],
  )
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    count: r.count,
  }))
}

export async function saveCategories(
  siteId: string,
  categories: SiteCategory[],
): Promise<void> {
  const db = await getDb()
  if (!db) {
    memCategories.set(siteId, categories)
    return
  }

  for (const cat of categories) {
    await db.runAsync(
      `INSERT INTO categories (site_id, id, name, slug, count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(site_id, id) DO UPDATE SET
         name = excluded.name,
         slug = excluded.slug,
         count = excluded.count`,
      [siteId, cat.id, cat.name, cat.slug, cat.count],
    )
  }
}

export async function getCategoryState(
  siteId: string,
  categoryId: string,
): Promise<CategoryPaginationState> {
  const key = `${siteId}_${categoryId}`
  const db = await getDb()
  if (!db) {
    return (
      memCategoryStates.get(key) || {
        siteId,
        categoryId,
        pageOffset: 0,
        isCompleted: false,
        lastCheckedAt: 0,
      }
    )
  }

  const row: any = await db.getFirstAsync(
    "SELECT page_offset, is_completed, last_checked_at FROM categories WHERE site_id = ? AND id = ?",
    [siteId, categoryId],
  )

  return {
    siteId,
    categoryId,
    pageOffset: row?.page_offset || 0,
    isCompleted: Boolean(row?.is_completed),
    lastCheckedAt: row?.last_checked_at || 0,
  }
}

export async function updateCategoryState(
  siteId: string,
  categoryId: string,
  pageOffset: number,
  isCompleted: boolean,
): Promise<void> {
  const key = `${siteId}_${categoryId}`
  const now = Date.now()
  const db = await getDb()
  if (!db) {
    memCategoryStates.set(key, {
      siteId,
      categoryId,
      pageOffset,
      isCompleted,
      lastCheckedAt: now,
    })
    return
  }

  await db.runAsync(
    `UPDATE categories SET page_offset = ?, is_completed = ?, last_checked_at = ?
     WHERE site_id = ? AND id = ?`,
    [pageOffset, isCompleted ? 1 : 0, now, siteId, categoryId],
  )
}

// ---------------- Post Methods ----------------

export async function getPostsByCategory(
  siteId: string,
  categoryId: string,
): Promise<SitePost[]> {
  const db = await getDb()
  if (!db) {
    return Array.from(memPosts.values()).filter(
      (p) => p.siteId === siteId && p.categoryId === categoryId,
    )
  }

  const rows = await db.getAllAsync(
    `SELECT * FROM posts WHERE site_id = ? AND category_id = ?
     ORDER BY published_at DESC, created_at DESC`,
    [siteId, categoryId],
  )

  return rows.map((r: any) => ({
    id: r.id,
    siteId: r.site_id,
    categoryId: r.category_id,
    title: r.title,
    slug: r.slug,
    url: r.url,
    content: "", // Full HTML stored on disk, fetched on demand
    excerpt: r.excerpt,
    author: r.author,
    publishedAt: r.published_at,
    thumbnail: r.thumbnail,
    isDownloaded: Boolean(r.is_downloaded),
    htmlPath: r.html_path,
    geminiSummary: r.gemini_summary,
    modelUsed: r.model_used,
    isConsistent: Boolean(r.summary_consistent),
  }))
}

export async function savePosts(posts: SitePost[]): Promise<void> {
  const db = await getDb()
  if (!db) {
    for (const p of posts) {
      memPosts.set(p.id, p)
    }
    return
  }

  const now = Date.now()
  for (const p of posts) {
    await db.runAsync(
      `INSERT INTO posts (id, site_id, category_id, title, slug, url, excerpt, author, published_at, thumbnail, is_downloaded, html_path, gemini_summary, model_used, summary_consistent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         excerpt = excluded.excerpt,
         thumbnail = excluded.thumbnail,
         html_path = COALESCE(excluded.html_path, posts.html_path),
         gemini_summary = COALESCE(excluded.gemini_summary, posts.gemini_summary),
         model_used = COALESCE(excluded.model_used, posts.model_used),
         is_downloaded = MAX(excluded.is_downloaded, posts.is_downloaded)`,
      [
        p.id,
        p.siteId,
        p.categoryId,
        p.title,
        p.slug,
        p.url,
        p.excerpt || "",
        p.author || "",
        p.publishedAt || "",
        p.thumbnail || "",
        p.isDownloaded ? 1 : 0,
        (p as any).htmlPath || null,
        (p as any).geminiSummary || null,
        (p as any).modelUsed || null,
        (p as any).isConsistent !== false ? 1 : 0,
        now,
      ],
    )
  }
}

export async function updatePostSummary(
  postId: string,
  summary: string,
  modelUsed: string,
  isConsistent: boolean = true,
): Promise<void> {
  const db = await getDb()
  if (!db) {
    const post = memPosts.get(postId)
    if (post) {
      ;(post as any).geminiSummary = summary
      ;(post as any).modelUsed = modelUsed
      ;(post as any).isConsistent = isConsistent
    }
    return
  }

  await db.runAsync(
    `UPDATE posts SET gemini_summary = ?, model_used = ?, summary_consistent = ?
     WHERE id = ?`,
    [summary, modelUsed, isConsistent ? 1 : 0, postId],
  )
}

// ---------------- Telegram PDF Books (Offline FTS5) ----------------

export async function seedTelegramBooks(books: TelegramBook[]): Promise<void> {
  const db = await getDb()
  if (!db) {
    memTelegramBooks.push(...books)
    return
  }

  for (const b of books) {
    await db.runAsync(
      `INSERT INTO telegram_books (file_id, title, author, size_mb, post_date, message_id, caption)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [b.fileId, b.title, b.author, b.sizeMb, b.postDate, b.messageId, b.caption || ""],
    )
  }
}

export async function searchTelegramBooks(query: string = ""): Promise<TelegramBook[]> {
  const cleanQ = query.trim().replace(/'/g, "''")
  const db = await getDb()
  if (!db) {
    if (!cleanQ) return memTelegramBooks
    const lower = cleanQ.toLowerCase()
    return memTelegramBooks.filter(
      (b) =>
        b.title.toLowerCase().includes(lower) ||
        b.author.toLowerCase().includes(lower) ||
        (b.caption && b.caption.toLowerCase().includes(lower)),
    )
  }

  let sql = "SELECT * FROM telegram_books"
  let params: any[] = []

  if (cleanQ) {
    // SQLite FTS5 matching
    sql = "SELECT * FROM telegram_books WHERE telegram_books MATCH ? ORDER BY rank"
    params = [`"${cleanQ}"*`]
  }

  try {
    const rows = await db.getAllAsync(sql, params)
    return rows.map((r: any) => ({
      fileId: r.file_id,
      title: r.title,
      author: r.author,
      sizeMb: parseFloat(r.size_mb) || 0,
      postDate: r.post_date,
      messageId: parseInt(r.message_id, 10) || 0,
      caption: r.caption,
    }))
  } catch {
    return []
  }
}

// ---------------- Hidden Posts Methods ----------------

const memHiddenPostIds = new Set<string>()

export async function getHiddenPostIds(): Promise<string[]> {
  const db = await getDb()
  if (!db) return Array.from(memHiddenPostIds)
  try {
    const rows = await db.getAllAsync("SELECT id FROM posts WHERE is_hidden = 1")
    return rows.map((r: any) => String(r.id))
  } catch {
    return Array.from(memHiddenPostIds)
  }
}

export async function toggleHidePost(postId: string | number): Promise<boolean> {
  const idStr = String(postId)
  const db = await getDb()
  if (!db) {
    if (memHiddenPostIds.has(idStr)) {
      memHiddenPostIds.delete(idStr)
      return false
    } else {
      memHiddenPostIds.add(idStr)
      return true
    }
  }

  try {
    const row: any = await db.getFirstAsync("SELECT is_hidden FROM posts WHERE id = ?", [idStr])
    const newHidden = row?.is_hidden === 1 ? 0 : 1
    await db.runAsync("UPDATE posts SET is_hidden = ? WHERE id = ?", [newHidden, idStr])
    return newHidden === 1
  } catch {
    if (memHiddenPostIds.has(idStr)) {
      memHiddenPostIds.delete(idStr)
      return false
    } else {
      memHiddenPostIds.add(idStr)
      return true
    }
  }
}

export async function setPostHidden(postId: string | number, isHidden: boolean): Promise<void> {
  const idStr = String(postId)
  const db = await getDb()
  if (!db) {
    if (isHidden) memHiddenPostIds.add(idStr)
    else memHiddenPostIds.delete(idStr)
    return
  }
  try {
    await db.runAsync("UPDATE posts SET is_hidden = ? WHERE id = ?", [isHidden ? 1 : 0, idStr])
  } catch {
    if (isHidden) memHiddenPostIds.add(idStr)
    else memHiddenPostIds.delete(idStr)
  }
}

