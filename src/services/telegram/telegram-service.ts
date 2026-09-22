/**
 * Telegram PDF Library Service for DentalAI Reader
 * 
 * Supports:
 * - 100% Offline Full-Text Search (SQLite FTS5)
 * - Deep linking to Telegram Bot: t.me/<bot_username>?start=<short_id>
 * - Fallback to Admin Zalo (0868899853) if file missing or Telegram not installed
 */

import { searchTelegramBooks, seedTelegramBooks, type TelegramBook } from "../../storage/database.ts"

export const DEFAULT_TELEGRAM_BOT_USERNAME = "DentalAILibraryBot"

// Pre-seeded dental textbooks for offline search demonstration & initial launch
export const INITIAL_PRESET_BOOKS: TelegramBook[] = [
  {
    fileId: "endo_pathways_12th",
    title: "Cohen's Pathways of the Pulp (12th Edition)",
    author: "Louis H. Berman, Kenneth M. Hargreaves",
    sizeMb: 84.5,
    postDate: "2024-01-15",
    messageId: 1024,
    caption: "Giáo trình nội nha kinh điển thế giới, bản dịch và nguyên tác tiếng Anh chuyên ngành Răng Hàm Mặt.",
  },
  {
    fileId: "ortho_contemporary_6th",
    title: "Contemporary Orthodontics (6th Edition)",
    author: "William R. Proffit, Henry W. Fields",
    sizeMb: 72.3,
    postDate: "2024-02-10",
    messageId: 1025,
    caption: "Chỉnh nha hiện đại toàn tập: Cơ sinh học, chẩn đoán phân tích sọ nghiêng cephalometric, khí cụ chỉnh hình.",
  },
  {
    fileId: "perio_clinical_carranza_13th",
    title: "Carranza's Clinical Periodontology (13th Edition)",
    author: "Michael G. Newman, Henry Takei",
    sizeMb: 95.1,
    postDate: "2024-03-05",
    messageId: 1026,
    caption: "Nha chu học lâm sàng: Phẫu thuật vạt, ghép mô liên kết, tái tạo mô có hướng dẫn (GTR).",
  },
  {
    fileId: "implant_misch_contemporary_4th",
    title: "Misch's Contemporary Implant Dentistry (4th Edition)",
    author: "Carl E. Misch, Randolph R. Resnik",
    sizeMb: 110.0,
    postDate: "2024-03-20",
    messageId: 1027,
    caption: "Cấy ghép nha khoa toàn diện: Kỹ thuật nâng xoang kín/hở, ghép xương tự thân, All-on-4.",
  },
  {
    fileId: "prostho_rosenstiel_5th",
    title: "Contemporary Fixed Prosthodontics (5th Edition)",
    author: "Stephen F. Rosenstiel, Martin F. Land",
    sizeMb: 68.4,
    postDate: "2024-04-12",
    messageId: 1028,
    caption: "Phục hình cố định: Mài cùi răng, lấy dấu cao su, gắn xi măng resin, dán veneer sứ veneer e.max.",
  },
  {
    fileId: "vpt_vital_pulp_therapy_2024",
    title: "Hướng Dẫn Lâm Sàng Điều Trị Tủy Sống (VPT) Trong RHM",
    author: "Nhóm Giảng viên & Chuyên gia Răng Hàm Mặt",
    sizeMb: 18.2,
    postDate: "2024-05-01",
    messageId: 1029,
    caption: "Quy trình che tủy gián tiếp/trực tiếp, lấy tủy buồng một phần bằng bioceramics (MTA, Biodentine).",
  },
]

let isSeeded = false

export async function ensureBooksSeeded(): Promise<void> {
  if (isSeeded) return
  const current = await searchTelegramBooks("")
  if (current.length === 0) {
    await seedTelegramBooks(INITIAL_PRESET_BOOKS)
  }
  isSeeded = true
}

export function buildTelegramDeepLink(
  botUsername: string,
  fileId: string,
): string {
  // Ensure safe short code: max 64 chars, only [A-Za-z0-9_-]
  const safeParam = `b_${fileId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64)
  const cleanBot = botUsername.replace("@", "").trim()
  return `https://t.me/${cleanBot}?start=${safeParam}`
}

export async function searchBooksOffline(query: string = ""): Promise<TelegramBook[]> {
  await ensureBooksSeeded()
  return await searchTelegramBooks(query)
}
