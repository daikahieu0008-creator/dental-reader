# DentalAI Reader 🦷🩺

Ứng dụng di động chuyên sâu dành cho Bác sĩ và Sinh viên Răng Hàm Mặt.
Hỗ trợ đọc ngoại tuyến bài viết chuyên ngành (từ `tuhocrhm.com` và các nguồn WordPress/RSS), tóm tắt lâm sàng 4 phần bằng Google Gemini AI, tra cứu sách giáo trình PDF ngoại tuyến qua Telegram Bot và nghe đọc giọng nói tiếng Việt Native.

---

## 🌟 Các Tính Năng Nổi Bật

1. **Đọc Chuyên Mục Kiểu RSS & Ngoại Tuyến (Offline-First)**:
   - Nạp sẵn 19 danh mục chuyên khoa Răng Hàm Mặt từ `https://tuhocrhm.com` (621 bài viết).
   - Tải 10 bài đầu tiên khi vào chuyên mục; lưu cục bộ bằng SQLite FTS5 & File System.
   - 3 nút tải thêm: `+10 bài`, `+50 bài`, `Tải tất cả` kèm giãn cách (throttle 200ms) để không làm quá tải trang nguồn.
   - Tự động kiểm tra bài viết mới (Delta check) ở trang 1.

2. **Cài Đặt Gemini API & Kéo Thả Thứ Tự Ưu Tiên**:
   - Khóa API cá nhân được lưu trong Secure Store (mã hóa phần cứng thiết bị), không lưu plaintext, không đi qua server trung gian.
   - Sắp xếp thứ tự model linh hoạt với badge `Tên model (RPD)`.
   - Nút cập nhật danh sách model trực tiếp từ Google API (`>= Gemini 3.5 Flash Lite`).
   - **Gemini 3.5 Flash Lite bị khóa cố định ở vị trí đáy danh sách** làm chốt chặn cuối cùng.

3. **Bộ Chuyển Model Thông Minh (Model Fallback Engine)**:
   - Module logic thuần độc lập (đã kiểm thử 100% unit tests).
   - Phân biệt lỗi **429 RPM** (cooldown và thử lại model mạnh sau) vs **429 RPD / Quota 0** (vô hiệu hóa đến nửa đêm giờ Thái Bình Dương `America/Los_Angeles`).
   - Xử lý 400/401/403 (Fail-fast báo lỗi key), 404 (bỏ qua êm ái), 500/503/504 (chuyển model kế tiếp).
   - Thẻ báo lỗi Admin khi cạn kiệt model kèm nút mở **Zalo: 0868899853** (`https://zalo.me/0868899853`) và sao chép mã lỗi chi tiết.

4. **Tóm Tắt Nha Khoa Chuyên Sâu & Kiểm Tra Số Liệu (Verification Check)**:
   - Bóc tách văn bản thô, prompt nha khoa 4 phần: Mục đích, Nội dung cốt lõi, Ứng dụng lâm sàng bắt buộc, đánh số ý `[X.Y]`.
   - **Quality Verification Check**: Đối chiếu mọi con số kèm đơn vị nha khoa (`%`, `mm`, `ml`, `mg`, `tháng`, `°C`, `MPa`, `Ncm`, `rpm`, `gauge`...) giữa tóm tắt và bài gốc, cảnh báo vàng `⚠️ Cần kiểm tra lại số liệu` nếu phát hiện sai lệch.
   - Hỏi đáp ngữ cảnh (Follow-up Chat Q&A) bám sát toàn văn bài viết.

5. **Thư Viện Sách PDF Telegram Ngoại Tuyến**:
   - Mục lục sách giáo trình lưu trong SQLite FTS5, tìm kiếm toàn văn siêu tốc 100% không cần mạng.
   - Mở deep link bot Telegram `https://t.me/DentalAILibraryBot?start=b_<fileId>` để nhận file PDF sách không giới hạn dung lượng.

6. **Giọng Đọc Native Tiếng Việt**:
   - Tích hợp `expo-speech` trực tiếp từ hệ thống, đọc bài viết và tóm tắt mượt mà offline.

---

## 🛠 Công Nghệ Sử Dụng

- **Framework**: React Native (Expo SDK 52, New Architecture, TypeScript).
- **Lưu trữ**: `expo-sqlite` (FTS5), `expo-file-system`, `expo-secure-store`.
- **Âm thanh**: `expo-speech` (Native Vietnamese TTS).
- **Trình đọc bài**: `react-native-webview`.
- **Giao diện**: Vanilla StyleSheet, Dark theme / Dental Cyan hiện đại.
