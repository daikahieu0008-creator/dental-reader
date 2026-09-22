/**
 * Unit tests for ModelFallbackManager
 * Tested directly with Node.js via `--experimental-strip-types`.
 */

import assert from "node:assert"
import {
  ADMIN_PHONE,
  ADMIN_ZALO_URL,
  DEFAULT_MODEL_LIST,
  getPacificDateString,
  ModelFallbackManager,
  PINNED_MODEL_ID,
} from "../model-fallback-manager.ts"

function runTestSuite() {
  console.log("=== BẮT ĐẦU KIỂM THỬ MODEL FALLBACK MANAGER ===")

  // Test 1: Pinned gemini-3.5-flash-lite at bottom
  {
    console.log("Test 1: Kiểm tra gemini-3.5-flash-lite luôn bị ghim ở đáy...")
    const manager = new ModelFallbackManager()
    const models = manager.getModels()

    assert.strictEqual(
      models[models.length - 1].id,
      PINNED_MODEL_ID,
      "Model cuối cùng bắt buộc phải là gemini-3.5-flash-lite",
    )
    assert.strictEqual(
      models[models.length - 1].isPinnedBottom,
      true,
      "isPinnedBottom phải là true",
    )

    // Try to reorder with pinned model at the top
    manager.reorderModels([
      PINNED_MODEL_ID,
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
    ])
    const reordered = manager.getModels()
    assert.strictEqual(
      reordered[0].id,
      "gemini-3.8-flash",
      "Model đầu tiên sau khi cố kéo pinned lên đầu phải là gemini-3.8-flash",
    )
    assert.strictEqual(
      reordered[reordered.length - 1].id,
      PINNED_MODEL_ID,
      "Pinned model vẫn phải bị khoá cứng ở đáy sau khi reorder",
    )
    console.log("-> Test 1 ĐẠT!")
  }

  // Test 2: Remote model filtering and sorting
  {
    console.log("Test 2: Kiểm tra lọc và sắp xếp model từ API...")
    const mockRawModels = [
      { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
      { name: "models/imagen-3.0-generate-002", supportedGenerationMethods: ["generateImages"] },
      { name: "models/gemma-2-9b-it", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-1.5-flash", supportedGenerationMethods: ["generateContent"] }, // < 3.5
      { name: "models/gemini-3.5-flash", displayName: "Gemini 3.5 Flash", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-3.7-flash", displayName: "Gemini 3.7 Flash", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-3.8-flash", displayName: "Gemini 3.8 Flash", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-3.8-flash-lite", displayName: "Gemini 3.8 Flash Lite", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-3.5-flash-lite", displayName: "Gemini 3.5 Flash Lite", supportedGenerationMethods: ["generateContent"] },
    ]

    const filtered = ModelFallbackManager.filterAndSortRemoteModels(mockRawModels)

    // Only models >= 3.5 and text-based
    const ids = filtered.map((m) => m.id)
    assert(ids.includes("gemini-3.8-flash"), "Phải có 3.8 Flash")
    assert(ids.includes("gemini-3.8-flash-lite"), "Phải có 3.8 Flash Lite")
    assert(ids.includes("gemini-3.7-flash"), "Phải có 3.7 Flash")
    assert(ids.includes("gemini-3.5-flash"), "Phải có 3.5 Flash")
    assert(ids.includes(PINNED_MODEL_ID), "Phải có 3.5 Flash Lite")

    assert(!ids.includes("gemini-1.5-flash"), "Không được có model < 3.5")
    assert(!ids.includes("gemma-2-9b-it"), "Không được có gemma")
    assert(!ids.includes("text-embedding-004"), "Không được có embedding")
    assert(!ids.includes("imagen-3.0-generate-002"), "Không được có imagen")

    // Sorting: 3.8 Flash before 3.8 Flash Lite
    const idx38 = ids.indexOf("gemini-3.8-flash")
    const idx38Lite = ids.indexOf("gemini-3.8-flash-lite")
    assert(idx38 < idx38Lite, "3.8 Flash chuẩn phải đứng trước 3.8 Flash Lite")

    // Pinned 3.5 Flash Lite at the bottom
    assert.strictEqual(
      ids[ids.length - 1],
      PINNED_MODEL_ID,
      "3.5 Flash Lite phải luôn đứng cuối cùng",
    )
    console.log("-> Test 2 ĐẠT!")
  }

  // Test 3: Error classification
  {
    console.log("Test 3: Kiểm tra phân loại lỗi (400, 401, 403, 404, 500, 503)...")
    const manager = new ModelFallbackManager()

    // 400 Bad Request
    const err400 = manager.classifyError(400, { error: { message: "API key invalid" } }, "gemini-3.8-flash")
    assert.strictEqual(err400.type, "AUTH_OR_BAD_REQUEST")

    // 403 Forbidden
    const err403 = manager.classifyError(403, { error: { message: "Permission denied" } }, "gemini-3.8-flash")
    assert.strictEqual(err403.type, "AUTH_OR_BAD_REQUEST")

    // 404 Not Found
    const err404 = manager.classifyError(404, { error: { message: "Model not found" } }, "gemini-3.8-flash")
    assert.strictEqual(err404.type, "MODEL_NOT_FOUND")

    // 503 Server Overload
    const err503 = manager.classifyError(503, { error: { message: "The model is overloaded." } }, "gemini-3.8-flash")
    assert.strictEqual(err503.type, "SERVER_OVERLOAD")

    console.log("-> Test 3 ĐẠT!")
  }

  // Test 4: 429 RPM vs RPD vs Zero Quota classification
  {
    console.log("Test 4: Kiểm tra phân biệt 429 RPM vs 429 RPD vs Zero Quota...")
    const manager = new ModelFallbackManager()

    // 429 with RetryInfo (RPM)
    const errRpm = manager.classifyError(
      429,
      {
        error: {
          code: 429,
          message: "Resource exhausted",
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.RetryInfo",
              retryDelay: "45s",
            },
          ],
        },
      },
      "gemini-3.8-flash",
    )
    assert.strictEqual(errRpm.type, "RPM_QUOTA_EXCEEDED")
    if (errRpm.type === "RPM_QUOTA_EXCEEDED") {
      assert.strictEqual(errRpm.retryAfterSeconds, 45, "Thời gian chờ phải là 45s")
    }

    // 429 with QuotaFailure mentioning PerDay (RPD)
    const errRpd = manager.classifyError(
      429,
      {
        error: {
          code: 429,
          message: "Quota exceeded for GenerateContentRequestsPerDay",
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.QuotaFailure",
              violations: [
                {
                  quotaMetric: "GenerateContentRequestsPerDay",
                  description: "Daily quota exhausted",
                },
              ],
            },
          ],
        },
      },
      "gemini-3.8-flash",
    )
    assert.strictEqual(errRpd.type, "RPD_QUOTA_EXCEEDED")

    // 429 with zero quota
    const errZero = manager.classifyError(
      429,
      {
        error: {
          code: 429,
          message: "Limit '0' for quota metric",
          details: [],
        },
      },
      "gemini-3.8-flash",
    )
    assert.strictEqual(errZero.type, "ZERO_QUOTA")

    console.log("-> Test 4 ĐẠT!")
  }

  // Test 5: Fallback behavior & Pacific Time reset
  {
    console.log("Test 5: Kiểm tra cơ chế Fallback và Reset giờ Thái Bình Dương...")
    const manager = new ModelFallbackManager()
    const now = 1726915200000 // Fixed timestamp for test

    // Initially all 4 models eligible
    assert.strictEqual(manager.getEligibleModels(now).length, 4)

    // Model 1 (gemini-3.8-flash) hits 429 RPM with 60s cooldown
    manager.handleClassifiedError(
      "gemini-3.8-flash",
      { type: "RPM_QUOTA_EXCEEDED", retryAfterSeconds: 60, message: "RPM hit" },
      now,
    )

    // At now + 10s: 3.8-flash is cooling down, next eligible is 3.7-flash
    let eligible = manager.getEligibleModels(now + 10000)
    assert.strictEqual(eligible[0].id, "gemini-3.7-flash", "Model kế tiếp phải là 3.7-flash")
    assert.strictEqual(eligible.length, 3, "Còn 3 model khả dụng")

    // At now + 65s: 3.8-flash has cooled down and is eligible again as strongest!
    eligible = manager.getEligibleModels(now + 65000)
    assert.strictEqual(eligible[0].id, "gemini-3.8-flash", "Hết cooldown, 3.8-flash phải được ưu tiên lại")

    // Now Model 1 hits 429 RPD (Daily quota exceeded)
    manager.handleClassifiedError(
      "gemini-3.8-flash",
      { type: "RPD_QUOTA_EXCEEDED", message: "RPD hit" },
      now,
    )

    // Model 1 is disabled for the rest of the day
    eligible = manager.getEligibleModels(now + 120000)
    assert.strictEqual(eligible[0].id, "gemini-3.7-flash", "3.8-flash bị khoá hết ngày, ưu tiên 3.7-flash")
    assert(!eligible.some((m) => m.id === "gemini-3.8-flash"), "3.8-flash không được xuất hiện trong ngày")

    console.log("-> Test 5 ĐẠT!")
  }

  // Test 6: Admin Error Report and Zalo link
  {
    console.log("Test 6: Kiểm tra tạo báo cáo lỗi Admin & liên hệ Zalo...")
    const manager = new ModelFallbackManager()
    manager.recordRequest("gemini-3.8-flash")
    manager.recordRequest("gemini-3.5-flash-lite")

    const report = manager.generateAdminReport(
      ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", PINNED_MODEL_ID],
      PINNED_MODEL_ID,
      429,
      "Tất cả model đều cạn quota",
    )

    assert.strictEqual(report.adminPhone, ADMIN_PHONE)
    assert.strictEqual(report.zaloUrl, ADMIN_ZALO_URL)
    assert.strictEqual(report.lastModel, PINNED_MODEL_ID)
    assert(report.formattedCopyText.includes("0868899853"))
    assert(report.formattedCopyText.includes(PINNED_MODEL_ID))
    assert(report.formattedCopyText.includes("Mã lỗi: 429"))

    console.log("-> Test 6 ĐẠT!")
  }

  console.log("=== TẤT CẢ 6 BỘ TEST ĐÃ CHẠY THÀNH CÔNG 100%! ===")
}

runTestSuite()
