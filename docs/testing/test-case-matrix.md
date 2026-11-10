# MA TRẬN TỔNG HỢP CÁC CA KIỂM THỬ (MASTER TEST CASE MATRIX)
**Dự án:** Hệ thống Quản lý và Đặt phòng Homestay (PTDA Homestay)  
**Môn học:** Đảm bảo chất lượng & Kiểm thử phần mềm  
**Phân loại:**
- **158 Ca kiểm thử tự động (Automated Executable Tests)**: Viết bằng code Node.js test runner (`node:test`).
- **16 Tiêu chí chấp nhận mô phỏng (Simulated UAT Criteria)**: Đối soát chức năng người dùng.  
**Trạng thái chung:** 158/158 Automated Tests PASSED (100%), 16/16 UAT Criteria ACHIEVED  

---

## 1. BẢNG THỐNG KÊ TỔNG QUAN THEO CẤP ĐỘ

| Cấp độ Kiểm thử | Hình thức Kiểm thử | Số lượng | Đạt (Pass) | Thất bại (Fail) | Cơ chế CSDL | Thời gian Chạy |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Level 1: Unit Testing** | Tự động (`node:test`) | **104** | 104 | 0 | Mock trong RAM | ~3.6s |
| **Level 2: Integration Testing** | Tự động (`node:test`) | **32** | 32 | 0 | Mock trong RAM | ~4.2s |
| **Level 3: System Testing** | Tự động E2E (`puppeteer-core`) | **22** | 22 | 0 | PostgreSQL thật | ~32.4s |
| **TỔNG TEST TỰ ĐỘNG CHẠY CODE** | **Mã nguồn thực thi** | **158** | **158** | **0** | **-** | **~40.2s** |
| **Level 4: Acceptance Testing** | Đối soát kịch bản mô phỏng | **16** | 16 | 0 | Giả lập chức năng | Thủ công |
| **TỔNG DANH MỤC THẨM ĐỊNH** | **Toàn bộ hệ thống** | **174** | **174** | **0** | **-** | **-** |

---

## 2. MA TRẬN CHI TIẾT 158 AUTOMATED TEST CASES

### 2.1. Level 1: Unit Testing (104 Test Cases - 100% Mock RAM)
*Bao gồm 6 file test:*
1. `booking.service.test.js` (27 tests): `UNIT-BKG-01` $\rightarrow$ `UNIT-BKG-27` (Kiểm tra logic đặt phòng, tính tiền, chặn 0 đêm, chống đặt trùng lịch).
2. `auth.service.test.js` (13 tests): `UNIT-AUT-01` $\rightarrow$ `UNIT-AUT-13` (Đăng ký, băm bcrypt, đăng nhập, JWT, chặn tài khoản khóa).
3. `auth.middleware.test.js` (18 tests): `UNIT-MID-01` $\rightarrow$ `UNIT-MID-18` (Header Bearer, verifyOwner, verifyAdmin, bảo vệ đa tầng).
4. `homestay.admin.test.js` (13 tests): `UNIT-HMS-01` $\rightarrow$ `UNIT-HMS-13` (Admin duyệt/từ chối homestay, chủ nhà thêm/sửa cơ sở lưu trú).
5. `review.service.test.js` (7 tests): `UNIT-REV-01` $\rightarrow$ `UNIT-REV-07` (Chặn review khi chưa hoàn tất lưu trú, tính điểm trung bình sao).
6. `payment.service.test.js` (26 tests): `UNIT-PAY-01` $\rightarrow$ `UNIT-PAY-26` (Mô phỏng QR demo, chọn tiền mặt, đồng bộ trạng thái thanh toán và booking).

### 2.2. Level 2: Integration Testing (32 Test Cases - 100% Mock RAM)
*File thực thi: `integration.test.js` (Chạy trên Express App ảo cổng 0)*
- Flow 1: `INT-AUTH-01` $\rightarrow$ `INT-AUTH-06` (6 tests - Chu trình xác thực, đăng ký, đăng nhập và lấy profile qua token).
- Flow 2: `INT-BOOK-01` $\rightarrow$ `INT-BOOK-06` (6 tests - Ràng buộc đặt phòng, kiểm tra ngày giao thoa, tự hủy đơn).
- Flow 3: `INT-OWN-01` $\rightarrow$ `INT-OWN-04` (4 tests - Chủ nhà xác nhận/từ chối đơn đặt, kiểm tra quyền sở hữu).
- Flow 4: `INT-PAY-01` $\rightarrow$ `INT-PAY-06` (6 tests - Thanh toán mô phỏng thành công/thất bại, xác nhận thu tiền mặt, ghi sổ cái giao dịch).
- Flow 5: `INT-REV-01` $\rightarrow$ `INT-REV-04` (4 tests - Thẩm định điều kiện đánh giá theo trạng thái đơn).
- Flow 6: `INT-ADM-01` $\rightarrow$ `INT-ADM-06` (6 tests - Admin duyệt homestay, khóa tài khoản, hàng rào RBAC chặn host/khách gọi API admin).

### 2.3. Level 3: System Testing (22 Scenarios - Live Express & PostgreSQL)
*File thực thi: `system-e2e.test.js` (Kết nối `:3000`, `:5173`, PostgreSQL thật, Chrome Headless)*
- Kịch bản 1: `SYS-01`, `SYS-02` (Kết nối hạ tầng mạng và phản hồi server live).
- Kịch bản 2: `SYS-03`, `SYS-04`, `SYS-05`, `SYS-06`, `SYS-07` (Khám phá homestay, xem chi tiết, chụp ảnh `01_customer_home.png` và `02_homestay_detail.png`).
- Kịch bản 3: `SYS-08`, `SYS-09`, `SYS-10`, `SYS-11` (Đăng nhập tài khoản khách `user@test.com`, kiểm tra ràng buộc ngày và khách).
- Kịch bản 4: `SYS-12`, `SYS-13`, `SYS-14`, `SYS-15` (Chủ nhà đăng nhập `seed.owner@test.com`, xem homestay, xem doanh thu, chụp ảnh `03_owner_dashboard.png`).
- Kịch bản 5: `SYS-16`, `SYS-17`, `SYS-18`, `SYS-19` (Admin đăng nhập `admin@test.com`, xem thống kê toàn sàn, xem users, chụp ảnh `04_admin_dashboard.png`).
- Kịch bản 6: `SYS-20`, `SYS-21`, `SYS-22` (Chặn khách và chủ nhà truy cập API admin, xử lý 404 sạch sẽ).

---

## 3. DANH MỤC 16 TIÊU CHÍ CHẤP NHẬN MÔ PHỎNG (UAT)

1. `UAT-CUS-01`: Khám phá và lọc homestay theo địa điểm/giá $\rightarrow$ **ĐẠT**
2. `UAT-CUS-02`: Xem ma trận lịch phòng trống $\rightarrow$ **ĐẠT**
3. `UAT-CUS-03`: Đặt phòng với tự động tính tiền theo số đêm $\rightarrow$ **ĐẠT**
4. `UAT-CUS-04`: Thanh toán QR mô phỏng trực tuyến $\rightarrow$ **ĐẠT**
5. `UAT-CUS-05`: Lựa chọn thanh toán tiền mặt khi nhận phòng $\rightarrow$ **ĐẠT**
6. `UAT-CUS-06`: Quản lý danh sách đơn trong "Đặt phòng của tôi" $\rightarrow$ **ĐẠT**
7. `UAT-CUS-07`: Viết đánh giá sau khi hoàn tất lưu trú $\rightarrow$ **ĐẠT**
8. `UAT-OWN-01`: Cổng đăng nhập Host độc lập $\rightarrow$ **ĐẠT**
9. `UAT-OWN-02`: Dashboard thống kê doanh thu và đơn đặt $\rightarrow$ **ĐẠT**
10. `UAT-OWN-03`: Duyệt hoặc từ chối đơn đặt phòng của khách $\rightarrow$ **ĐẠT**
11. `UAT-OWN-04`: Xác nhận đã thu tiền mặt khi khách đến nhận phòng $\rightarrow$ **ĐẠT**
12. `UAT-OWN-05`: Thêm mới và quản lý danh sách homestay sở hữu $\rightarrow$ **ĐẠT**
13. `UAT-ADM-01`: Dashboard quản trị tổng quan toàn sàn $\rightarrow$ **ĐẠT**
14. `UAT-ADM-02`: Phê duyệt hoặc từ chối homestay mới đăng ký $\rightarrow$ **ĐẠT**
15. `UAT-ADM-03`: Quản lý danh mục tài khoản người dùng $\rightarrow$ **ĐẠT**
16. `UAT-ADM-04`: Hàng rào an ninh ngăn chặn truy cập trái phép vào Admin $\rightarrow$ **ĐẠT**
