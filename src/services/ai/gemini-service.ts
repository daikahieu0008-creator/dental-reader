/**
 * DentalAI Reader - Gemini AI Integration Service
 * Integrated with ModelFallbackManager, SecureKeyStorage, and Dental Prompt
 */

import {
  ADMIN_PHONE,
  ADMIN_ZALO_URL,
  type AdminErrorReport,
  DEFAULT_MODEL_LIST,
  ModelFallbackManager,
  PINNED_MODEL_ID,
} from "./model-fallback-manager"
import { getStoredGeminiApiKey } from "./secure-key-storage"

export const DEFAULT_DENTAL_PROMPT = `Tôi là bác sĩ Răng Hàm Mặt. Tôi sẽ gửi bạn một bài viết chuyên môn của một người thầy. Hãy đọc toàn bộ bài, rồi tạo một bản tóm lược giúp tôi nắm nội dung nhanh và dễ, đồng thời làm nền để tôi hỏi sâu thêm sau đó.

## CÁCH LÀM

**Bước 1. Đọc hết bài trước khi viết.**
Sau đó tự xác định các phần chính theo cấu trúc lập luận của tác giả, không nhất thiết theo tiêu đề hay mục lục có sẵn. Được phép gộp nhiều mục nhỏ thành một phần, hoặc tách một mục dài thành nhiều phần nếu lập luận thay đổi. Khi gộp, ghi kèm số mục gốc trong tiêu đề phần (ví dụ: "mục 4, 5") để tôi đối chiếu.

**Bước 2. Đánh số các phần chính.**
Phần 1, Phần 2, Phần 3... để tôi có thể gọi đúng phần khi hỏi thêm (ví dụ: "giải thích sâu hơn phần 3").

**Bước 3. Với mỗi phần, viết theo đúng cấu trúc sau:**

- **Mục đích:** một câu nói tác giả viết phần này để làm gì (đặt vấn đề, cung cấp nền tảng lý thuyết, chứng minh một luận điểm, so sánh kỹ thuật, hướng dẫn quy trình, trình bày bằng chứng, kết luận...).
- **Nội dung cốt lõi:** các ý chính dạng gạch đầu dòng, ngắn gọn, để tôi hiểu mà không cần đọc lại bản gốc. In đậm những ý then chốt.
- **Ứng dụng:** đây là phần rất quan trọng với tôi. Nếu trong phần đó tác giả có đưa ra lời khuyên lâm sàng, hướng dẫn lâm sàng, quy trình, chỉ định hoặc chống chỉ định, thông số thực hành (nồng độ, thời gian, kích thước, vật liệu, mốc tái khám...), lưu ý khi thực hiện, hoặc bất kỳ nội dung nào mang tính ứng dụng trong thực hành, thì bắt buộc phải nêu ra ở dòng này, không được bỏ sót. Viết dưới dạng việc cần làm hoặc cần lưu ý, được phép nhắc lại ngắn gọn ý đã có ở Nội dung cốt lõi nếu ý đó có tính ứng dụng. Chỉ dựa trên những gì tác giả nói. Nếu phần đó thuần lý thuyết hoặc không có nội dung ứng dụng thì bỏ hẳn dòng này, tuyệt đối không suy diễn hay bịa ra ứng dụng cho đủ mục.

**Bước 4. Đánh số ý nhỏ trong mỗi phần.**
Mỗi ý (mỗi gạch đầu dòng ở Nội dung cốt lõi và Ứng dụng) được gắn số theo dạng [số phần].[số thứ tự ý], đặt trong dấu ngoặc đơn ở cuối câu, sau dấu chấm. Số thứ tự chạy liên tục trong cả phần. Ví dụ, ở Phần 5:

- **X-quang:** có tổn thương quanh chóp không đồng nghĩa tủy hoại tử hoàn toàn, và không phải chống chỉ định của VPT.(5.2)

Mục đích không cần đánh số ý.

## NGUYÊN TẮC

1. **Bám sát bài viết.** Không thêm ý, số liệu hay kiến thức ngoài bài. Không tự đánh giá đúng sai nội dung của tác giả.
2. **Giữ nguyên số liệu, ngưỡng và tên riêng** (nồng độ, thời gian, kích thước, tỷ lệ, mốc theo dõi, tên tác giả, tên vật liệu, tên hiệp hội). Không làm tròn hay đổi.
3. **Ngôn ngữ dễ đọc, ngắn gọn,** nhưng giữ đúng thuật ngữ chuyên môn. Viết tắt thì giải thích ở lần xuất hiện đầu tiên.
4. **Cấu trúc nhất quán** ở mọi bài để tôi quen và tra cứu nhanh.
5. Nếu bài có ý mang tính khuyến nghị của hiệp hội, kết quả một nghiên cứu, hay chỉ là gợi ý/chưa có kết luận, hãy giữ nguyên sắc thái đó khi tóm tắt, không nâng hay hạ mức độ chắc chắn.

## ĐỊNH DẠNG ĐẦU RA

Trình bày đúng theo thứ tự sau:

1. **Tiêu đề** dạng "Tóm tắt: [tên bài]", kèm một dòng nguồn (tác giả, năm, tạp chí, loại bài nếu bài có nêu).
2. **Luận điểm xuyên suốt của bài:** 1–2 câu.
3. Một dòng ngắn cho biết các phần dưới đây đã được gộp từ bao nhiêu mục của bài, kèm số mục gốc để đối chiếu.
4. **Các phần chính,** mỗi phần có tiêu đề "## Phần [số]. [Tên phần] (mục ...)", tiếp theo là Mục đích, Nội dung cốt lõi, Ứng dụng (nếu có), ngăn cách giữa các phần bằng đường kẻ ngang.`

export interface ChatMessage {
  id: string
  role: "user" | "model"
  text: string
  createdAt: number
}

export interface SummarizeResult {
  text: string
  modelUsed: string
  errorReport?: AdminErrorReport
}

// Global fallback manager instance
export const globalModelFallbackManager = new ModelFallbackManager()

export function stripHtml(html: string): string {
  if (!html) return ""
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Summarizes an article by executing through the ModelFallbackManager chain.
 */
export async function summarizeArticleWithGemini({
  title,
  content,
  excerpt,
  siteName,
  customPrompt,
  forcedModelId,
  apiKeyOverride,
}: {
  title: string
  content: string
  excerpt?: string
  siteName?: string
  customPrompt?: string
  forcedModelId?: string
  apiKeyOverride?: string
}): Promise<SummarizeResult> {
  const apiKey = apiKeyOverride || (await getStoredGeminiApiKey())
  if (!apiKey) {
    throw new Error("Chưa cài đặt Gemini API Key. Vui lòng vào Cài đặt để thêm key.")
  }

  const cleanBody = stripHtml(content).slice(0, 30000) || excerpt || title
  const activePrompt = customPrompt && customPrompt.trim() ? customPrompt.trim() : DEFAULT_DENTAL_PROMPT

  // Source text first, system instructions & prompt second (as requested by Senior)
  const fullPromptText = `--- NỘI DUNG TOÀN VĂN BÀI VIẾT NGUYÊN BẢN ---
Tiêu đề: ${title}
Nguồn: ${siteName || "Web"}

${cleanBody}
---------------------------------------------

${activePrompt}`

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: fullPromptText }],
      },
    ],
    generationConfig: {
      temperature: 0.2, // Low temperature for factual fidelity
      maxOutputTokens: 8192,
    },
  }

  // Determine candidate models
  let candidates = globalModelFallbackManager.getEligibleModels()
  if (forcedModelId) {
    const found = globalModelFallbackManager.getModels().find((m) => m.id === forcedModelId)
    if (found) {
      candidates = [found]
    }
  }

  if (candidates.length === 0) {
    // If all models exhausted today
    const report = globalModelFallbackManager.generateAdminReport(
      [],
      PINNED_MODEL_ID,
      429,
      "Tất cả model Gemini đều đã hết hạn mức hôm nay (RPD). Vui lòng thử lại sau hoặc đổi API key.",
    )
    const err: any = new Error(report.errorMessage)
    err.report = report
    throw err
  }

  const attemptedModelIds: string[] = []
  let lastErrorStatus = 500
  let lastErrorMessage = "Không thể kết nối"

  for (const model of candidates) {
    attemptedModelIds.push(model.id)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${apiKey}`

    try {
      globalModelFallbackManager.recordRequest(model.id)
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null)
        const classification = globalModelFallbackManager.classifyError(
          res.status,
          errorBody,
          model.id,
        )

        lastErrorStatus = res.status
        lastErrorMessage = errorBody?.error?.message || `HTTP ${res.status}`

        // Fail-fast on auth or bad requests (400, 401, 403)
        if (classification.type === "AUTH_OR_BAD_REQUEST") {
          throw new Error(`Lỗi xác thực API Key (${classification.code}): ${classification.message}`)
        }

        // Apply fallback state (cooldown for RPM, lock for RPD)
        globalModelFallbackManager.handleClassifiedError(model.id, classification)

        // Silent skip for 404
        if (classification.type === "MODEL_NOT_FOUND") {
          continue
        }

        // Try next model for 500, 503, 504, 429
        continue
      }

      const data = await res.json()
      const candidate = data?.candidates?.[0]

      // Check safety blocks
      if (candidate?.finishReason === "SAFETY") {
        throw new Error("Nội dung bài viết bị chặn bởi bộ lọc an toàn của Google Gemini.")
      }

      const candidateText = candidate?.content?.parts?.[0]?.text
      if (!candidateText || candidateText.trim().length === 0) {
        // Empty or truncated, fallback to next model
        continue
      }

      return {
        text: candidateText.trim(),
        modelUsed: model.name || model.id,
      }
    } catch (err: any) {
      if (err.message?.includes("xác thực API Key") || err.message?.includes("bộ lọc an toàn")) {
        throw err
      }
      lastErrorMessage = err.message || lastErrorMessage
    }
  }

  // All models exhausted! Generate Admin Zalo error report
  const adminReport = globalModelFallbackManager.generateAdminReport(
    attemptedModelIds,
    attemptedModelIds[attemptedModelIds.length - 1] || PINNED_MODEL_ID,
    lastErrorStatus,
    lastErrorMessage,
  )

  const finalError: any = new Error(
    `Tất cả model Gemini đều không thể xử lý. Vui lòng liên hệ Admin qua Zalo: ${ADMIN_PHONE}`,
  )
  finalError.report = adminReport
  throw finalError
}

/**
 * Contextual follow-up chat for article
 */
export async function chatAboutArticleWithGemini({
  title,
  content,
  summary,
  history,
  question,
  apiKeyOverride,
}: {
  title: string
  content: string
  summary: string
  history: ChatMessage[]
  question: string
  apiKeyOverride?: string
}): Promise<string> {
  const apiKey = apiKeyOverride || (await getStoredGeminiApiKey())
  if (!apiKey) {
    throw new Error("Chưa cài đặt Gemini API Key. Vui lòng vào Cài đặt để thêm key.")
  }

  const cleanBody = stripHtml(content).slice(0, 20000)

  const systemInstruction = `Bạn là trợ lý AI thông minh đang thảo luận với bác sĩ Răng Hàm Mặt về bài viết chuyên môn: "${title}".
Dưới đây là ngữ cảnh bài viết nguyên bản và bản tóm lược:
--- NỘI DUNG BÀI VIẾT ---
${cleanBody}
--- BẢN TÓM TẮT BAN ĐẦU ---
${summary}
------------------------
QUY TẮC:
- Trả lời bằng tiếng Việt chuyên môn, ngắn gọn, súc tích và bám sát vào ngữ cảnh bài viết trên để giảm thiểu ảo giác.
- Nếu bài viết không đề cập, hãy nói rõ là tác giả không nhắc đến điều này trong bài.`

  const contents: any[] = [
    {
      role: "user",
      parts: [{ text: `${systemInstruction}\n\nBác sĩ bắt đầu đặt câu hỏi.` }],
    },
    {
      role: "model",
      parts: [{ text: "Tôi đã nắm rõ toàn văn bài viết và bản tóm tắt. Bác sĩ muốn hỏi sâu thêm về nội dung nào ạ?" }],
    },
  ]

  for (const msg of history) {
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    })
  }

  contents.push({
    role: "user",
    parts: [{ text: question }],
  })

  const eligible = globalModelFallbackManager.getEligibleModels()
  const modelToUse = eligible[0]?.id || PINNED_MODEL_ID
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => null)
    const msg = errorData?.error?.message || `HTTP ${res.status}`
    throw new Error(`Lỗi kết nối Gemini (${msg})`)
  }

  const data = await res.json()
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!reply) {
    throw new Error("Không nhận được câu trả lời từ Gemini")
  }

  return reply.trim()
}
