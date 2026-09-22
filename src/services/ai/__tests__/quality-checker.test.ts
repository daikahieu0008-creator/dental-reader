import assert from "node:assert"
import { verifySummaryNumbers } from "../quality-checker.ts"

function testQualityChecker() {
  console.log("=== BẮT ĐẦU KIỂM THỬ QUALITY CHECKER ===")

  const sourceArticle = `
    Nghiên cứu về điều trị tủy buồng (VPT) trên răng vĩnh viễn chưa đóng chóp.
    Quy trình: Bơm rửa bằng dung dịch NaOCl 2.5% trong vòng 5 phút.
    Đặt MTA độ dày 2 mm lên vùng tủy lộ.
    Hẹn bệnh nhân tái khám sau 3 tháng và 6 tháng.
    Tỷ lệ thành công ghi nhận đạt 92.5%.
  `

  // Case 1: All numbers match
  const validSummary = `
    - Bơm rửa bằng NaOCl 2.5% trong 5 phút.
    - Phủ MTA dày 2mm.
    - Tái khám sau 3 tháng hoặc 6 tháng. Tỷ lệ thành công 92.5%.
  `
  const result1 = verifySummaryNumbers(validSummary, sourceArticle)
  assert.strictEqual(result1.isConsistent, true, "Bản tóm tắt chuẩn phải pass 100%")
  assert.strictEqual(result1.mismatches.length, 0, "Không có lỗi sai số")
  console.log("Test 1 (Khớp 100%): ĐẠT!")

  // Case 2: Hallucinated number (e.g. 5.25% instead of 2.5%, or 12 tháng instead of 6 tháng)
  const hallucinatedSummary = `
    - Bơm rửa bằng NaOCl 5.25% trong 5 phút.
    - Tái khám sau 12 tháng.
  `
  const result2 = verifySummaryNumbers(hallucinatedSummary, sourceArticle)
  assert.strictEqual(result2.isConsistent, false, "Phải phát hiện số bịa/ảo giác")
  assert(result2.mismatches.some((m) => m.raw.includes("5.25%")), "Phải phát hiện 5.25% không có trong bài")
  assert(result2.mismatches.some((m) => m.raw.includes("12 tháng")), "Phải phát hiện 12 tháng không có trong bài")
  assert(result2.warningMessage !== undefined, "Phải có warningMessage")
  console.log("Test 2 (Bắt ảo giác số liệu): ĐẠT!")

  console.log("=== TẤT CẢ TEST QUALITY CHECKER ĐÃ ĐẠT 100%! ===")
}

testQualityChecker()
