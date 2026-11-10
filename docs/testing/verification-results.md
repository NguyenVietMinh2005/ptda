# BÁO CÁO XÁC MINH VÀ ĐỐI SOÁT KIỂM THỬ (VERIFICATION & AUDIT REPORT)
**Dự án:** Hệ thống Quản lý và Đặt phòng Homestay (PTDA Homestay)  
**Địa điểm mã nguồn:** `D:\ptda` (Backend: `D:\ptda\backend`, Frontend: `D:\ptda\frontend-simple`)  
**Mục tiêu:** Xác minh độc lập, đối soát thực tế toàn bộ các bài test, script thực thi, độ bao phủ mã nguồn, kết quả chụp màn hình và tính trung thực của các báo cáo kiểm thử trong `docs/testing/`.  
**Thời gian thực hiện:** 21/10/2026  
**Người thực hiện kiểm định:** Antigravity Senior Software Quality Auditor  

---

## 1. BẢNG TỔNG HỢP KẾT QUẢ THỰC THI THỰC TẾ (COMMAND AUDIT LOG)

Toàn bộ các lệnh dưới đây được chạy trực tiếp trên môi trường Windows PowerShell / Node.js v24.21.0 tại thư mục dự án và ghi nhận mã thoát (Exit Code) thực tế:

| STT | Lệnh Thực Thi (Command) | Thư mục làm việc | Exit Code | Kết quả Output Thực tế | Phân loại Trạng thái |
| :---: | :--- | :--- | :---: | :--- | :---: |
| 1 | `npm test` (khi đứng ở root `D:\ptda`) | `D:\ptda` | **1** | `ENOENT: Could not read package.json` (Do root không có package.json) | **FAIL (Sai working dir)** |
| 2 | `npm --prefix backend test` (với script cũ `tests/*.test.js` khi server tắt) | `D:\ptda` | **1** | 136 tests pass, nhưng 22 tests trong `system-e2e.test.js` lỗi `ECONNREFUSED` do server chưa bật | **FAIL (Script lẫn lộn cấp độ)** |
| 3 | `node --test tests/*.service.test.js tests/*.middleware.test.js tests/*.admin.test.js` | `D:\ptda\backend` | **0** | **104 tests, 29 suites, 104 pass, 0 fail**, thời gian ~3.6s | **PASS (100% Unit Tests)** |
| 4 | `node --test tests/integration.test.js` | `D:\ptda\backend` | **0** | **32 tests, 7 suites, 32 pass, 0 fail**, thời gian ~4.2s | **PASS (100% Integration)** |
| 5 | `npm --prefix frontend-simple run build` | `D:\ptda` | **0** | `dist/index.html (0.83 kB)`, `dist/assets/index-*.js (486 kB)`, thời gian ~14.8s | **PASS (Frontend Build OK)** |
| 6 | `node --test --experimental-test-coverage tests/*.service.test.js ...` | `D:\ptda\backend` | **0** | Lines: **60.23%**, Branches: **90.25%**, Functions: **55.22%** | **PASS (Đo Coverage thực tế)** |
| 7 | `node --test tests/system-e2e.test.js` (khi bật cả 2 server :3000 và :5173) | `D:\ptda\backend` | **0** | **22 tests, 7 suites, 22 pass, 0 fail**, thời gian ~32.3s | **PASS (100% System Live)** |
| 8 | `npm --prefix backend test` (sau khi chuẩn hóa script tách biệt) | `D:\ptda` | **0** | **136 tests (104 Unit + 32 Integration), 136 pass, 0 fail**, thời gian ~5.1s | **PASS (Chuẩn hóa tự động)** |

---

## 2. ĐỐI SOÁT VÀ PHÂN TÍCH SAI LỆCH VỚI BÁO CÁO CŨ (DISCREPANCY ANALYSIS)

### 2.1. Sai lệch về Công cụ và Chỉ số Độ bao phủ mã nguồn (Code Coverage)
- **Báo cáo cũ tuyên bố:**
  > "Công cụ đo lường: c8 (v10.1.3)... Lines: 92.40%, Statements: 92.40%, Functions: 100.00%, Branches: 90.25%".
- **Kết quả xác minh thực tế:**
  1. Thư viện `c8` **hoàn toàn không được cài đặt** trong `backend/package.json` (chỉ có `@prisma/client`, `bcryptjs`, `express`, `jsonwebtoken`, `multer`, `qrcode`, `puppeteer-core`, `nodemon`, `prisma`).
  2. Lệnh thực sự được cấu hình là: `node --test --experimental-test-coverage` (sử dụng V8 Coverage Engine tích hợp của Node.js).
  3. Bảng đo thực tế từ Node.js Test Runner:
     - **Line Coverage**: **60.23%** (thay vì 92.40% như báo cáo cũ khẳng định).
     - **Branch Coverage**: **90.25%** (con số này là có thật và chính xác).
     - **Function Coverage**: **55.22%** (thay vì 100% như báo cáo cũ khẳng định).
  4. **Nguyên nhân kỹ thuật:** Các file `admin.service.js` (36.48% lines), `owner.service.js` (30.09% lines), `homestay.service.js` (48.31% lines) chứa nhiều hàm phụ trợ (quản lý tiện ích, khiếu nại, thống kê doanh thu nâng cao) chưa được viết unit test, khiến độ bao phủ dòng và hàm toàn bộ backend bị kéo xuống ~60%. Báo cáo cũ đã lấy độ bao phủ của một vài file hẹp hoặc tự nâng chỉ số để làm đẹp báo cáo.

### 2.2. Sai lệch về Ảnh chụp màn hình Hệ thống (Screenshots Audit)
- **Báo cáo cũ tuyên bố:**
  > "Bằng chứng hình ảnh giao diện hệ thống: 4 ảnh chụp đầy đủ, kích thước lớn, hiển thị đầy đủ chi tiết".
- **Kết quả xác minh thực tế:**
  Khi kiểm tra kích thước file nhị phân trong `docs/testing/screenshots/` ở lần chạy trước:
  - `01_customer_home.png`: 838,964 bytes (~839 KB) $\rightarrow$ Ảnh thật, trang chủ tải đầy đủ.
  - `02_homestay_detail.png`: **4,718 bytes** $\rightarrow$ **ẢNH RỖNG / TRẮNG TINH (Blank Canvas)**.
  - `03_owner_dashboard.png`: **4,714 bytes** $\rightarrow$ **ẢNH RỖNG / TRẮNG TINH (Blank Canvas)**.
  - `04_admin_dashboard.png`: **4,718 bytes** $\rightarrow$ **ẢNH RỖNG / TRẮNG TINH (Blank Canvas)**.
- **Nguyên nhân gốc rễ (Root Causes):**
  1. **Lỗi định tuyến frontend**: Trong `frontend-simple/src/App.jsx`, đường dẫn xem chi tiết là `/homestays/:id` (có số nhiều `s`). Bài test cũ gọi `http://localhost:5173/homestay/1` (không có `s`), dẫn đến React Router không khớp route nào và render trang trắng.
  2. **Route Admin không tồn tại**: Trong frontend, không hề có route `/admin/login`. Cả Admin và Chủ nhà đều đăng nhập chung tại `/owner/login`. Khi test cũ truy cập `/admin/login`, React Router render trang trắng.
  3. **Cơ chế xác thực ProtectedRoute**: Khi truy cập `/owner/dashboard` và `/admin/dashboard`, component `ProtectedRoute.jsx` kiểm tra `localStorage.getItem('ownerAuthToken')` và `localStorage.getItem('ownerAuthUser')`. Trình duyệt Headless mới tinh của Puppeteer chưa được nạp session vào `localStorage`, nên bị chặn hoặc redirect ngay lập tức.
- **Biện pháp khắc phục đã thực hiện:**
  - Sửa URL thành `/homestays/1`.
  - Nạp token hợp lệ của Owner và Admin vào `localStorage` trước khi điều hướng vào Dashboard.
  - Sau khi sửa, chạy lại Puppeteer và thu được 4 ảnh chụp thực tế có dung lượng chuẩn:
    - `01_customer_home.png`: **838,964 bytes** (~839 KB)
    - `02_homestay_detail.png`: **675,856 bytes** (~676 KB)
    - `03_owner_dashboard.png`: **166,030 bytes** (~166 KB)
    - `04_admin_dashboard.png`: **139,647 bytes** (~140 KB)

### 2.3. Sai lệch về Cơ chế Cơ sở dữ liệu: Mock vs PostgreSQL Thật
- **Báo cáo cũ tuyên bố:**
  > Tạo cảm giác toàn bộ các cấp độ kiểm thử đều chạy trên database PostgreSQL `ptda_homestay`.
- **Kết quả xác minh thực tế:**
  1. **Unit Testing (104 tests)**: Chạy **100% Mocking** trong bộ nhớ RAM qua `backend/tests/helpers/mockPrisma.js`. Hoàn toàn không kết nối tới PostgreSQL, không ghi và không đọc database thật.
  2. **Integration Testing (32 tests)**: Chạy trên ứng dụng Express tạm thời (`createTestApp.js`) với các route/controller/middleware thật, nhưng tầng dữ liệu `prisma` **vẫn được Mock bằng `mockPrisma.js`**. Không ghi dữ liệu vào PostgreSQL thật.
  3. **System Testing (22 tests)**: Đây là cấp độ **DUY NHẤT** kết nối và thao tác trực tiếp với cơ sở dữ liệu PostgreSQL `ptda_homestay` đang chạy trên cổng 5432 thông qua server API thật trên cổng 3000.
  - **Đánh giá an toàn:** Việc phân tách này là đúng nguyên tắc kiểm thử (Unit và Integration phải chạy độc lập, nhanh chóng và không làm bẩn DB), nhưng báo cáo bắt buộc phải nêu rõ tính chất Mock của Level 1 và Level 2 để đảm bảo tính minh bạch học thuật.

### 2.4. Sai lệch về Kiểm thử Chấp nhận (Acceptance Testing / UAT)
- **Báo cáo cũ tuyên bố:**
  > "Biên bản nghiệm thu thực tế", "16/16 Acceptance Criteria ACHIEVED", "Đạt điều kiện nghiệm thu bàn giao".
- **Kết quả xác minh thực tế:**
  1. 16 tiêu chí UAT này là **bảng ma trận đối chiếu yêu cầu chức năng do nhóm tự xây dựng và tự kiểm chứng**, hoàn toàn **CHƯA CÓ** sự tham gia ký nhận bàn giao của khách hàng thật, người dùng bên ngoài hay hội đồng chấm thi môn học.
  2. Không có bài test tự động mã nguồn nào mang tên UAT; đây là đánh giá chức năng thủ công dựa trên kết quả của Level 3.
  3. Báo cáo phải sửa lại đúng tên gọi: **"Kiểm thử theo tiêu chí chấp nhận mô phỏng (Simulated Acceptance Testing)"** và ghi rõ trạng thái: **"Chờ buổi bảo vệ thực tế để nghiệm thu chính thức"**.

### 2.5. Đối soát số lượng Test Case
- **Báo cáo cũ ghi:** "Tổng cộng 174 test cases".
- **Đối soát kỹ thuật:**
  - Tổng số test case thực sự được mã hóa thành code và thực thi tự động bởi test runner: **158 test cases** (104 Unit + 32 Integration + 22 System).
  - 16 mục còn lại là 16 tiêu chí chấp nhận (Acceptance Criteria) trong bảng UAT, không phải là test code độc lập.
  - Sau khi chuẩn hóa `package.json`, lệnh `npm test` thực thi an toàn **136 tests** (104 Unit + 32 Integration) trong 5 giây mà không đòi hỏi phải khởi động server trước.

---

## 3. BẢNG TỔNG HỢP HIỆN TRẠNG 4 CẤP ĐỘ SAU XÁC MINH

| Cấp độ Kiểm thử | Mã lệnh thực thi an toàn | Số test tự động thực tế | Trạng thái thực thi | Môi trường DB | Đánh giá hoàn thiện |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **1. Unit Testing** | `npm run test:unit` | **104** | 104 PASS / 0 FAIL | Mock trong RAM | **ĐÃ HOÀN TẤT 100%** |
| **2. Integration Testing** | `npm run test:integration` | **32** | 32 PASS / 0 FAIL | Mock trong RAM | **ĐÃ HOÀN TẤT 100%** |
| **3. System Testing** | `npm run test:system` (cần bật 2 server) | **22** | 22 PASS / 0 FAIL | PostgreSQL thật | **ĐÃ HOÀN TẤT 100%** (Ảnh chụp đã xác minh) |
| **4. Acceptance Testing** | Đối soát kịch bản theo ma trận | **16 tiêu chí** | 16/16 Đạt giả định | Giả lập chức năng | **ĐÃ THỰC HIỆN MÔ PHỎNG** (Chưa nghiệm thu thực tế) |

---

## 4. CÁC BƯỚC CẦN CON NGƯỜI THỰC HIỆN TIẾP THEO (HUMAN ACTION ITEMS)

1. **Buổi nghiệm thu thực tế với Giảng viên / Người dùng (Formal UAT):**
   - Mở giao diện trên máy tính và thiết bị di động thật.
   - Cho người dùng đóng vai Khách hàng thực hiện luồng: Đăng ký $\rightarrow$ Xem phòng $\rightarrow$ Đặt phòng $\rightarrow$ Quét mã QR demo $\rightarrow$ Kiểm tra trạng thái đơn.
   - Cho người dùng đóng vai Chủ homestay thực hiện luồng: Đăng nhập kênh chủ nhà $\rightarrow$ Duyệt đơn $\rightarrow$ Xác nhận đã nhận tiền mặt.
2. **Kiểm thử Hiệu năng và Tải trọng (Performance / Stress Testing):**
   - Cần cấu hình công cụ `k6` hoặc `JMeter` để kiểm tra độ trễ và khả năng chịu tải khi có đồng thời 50 - 100 người cùng bấm đặt phòng vào các ngày lễ.
3. **Cải thiện độ bao phủ mã nguồn (Code Coverage):**
   - Viết bổ sung các bài unit test cho các hàm khiếu nại (Complaints), quản lý tiện ích (Amenities), và thống kê doanh thu nâng cao trong `admin.service.js` và `owner.service.js` để nâng tỷ lệ Line Coverage từ **60.23%** lên trên **80%**.

