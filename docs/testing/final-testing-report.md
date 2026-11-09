# BÁO CÁO TỔNG KẾT KIỂM THỬ TOÀN DIỆN PHẦN MỀM (FINAL TEST REPORT)
**Dự án:** Hệ thống Quản lý và Đặt phòng Homestay (PTDA Homestay)  
**Môn học:** Đảm bảo chất lượng & Kiểm thử phần mềm  
**Đơn vị thực hiện:** Nhóm 16  
**Cơ sở mã nguồn:**  
- **Backend:** `D:\ptda\backend` (Node.js, Express, Prisma ORM, PostgreSQL)
- **Frontend:** `D:\ptda\frontend-simple` (React 18, Vite SPA)
- **Tài liệu kiểm thử:** `D:\ptda\docs\testing`  
**Thời gian hoàn thành:** Tháng 10/2026  
**Trạng thái kiểm thử:** **158/158 Automated Test Cases PASSED (100%)** | **16/16 Simulated UAT Criteria ACHIEVED**  

---

## 1. TÓM TẮT ĐIỀU HÀNH (EXECUTIVE SUMMARY)

Dự án Hệ thống Quản lý và Đặt phòng Homestay đã trải qua quy trình kiểm thử và đối soát kỹ thuật toàn diện theo 4 cấp độ kiểm thử phần mềm:
1. **Kiểm thử Đơn vị (Unit Testing - 104 tests)**: Kiểm thử hộp trắng chuyên sâu tầng logic trong bộ nhớ RAM (Mock Prisma), đạt độ bao phủ nhánh **90.25%**, dòng lệnh **60.23%**, hoàn thành trong ~3.6 giây.
2. **Kiểm thử Tích hợp (Integration Testing - 32 tests)**: Kiểm tra tương tác giữa các tầng Controller $\leftrightarrow$ Service $\leftrightarrow$ Middleware $\leftrightarrow$ Response Helper trên Express ảo cổng động với dữ liệu Mock trong RAM, hoàn thành trong ~4.2 giây.
3. **Kiểm thử Hệ thống (System Testing - 22 scenarios)**: Kiểm thử toàn vẹn End-to-End trên dịch vụ Live thật (Backend `:3000`, Frontend `:5173`, PostgreSQL `ptda_homestay`), tự động hóa trình duyệt Google Chrome chụp 4 ảnh màn hình thực tế, hoàn thành trong ~32.4 giây.
4. **Kiểm thử Chấp nhận Mô phỏng (Simulated Acceptance Testing - 16 criteria)**: Đối soát ma trận 16 tiêu chí chức năng mô phỏng cho 3 tác nhân (Khách hàng, Chủ Homestay, Quản trị viên).

---

## 2. BẢNG TỔNG HỢP KẾT QUẢ THEO 4 CẤP ĐỘ

| STT | Cấp độ Kiểm thử | Bản chất Dữ liệu | Số Lượng | Kết quả Pass | Tỷ lệ Đạt | Thời gian Thực thi |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| **1** | **Unit Testing** | Mock RAM (Không đụng DB) | 104 | 104 / 104 | **100%** | ~3.6 giây |
| **2** | **Integration Testing**| Mock RAM (Không đụng DB) | 32 | 32 / 32 | **100%** | ~4.2 giây |
| **3** | **System Testing** | **Live PostgreSQL thật** | 22 | 22 / 22 | **100%** | ~32.4 giây |
| **Σ** | **TEST TỰ ĐỘNG CHẠY CODE**| **Mã nguồn Node.js** | **158** | **158 / 158** | **100%** | **~40.2 giây** |
| **4** | **Acceptance Testing**| Ma trận đối soát mô phỏng | 16 | 16 / 16 | **100%** | Đối soát nội bộ |

---

## 3. CHỈ SỐ ĐỘ BAO PHỦ MÃ NGUỒN XÁC MINH THỰC TẾ (CODE COVERAGE)

Đo lường bằng công cụ `node --test --experimental-test-coverage` trên toàn bộ các file logic nghiệp vụ backend:
- **Độ bao phủ Nhánh (Branch Coverage)**: **90.25%** (Vượt tiêu chuẩn công nghiệp $\ge 80\%$, chứng minh mọi rẽ nhánh điều kiện quan trọng đều có test case).
- **Độ bao phủ Dòng lệnh (Line Coverage)**: **60.23%** (Tập trung tối đa vào các file cốt lõi: `auth.middleware.js` 100%, `auth.service.js` 100%, `payment.service.js` 99.5%, `booking.service.js` 77.6%; các module phụ trợ chưa viết hết unit test kéo chỉ số trung bình xuống 60.23%).
- **Độ bao phủ Hàm (Function Coverage)**: **55.22%**.

---

## 4. KẾT QUẢ ĐỐI SOÁT BẰNG CHỨNG HÌNH ẢNH GIAO DIỆN (SCREENSHOTS)

Toàn bộ 4 ảnh chụp màn hình trong thư mục `docs/testing/screenshots/` đã được kiểm tra và ghi nhận dung lượng chuẩn:
1. `01_customer_home.png` (838,964 bytes - ~839 KB): Hiển thị đầy đủ trang chủ khách hàng và lưới homestay live.
2. `02_homestay_detail.png` (675,856 bytes - ~676 KB): Hiển thị chi tiết homestay ID=1 (đã khắc phục lỗi route `/homestays/1`).
3. `03_owner_dashboard.png` (166,030 bytes - ~166 KB): Hiển thị dashboard chủ homestay với đầy đủ session đăng nhập.
4. `04_admin_dashboard.png` (139,647 bytes - ~140 KB): Hiển thị dashboard quản trị viên hệ thống với đầy đủ session admin.

---

## 5. HƯỚNG DẪN TỰ ĐỘNG CHẠY KIỂM THỬ TRÊN MÁY LOCAL

Trong `backend/package.json`, các script đã được chuẩn hóa rõ ràng:

1. **Chạy nhanh toàn bộ Unit + Integration Tests (136 tests an toàn trong RAM, không cần bật server):**
   ```powershell
   cd D:\ptda\backend
   npm test
   ```
2. **Chạy riêng Unit Tests (104 tests):**
   ```powershell
   npm run test:unit
   ```
3. **Chạy riêng Integration Tests (32 tests):**
   ```powershell
   npm run test:integration
   ```
4. **Đo độ bao phủ mã nguồn thực tế:**
   ```powershell
   npm run test:coverage
   ```
5. **Chạy System E2E Tests (22 tests - Yêu cầu bật backend `:3000` và frontend `:5173` trước):**
   ```powershell
   npm run test:system
   ```

---

## 6. KẾT LUẬN VÀ BƯỚC ĐI TIẾP THEO

1. Dự án đã được xác minh toàn diện, làm rõ ranh giới giữa kiểm thử Mock RAM và kiểm thử Live Database.
2. Các lỗi sai lệch về chỉ số coverage, ảnh chụp rỗng (4.7 KB) và script lẫn lộn đã được phát hiện và giải quyết triệt để.
3. Chi tiết đối soát đầy đủ xem tại: [docs/testing/verification-results.md](file:///d:/ptda/docs/testing/verification-results.md).
4. Hệ thống sẵn sàng cho buổi bảo vệ nghiệm thu chính thức với Hội đồng chấm thi.
