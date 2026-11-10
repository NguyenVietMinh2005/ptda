# BÁO CÁO KIỂM THỬ TÍCH HỢP (INTEGRATION TESTING REPORT)
**Dự án:** Hệ thống Quản lý và Đặt phòng Homestay (PTDA Homestay)  
**Môn học:** Đảm bảo chất lượng & Kiểm thử phần mềm  
**Môi trường thực thi:** Node.js v24.21.0, Native Node Test Runner (`node:test`), Ephemeral Express Server  
**Thời gian thực hiện:** Tháng 10/2026  
**Trạng thái kiểm thử:** 32/32 Test Cases PASSED (Tỷ lệ đạt 100%)  
**Cơ chế dữ liệu:** Tích hợp tầng HTTP Controller $\leftrightarrow$ Middleware $\leftrightarrow$ Service, tầng CSDL Prisma được **Mock trong RAM** (`mockPrisma.js`)  

---

## 1. MỤC TIÊU VÀ PHẠM VI KIỂM THỬ TÍCH HỢP

### 1.1. Mục tiêu
- Kiểm chứng khả năng phối hợp nhịp nhàng giữa các tầng kiến trúc: **HTTP Request / Routing $\leftrightarrow$ Controller $\leftrightarrow$ Validation / Middleware $\leftrightarrow$ Business Services $\leftrightarrow$ Standardized JSON Response**.
- Đảm bảo tính toàn vẹn của chuỗi dữ liệu (Data Pipeline), chu kỳ sống của JWT Token qua HTTP Headers, và sự đồng bộ trạng thái giữa các thực thể liên quan (ví dụ: Booking $\leftrightarrow$ Payment $\leftrightarrow$ Transaction Log).
- Đánh giá khả năng xử lý biệt lệ và phản hồi mã lỗi HTTP chuẩn mực (`400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`).

### 1.2. Cơ chế cách ly dữ liệu
> [!NOTE]
> Để đảm bảo bài kiểm thử chạy nhanh, độc lập và **không làm biến đổi hay bẩn cơ sở dữ liệu thật**, bộ kiểm thử tích hợp sử dụng một ứng dụng Express ảo tạm thời (`createTestApp.js`) kết hợp cùng tầng Mocking `mockPrisma.js`. Như vậy:
> - Các Router, Middleware xác thực, Controller và Service là **code thật 100%**.
> - Tầng truy vấn CSDL Prisma được giả lập kết quả trả về trong bộ nhớ RAM.
> - CSDL vật lý PostgreSQL hoàn toàn không bị ảnh hưởng.

---

## 2. BẢNG DANH MỤC 32 TEST CASES TÍCH HỢP CHI TIẾT

File thực thi: `backend/tests/integration.test.js`. Lệnh chạy độc lập:
```powershell
cd D:\ptda\backend
npm run test:integration
```

### 2.1. Flow 1: Chu trình Xác thực & Quản lý Token (6 Test Cases)
- `INT-AUTH-01`: POST `/api/auth/register` tạo người dùng mới trả về HTTP 201 $\rightarrow$ **PASS**
- `INT-AUTH-02`: Chặn đăng ký khi trùng email trả về HTTP 400 $\rightarrow$ **PASS**
- `INT-AUTH-03`: Đăng nhập thành công trả về JWT token hợp lệ $\rightarrow$ **PASS**
- `INT-AUTH-04`: Đăng nhập sai mật khẩu trả về HTTP 401 $\rightarrow$ **PASS**
- `INT-AUTH-05`: Truy xuất thông tin người dùng qua Bearer Token trả về HTTP 200 $\rightarrow$ **PASS**
- `INT-AUTH-06`: Chặn truy cập khi thiếu Bearer Token trả về HTTP 401 $\rightarrow$ **PASS**

### 2.2. Flow 2: Khởi tạo Đặt phòng & Thuật toán Chống trùng lịch (6 Test Cases)
- `INT-BOOK-01`: POST `/api/homestays/:id/book` chặn khi chưa đăng nhập (HTTP 401) $\rightarrow$ **PASS**
- `INT-BOOK-02`: Từ chối đặt phòng khi ngày trả <= ngày nhận (HTTP 400) $\rightarrow$ **PASS**
- `INT-BOOK-03`: Phát hiện và chặn đơn đặt phòng bị trùng khoảng ngày (HTTP 400) $\rightarrow$ **PASS**
- `INT-BOOK-04`: Tạo đơn đặt phòng hợp lệ và tính tiền tự động (HTTP 201) $\rightarrow$ **PASS**
- `INT-BOOK-05`: Khách hàng tự hủy đơn đặt phòng của mình (HTTP 200) $\rightarrow$ **PASS**
- `INT-BOOK-06`: Chặn khách hủy đơn của người khác (HTTP 403) $\rightarrow$ **PASS**

### 2.3. Flow 3: Chủ Homestay Quản lý & Chuyển trạng thái Booking (4 Test Cases)
- `INT-OWN-01`: PUT `/api/bookings/:id/status` chặn khi thiếu token (HTTP 401) $\rightarrow$ **PASS**
- `INT-OWN-02`: Chặn token khách hàng gọi vào API đổi trạng thái của chủ nhà (HTTP 401/403) $\rightarrow$ **PASS**
- `INT-OWN-03`: Chủ nhà xác nhận đơn đặt phòng thành công (HTTP 200) $\rightarrow$ **PASS**
- `INT-OWN-04`: Báo lỗi khi chuyển đổi trạng thái không hợp lệ (HTTP 400/500) $\rightarrow$ **PASS**

### 2.4. Flow 4: Thanh toán Mô phỏng & Đối soát Giao dịch (6 Test Cases)
- `INT-PAY-01`: GET `/api/bookings/:id/payment-info` lấy thông tin QR demo (HTTP 200) $\rightarrow$ **PASS**
- `INT-PAY-02`: POST `/api/bookings/:id/payment/select-method` chọn tiền mặt (HTTP 200) $\rightarrow$ **PASS**
- `INT-PAY-03`: POST `/api/bookings/:id/payment/simulate` thành công đồng bộ trạng thái đơn (HTTP 200) $\rightarrow$ **PASS**
- `INT-PAY-04`: POST `/api/bookings/:id/payment/simulate` thất bại lưu log FAILED (HTTP 400) $\rightarrow$ **PASS**
- `INT-PAY-05`: Chủ homestay xác nhận đã thu tiền mặt của khách (HTTP 200) $\rightarrow$ **PASS**
- `INT-PAY-06`: GET `/api/bookings/:id/transactions` truy xuất lịch sử giao dịch (HTTP 200) $\rightarrow$ **PASS**

### 2.5. Flow 5: Thẩm định Điều kiện Đánh giá (4 Test Cases)
- `INT-REV-01`: GET `/api/homestays/:id/can-review` chặn khi thiếu token (HTTP 401) $\rightarrow$ **PASS**
- `INT-REV-02`: Trả về `canReview: false` khi khách chưa hoàn thành lưu trú (HTTP 200) $\rightarrow$ **PASS**
- `INT-REV-03`: Từ chối tạo đánh giá khi chưa đủ điều kiện lưu trú (HTTP 400) $\rightarrow$ **PASS**
- `INT-REV-04`: Cho phép tạo đánh giá khi khách đã hoàn tất kỳ nghỉ (HTTP 201) $\rightarrow$ **PASS**

### 2.6. Flow 6: Kiểm duyệt Admin & Hàng rào Phân quyền RBAC (6 Test Cases)
- `INT-ADM-01`: GET `/api/admin/dashboard-stats` chặn khi không có token (HTTP 401) $\rightarrow$ **PASS**
- `INT-ADM-02`: Chặn token khách hàng gọi API admin (HTTP 401) $\rightarrow$ **PASS**
- `INT-ADM-03`: Chặn token chủ nhà thường gọi API admin (HTTP 403 Forbidden) $\rightarrow$ **PASS**
- `INT-ADM-04`: Admin truy xuất bảng số liệu toàn hệ thống thành công (HTTP 200) $\rightarrow$ **PASS**
- `INT-ADM-05`: Admin phê duyệt homestay sang `DaDuyet` (HTTP 200) $\rightarrow$ **PASS**
- `INT-ADM-06`: Admin khóa tài khoản người dùng vi phạm (HTTP 200) $\rightarrow$ **PASS**

---

## 3. ĐÁNH GIÁ CHẤT LƯỢNG VÀ KẾT LUẬN

1. **Tính tương thích giao tiếp**: Dữ liệu trao đổi qua lại giữa Controllers, Services và Middlewares hoàn toàn khớp định dạng (Data Contracts).
2. **Hàng rào bảo mật**: Cơ chế phân quyền RBAC được thực thi đa tầng. Các nỗ lực mạo danh quyền từ phía Khách hàng hoặc Chủ homestay vào vùng quản trị Admin đều bị chặn đứng với mã lỗi `401/403`.
3. **Thời gian thực thi**: 32 bài kiểm thử tích hợp thực thi trọn vẹn trong **~4.2 giây**.
4. **Kết luận**: Cấp độ Kiểm thử Tích hợp (Level 2) hoàn thành với 100% tỷ lệ đạt.
