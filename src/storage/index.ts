import AsyncStorage from "@react-native-async-storage/async-storage"
import { atom } from "jotai"
import { atomWithStorage, createJSONStorage } from "jotai/utils"

import type { SiteCategory, SiteMetadata, SitePost } from "../services/site-scraper/types"

const storage = createJSONStorage<any>(() => AsyncStorage)

export const DEFAULT_PRESET_SITES: SiteMetadata[] = [
  {
    id: "tuhocrhm_com",
    name: "Tự học RHM",
    url: "https://tuhocrhm.com",
    description: "Mỗi ngày học một chút!",
    favicon: "https://tuhocrhm.com/favicon.ico",
    type: "wordpress",
    createdAt: 1726915200000,
    categoryCount: 19,
    postCount: 621,
  },
]

// Persistent list of custom sites
export const sitesAtom = atomWithStorage<SiteMetadata[]>(
  "dental_sites_list_v1",
  DEFAULT_PRESET_SITES,
  storage,
)

// Persistent categories per site: Record<siteId, SiteCategory[]>
export const categoriesAtom = atomWithStorage<Record<string, SiteCategory[]>>(
  "dental_site_categories_v1",
  {},
  storage,
)

// Persistent posts: Record<categoryKey, SitePost[]> where key is `${siteId}_${categoryId}`
export const postsAtom = atomWithStorage<Record<string, SitePost[]>>(
  "dental_site_posts_v1",
  {},
  storage,
)

// Hidden post IDs: string[]
export const hiddenPostIdsAtom = atomWithStorage<string[]>(
  "dental_hidden_posts_v1",
  [],
  storage,
)

// Custom prompts per site: Record<siteId, string>
export const customPromptsAtom = atomWithStorage<Record<string, string>>(
  "dental_custom_prompts_v1",
  {},
  storage,
)

// Real-time downloading progress in memory: Record<categoryKey, { current, total, isDownloading }>
export const downloadProgressAtom = atom<
  Record<string, { current: number; total: number; isDownloading: boolean }>
>({})
