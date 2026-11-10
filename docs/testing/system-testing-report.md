# BÁO CÁO KIỂM THỬ HỆ THỐNG (SYSTEM TESTING REPORT)
**Dự án:** Hệ thống Quản lý và Đặt phòng Homestay (PTDA Homestay)  
**Môn học:** Đảm bảo chất lượng & Kiểm thử phần mềm  
**Môi trường thực thi Live:**
- **Backend API**: Chạy trên cổng `http://localhost:3000`
- **Frontend SPA**: React 18 / Vite chạy trên cổng `http://localhost:5173`
- **Cơ sở dữ liệu**: PostgreSQL `ptda_homestay` (Service `postgresql-x64-18` live)
- **Tự động hóa Trình duyệt**: Google Chrome qua thư viện `puppeteer-core`  
**Thời gian thực hiện:** Tháng 10/2026  
**Thời lượng thực thi:** ~32.4 giây  
**Trạng thái kiểm thử:** 22/22 Test Cases PASSED (Tỷ lệ đạt 100%)  

---

## 1. MỤC TIÊU VÀ PHẠM VI KIỂM THỬ HỆ THỐNG

### 1.1. Mục tiêu
- Kiểm thử toàn diện hệ thống ở cấp độ tích hợp hoàn chỉnh (End-to-End System Testing), kết nối đồng thời Frontend, Backend và Cơ sở dữ liệu PostgreSQL thực tế đang hoạt động.
- Kiểm tra luồng dữ liệu thông suốt qua giao thức HTTP RESTful API thực tế và giao diện người dùng trên trình duyệt (Browser UI Rendering).
- Chụp ảnh màn hình bằng chứng thực nghiệm (Screenshots) xác nhận giao diện hiển thị đúng chuẩn, không bị vỡ layout, không lỗi render trắng trang và phản hồi người dùng mượt mà.

### 1.2. Phân biệt với Cấp độ 1 & 2
> [!IMPORTANT]
> Đây là **CẤP ĐỘ DUY NHẤT** thực sự kết nối trực tiếp với cơ sở dữ liệu PostgreSQL `ptda_homestay`. Level 1 (Unit) và Level 2 (Integration) hoàn toàn chạy với dữ liệu Mock trong bộ nhớ RAM.

---

## 2. KẾT QUẢ THỰC NGHIỆM 22 SYSTEM TEST CASES

File thực thi: `backend/tests/system-e2e.test.js`. Lệnh chạy (yêu cầu bật 2 server trước):
```powershell
cd D:\ptda\backend
npm run test:system
```

```
✓ Puppeteer Browser initialized with Google Chrome.
▶ Level 3: System Testing (Kiểm thử toàn diện Hệ thống & Giao diện End-to-End)
  ▶ System Scenario 1: Hạ tầng & Kết nối Live Service (180.49ms)
  ▶ System Scenario 2: Khách hàng Khám phá, Tìm kiếm & Xem chi tiết (9118.49ms)
  ▶ System Scenario 3: Xác thực Khách hàng & Kiểm tra quy tắc Đặt phòng (986.19ms)
  ▶ System Scenario 4: Phân hệ Quản trị Chủ Homestay (Host Portal) (4669.19ms)
  ▶ System Scenario 5: Phân hệ Quản trị viên Toàn hệ thống (Admin Portal) (5144.95ms)
  ▶ System Scenario 6: Hàng rào Bảo mật Phân quyền & Phòng thủ Lỗi (1700.94ms)
✔ Level 3: System Testing (Kiểm thử toàn diện Hệ thống & Giao diện End-to-End) (30110.77ms)
ℹ tests 22 | pass 22 | fail 0 | cancelled 0 | skipped 0 | duration 32.38s
```

### Chi tiết 22 Ca Kiểm Thử:
1. `SYS-01`: Backend Server live trên port 3000 phản hồi root $\rightarrow$ **PASS** (154 ms)
2. `SYS-02`: Frontend Vite Server live trên port 5173 phục vụ index.html $\rightarrow$ **PASS** (23 ms)
3. `SYS-03`: Lấy danh sách homestay đã duyệt từ database thật $\rightarrow$ **PASS** (491 ms)
4. `SYS-04`: Lấy chi tiết homestay ID=1 (kèm ảnh và thông tin host) $\rightarrow$ **PASS** (46 ms)
5. `SYS-05`: Lấy ma trận lịch trống phòng của homestay ID=1 $\rightarrow$ **PASS** (30 ms)
6. `SYS-06`: Trình duyệt Chrome tải Trang chủ và chụp ảnh màn hình $\rightarrow$ **PASS** (5218 ms)
7. `SYS-07`: Trình duyệt Chrome tải Trang chi tiết Homestay và chụp ảnh $\rightarrow$ **PASS** (3331 ms)
8. `SYS-08`: Khách hàng đăng nhập tài khoản thực (`user@test.com`) qua API $\rightarrow$ **PASS** (924 ms)
9. `SYS-09`: Khách hàng lấy thông tin cá nhân qua JWT token $\rightarrow$ **PASS** (19 ms)
10. `SYS-10`: Đặt phòng 0 đêm bị chặn tại backend live $\rightarrow$ **PASS** (28 ms)
11. `SYS-11`: Đặt phòng vượt quá sức chứa tối đa bị chặn tại backend live $\rightarrow$ **PASS** (14 ms)
12. `SYS-12`: Chủ homestay đăng nhập tài khoản thực (`seed.owner@test.com`) $\rightarrow$ **PASS** (837 ms)
13. `SYS-13`: Chủ homestay truy vấn danh sách homestay sở hữu $\rightarrow$ **PASS** (44 ms)
14. `SYS-14`: Chủ homestay truy xuất số liệu thống kê dashboard $\rightarrow$ **PASS** (27 ms)
15. `SYS-15`: Trình duyệt render Host Dashboard và chụp ảnh $\rightarrow$ **PASS** (3760 ms)
16. `SYS-16`: Quản trị viên đăng nhập cổng quản trị (`admin@test.com`) $\rightarrow$ **PASS** (857 ms)
17. `SYS-17`: Admin truy xuất bảng số liệu toàn sàn $\rightarrow$ **PASS** (611 ms)
18. `SYS-18`: Admin truy xuất danh sách người dùng $\rightarrow$ **PASS** (27 ms)
19. `SYS-19`: Trình duyệt render Admin Dashboard và chụp ảnh $\rightarrow$ **PASS** (3650 ms)
20. `SYS-20`: Khách hàng cố tình gọi API Admin bị chặn 401/403 $\rightarrow$ **PASS** (855 ms)
21. `SYS-21`: Chủ homestay cố tình gọi API Admin bị chặn 403 Forbidden $\rightarrow$ **PASS** (840 ms)
22. `SYS-22`: Gọi route không tồn tại trả về 404 sạch sẽ, không crash server $\rightarrow$ **PASS** (5 ms)

---

## 3. BẰNG CHỨNG HÌNH ẢNH GIAO DIỆN ĐÃ ĐỐI SOÁT (SCREENSHOT AUDIT)

Sau khi xử lý chuẩn hóa định tuyến (`/homestays/1` thay vì `/homestay/1`) và nạp session xác thực hợp lệ vào `localStorage`, toàn bộ 4 file ảnh chụp màn hình đều có dung lượng thực tế hợp lý và nội dung rõ ràng:

| Tên File Ảnh | Kích Thước File | Nội Dung Giao Diện Được Xác Minh |
| :--- | :---: | :--- |
| `01_customer_home.png` | **838,964 bytes** (~839 KB) | Trang chủ người dùng với thanh tìm kiếm, bộ lọc địa điểm và lưới thẻ homestay hiển thị đầy đủ hình ảnh, giá thuê niêm yết từ PostgreSQL. |
| `02_homestay_detail.png`| **675,856 bytes** (~676 KB) | Trang chi tiết homestay ID=1 hiển thị đầy đủ bộ sưu tập ảnh phòng, thông tin chủ nhà, mô tả tiện ích, form chọn ngày và tính tổng tiền. |
| `03_owner_dashboard.png`| **166,030 bytes** (~166 KB) | Bảng điều khiển Chủ nhà với sidebar chuyên biệt, các thẻ KPI thống kê doanh thu (16.550.000đ), đơn chờ duyệt và danh sách booking. |
| `04_admin_dashboard.png`| **139,647 bytes** (~140 KB) | Bảng điều khiển Quản trị viên với sidebar Admin, tổng số homestay toàn hệ thống, danh sách người dùng và bảng phê duyệt hồ sơ. |

> [!NOTE]
> Báo cáo ban đầu từng xuất hiện 3 file ảnh dung lượng ~4.7 KB (ảnh trắng) do lỗi sai đường dẫn `/homestay/1` và thiếu session lưu trong `localStorage`. Vấn đề này đã được khắc phục triệt để.

---

## 4. KẾT LUẬN KIỂM THỬ HỆ THỐNG

1. Toàn bộ 22 kịch bản hệ thống đã chạy thành công trên môi trường live kết nối PostgreSQL thật.
2. Các lỗi định tuyến và render trắng trang của Puppeteer đã được rà soát và xử lý dứt điểm.
3. Cấp độ Kiểm thử Hệ thống (Level 3) hoàn thành đạt 100%.
