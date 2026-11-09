# BÁO CÁO KIỂM THỬ HỘP TRẮNG (WHITE-BOX TESTING REPORT)
## ĐỒ ÁN MÔN HỌC: KIỂM THỬ PHẦN MỀM & PHÁT TRIỂN DỰ ÁN
### HỆ THỐNG ĐẶT PHÒNG & QUẢN LÝ HOMESTAY TRỰC TUYẾN (PTDA HOMESTAY)

> **Nhóm thực hiện:** Nhóm 16  
> **Dự án kiểm thử:** PTDA Homestay (`D:\ptda`)  
> **Công nghệ:** Node.js v24, Express, Prisma ORM, PostgreSQL, React 19, Vite  
> **Framework kiểm thử:** Node.js Native Test Runner (`node:test`, `node:assert/strict`) & V8 Coverage Engine  
> **Thời điểm thực hiện kiểm thử:** Tháng 10/2026  
> **Trạng thái:** 104/104 Test Cases PASSED (Tỷ lệ đạt 100%)  

---

## 1. MỤC TIÊU VÀ PHẠM VI KIỂM THỬ

### 1.1 Mục tiêu
1. Thực hiện phương pháp **Kiểm thử hộp trắng (White-Box Testing)** dựa trên cấu trúc mã nguồn thực tế của dự án.
2. Kiểm tra cặn kẽ các nhánh điều kiện rẽ nhánh (`if / else / switch`), các luồng xác thực, kiểm tra quyền sở hữu dữ liệu, điều kiện biên của ngày tháng và quy tắc chuyển đổi trạng thái nghiệp vụ (State Machine).
3. Đảm bảo an toàn tuyệt đối cho cơ sở dữ liệu `ptda_homestay`: toàn bộ phụ thuộc tầng dữ liệu (Prisma Client) và chữ ký số (JWT) được Mock hóa cô lập (In-Memory Mocking Isolation), không làm biến đổi bất kỳ bản ghi nào trong database thật.
4. Đo lường chính xác các chỉ số bao phủ mã nguồn: **Statement Coverage**, **Branch Coverage**, **Function Coverage**, và **Line Coverage** thông qua engine đo lường V8 tích hợp.

### 1.2 Phạm vi kiểm thử
Kiểm thử tập trung vào 6 nhóm chức năng nghiệp vụ trọng yếu nhất của Backend theo đúng thứ tự ưu tiên:
1. **Kiểm tra ngày đặt phòng và thuật toán chống đặt trùng lịch (Anti-Overbooking Conflict Prevention):** Hàm `bookHomestay` (`homestay.service.js`), `updateBookingStatus`, `cancelMyBooking`, `createComplaint` (`booking.service.js`).
2. **Đăng nhập và xác thực danh tính (Authentication):** Khách hàng (`registerUser`, `loginUser` trong `auth.service.js`) và Chủ homestay (`registerOwner`, `loginOwner` trong `owner.service.js`).
3. **Phân quyền truy cập các vai trò (Role Authorization Middlewares):** Khách hàng (`protect`), Chủ homestay (`protectOwner`), Quản trị viên (`protectAdmin`), và cổng truy cập chung (`protectAny`).
4. **Quản lý, kiểm duyệt và ẩn/xóa homestay (Homestay Moderation & Management):** Duyệt/từ chối homestay (`updateHomestayApproval`), xóa mềm bởi chủ nhà (`deleteHomestay`), xóa cứng bởi Admin, khóa/mở tài khoản (`updateUserStatus`, `updateOwnerStatus`).
5. **Điều kiện tạo đánh giá sau hoàn thành kỳ nghỉ (Review Eligibility):** Kiểm tra khách hàng có đơn hoàn thành (`checkCanReview`), cập nhật đánh giá cũ hoặc tạo mới (`createReview` trong `homestay.service.js`).
6. **Thanh toán mô phỏng và cập nhật trạng thái đơn đặt phòng (Demo Payment Flow):** Lấy thông tin & sinh mã QR VietQR demo (`getPaymentInfo`), chọn phương thức (`selectPaymentMethod`), mô phỏng kết quả (`simulatePayment`), xác nhận thu tiền mặt (`confirmCashPayment`), xem lịch sử giao dịch (`getBookingTransactions`).

---

## 2. DANH SÁCH MODULE VÀ HÀM ĐƯỢC KIỂM THỬ

| STT | File mã nguồn | Tên hàm kiểm thử | Chức năng nghiệp vụ chính |
| :---: | :--- | :--- | :--- |
| 1 | `backend/src/services/homestay.service.js` | `bookHomestay` | Kiểm tra tồn tại, phê duyệt, số khách, ngày nhận/trả, thuật toán chống trùng lịch và tính tiền |
| 2 | `backend/src/services/booking.service.js` | `updateBookingStatus` | Máy trạng thái đơn đặt phòng: ChoXacNhan $\rightarrow$ DaXacNhan $\rightarrow$ DangLuuTru $\rightarrow$ DaHoanThanh / DaHuy |
| 3 | `backend/src/services/booking.service.js` | `cancelMyBooking` | Khách hàng tự hủy đơn đang ở trạng thái Chờ xác nhận |
| 4 | `backend/src/services/booking.service.js` | `createComplaint` | Khách gửi khiếu nại đơn phòng, kiểm tra quyền sở hữu và chống khiếu nại trùng |
| 5 | `backend/src/services/auth.service.js` | `registerUser` | Kiểm tra email duy nhất, băm mật khẩu bcrypt và tạo tài khoản khách |
| 6 | `backend/src/services/auth.service.js` | `loginUser` | Kiểm tra tồn tại email, trạng thái khóa, khớp mật khẩu và ký JWT token |
| 7 | `backend/src/services/owner.service.js` | `registerOwner` | Kiểm tra trùng Email, trùng CCCD, băm mật khẩu và tạo chủ nhà |
| 8 | `backend/src/services/owner.service.js` | `loginOwner` | Xác thực đăng nhập chủ nhà/admin, kiểm tra mật khẩu và ký JWT kèm role |
| 9 | `backend/src/middlewares/auth.middleware.js` | `protect` | Middleware bảo vệ route khách hàng, kiểm tra Bearer token, giải mã và gắn `req.user` |
| 10 | `backend/src/middlewares/auth.middleware.js` | `protectAny` | Middleware xác thực linh hoạt cho cả Khách hàng và Chủ nhà |
| 11 | `backend/src/middlewares/owner.middleware.js`| `protectOwner` | Middleware bảo vệ route chủ homestay |
| 12 | `backend/src/middlewares/admin.middleware.js`| `protectAdmin` | Middleware kiểm tra quyền Quản trị viên (`Quyen === 'admin'`) |
| 13 | `backend/src/services/admin.service.js` | `updateHomestayApproval` | Admin duyệt (`DaDuyet`) hoặc từ chối (`TuChoi`) homestay |
| 14 | `backend/src/services/admin.service.js` | `deleteHomestay` | Admin xóa homestay khỏi hệ thống |
| 15 | `backend/src/services/admin.service.js` | `updateUserStatus` | Admin khóa/mở khóa tài khoản khách hàng |
| 16 | `backend/src/services/admin.service.js` | `updateOwnerStatus`| Admin khóa/mở khóa tài khoản chủ homestay |
| 17 | `backend/src/services/homestay.service.js` | `deleteHomestay` | Chủ nhà xóa mềm homestay (`isActive = false`) |
| 18 | `backend/src/services/homestay.service.js` | `createReview` | Kiểm tra điều kiện đơn hoàn thành, cập nhật đánh giá cũ hoặc tạo mới |
| 19 | `backend/src/services/homestay.service.js` | `checkCanReview` | Kiểm tra nhanh khách có đủ điều kiện đánh giá homestay hay không |
| 20 | `backend/src/services/payment.service.js` | `getPaymentInfo` | Lấy chi tiết đơn phòng, hạn chế thanh toán và tạo mã QR VietQR demo |
| 21 | `backend/src/services/payment.service.js` | `selectPaymentMethod`| Chọn phương thức Tiền mặt / Chuyển khoản QR, tạo giao dịch `ChoThanhToan` |
| 22 | `backend/src/services/payment.service.js` | `simulatePayment` | Mô phỏng thanh toán online Thành công hoặc Thất bại, cập nhật đơn |
| 23 | `backend/src/services/payment.service.js` | `confirmCashPayment` | Chủ nhà / Admin xác nhận đã nhận tiền mặt từ khách khi nhận phòng |
| 24 | `backend/src/services/payment.service.js` | `getBookingTransactions` | Lấy danh sách lịch sử giao dịch gắn với đơn đặt phòng |

---

## 3. KỸ THUẬT KIỂM THỬ HỘP TRẮNG ĐÃ ÁP DỤNG

1. **Kiểm thử bao phủ nhánh (Branch / Decision Coverage):**  
   Mỗi câu lệnh rẽ nhánh `if / else` đều được thiết kế tối thiểu 2 ca kiểm thử (một ca làm điều kiện nhận giá trị `true`, một ca làm điều kiện nhận giá trị `false`).
2. **Kiểm thử bao phủ câu lệnh (Statement Coverage):**  
   Đảm bảo mọi dòng lệnh xử lý nghiệp vụ, tính toán tiền tệ, và cập nhật cơ sở dữ liệu đều được thực thi ít nhất một lần.
3. **Phân tích giá trị biên (Boundary Value Analysis):**  
   - Kiểm tra số khách: `soLuongKhach = homestay.SoKhachToiDa` (Hợp lệ) và `soLuongKhach = homestay.SoKhachToiDa + 1` (Bị chặn).  
   - Kiểm tra số đêm: `NgayNhan = NgayTra` ($\text{số đêm} = 0 \rightarrow$ Bị chặn), `NgayTra < NgayNhan` ($\text{số đêm} < 0 \rightarrow$ Bị chặn).
4. **Kiểm thử điều kiện phức hợp (Multiple Condition Coverage):**  
   Áp dụng vào thuật toán phát hiện xung đột lịch phòng:  
   $$\text{Conflict} \iff (NgayNhan_{cũ} < NgayTra_{mới}) \land (NgayTra_{cũ} > NgayNhan_{mới})$$  
   Đã kiểm tra các trường hợp: hoàn toàn trước khoảng đặt, trùng một phần đầu, trùng một phần đuôi, nằm gọn bên trong, và bao trọn khoảng thời gian đặt.
5. **Kiểm thử chuyển đổi trạng thái (State Transition Testing):**  
   Kiểm tra tính toàn vẹn của vòng đời đơn đặt phòng theo đồ thị trạng thái:
   - Hợp lệ: `ChoXacNhan` $\rightarrow$ `DaXacNhan` $\rightarrow$ `DangLuuTru` $\rightarrow$ `DaHoanThanh`
   - Hợp lệ: `ChoXacNhan` $\rightarrow$ `DaHuy`
   - Bất hợp lệ (Bị chặn): `ChoXacNhan` $\rightarrow$ `DangLuuTru` (Lỗi: Chưa xác nhận)
   - Bất hợp lệ (Bị chặn): `DaHoanThanh` $\rightarrow$ `DaHuy` (Lỗi: Đã hoàn thành kỳ nghỉ)
6. **Mô hình cô lập giả lập (Mocking Isolation Pattern):**  
   Tạo module `tests/helpers/mockPrisma.js` để intercept các lời gọi hàm của Prisma Client và Database Transaction, đảm bảo kiểm thử chạy nhanh, độc lập, không phụ thuộc vào trạng thái mạng hay database thực tế.

---

## 4. BẢNG TEST CASES CHI TIẾT (104 TEST CASES)

### 4.1 Nhóm 1: Đặt phòng & Chống trùng lịch (`booking.service.test.js` - 27 Test Cases)

| Mã Test Case | Hàm / Module | Nhánh / Điều kiện kiểm tra | Dữ liệu đầu vào (Input) | Kết quả mong đợi (Expected) | Kết quả thực tế | Đánh giá |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-BOOK-01** | `bookHomestay` | `!homestay` (Không tìm thấy) | `homestayId: 999` (DB trả về `null`) | Báo lỗi `'Không tìm thấy homestay'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-BOOK-02** | `bookHomestay` | `homestay.isActive === false` | Homestay có `isActive: false` | Báo lỗi `'Homestay hiện không nhận đặt phòng'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-BOOK-03** | `bookHomestay` | `TrangThaiDuyet !== 'DaDuyet'` | Homestay có `TrangThaiDuyet: 'ChoDuyet'` | Báo lỗi `'Homestay hiện không nhận đặt phòng'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-BOOK-04** | `bookHomestay` | `soLuongKhach > SoKhachToiDa` | Sức chứa 2 người, khách nhập 5 | Báo lỗi `'Số lượng khách vượt quá mức cho phép'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-BOOK-05** | `bookHomestay` | `isNaN(dates)` | `ngayNhan: 'invalid-date'` | Báo lỗi `'Ngày nhận hoặc ngày trả phòng không hợp lệ'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-BOOK-06** | `bookHomestay` | `soDem <= 0` (Trả trước hoặc cùng ngày) | `ngayNhan: '2026-11-05'`, `ngayTra: '2026-11-05'` | Báo lỗi `'Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-BOOK-07** | `bookHomestay` | `conflictBooking` phát hiện trùng lịch | Đã có đơn xác nhận từ 02/11 đến 06/11, đặt mới 03/11 đến 05/11 | Báo lỗi `'Khoảng thời gian này đã có khách đặt hoặc đang chờ xác nhận...'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-BOOK-08** | `bookHomestay` | Thành công, tính tiền chính xác | Giá 600k/đêm, đặt 3 đêm (01/11 - 04/11), 3 khách | Tạo đơn `ChoXacNhan`, `ChuaThanhToan`, `Gia: 1800000` | Trả về đơn đặt và chi tiết phòng chính xác | **PASS** |
| **TC-UB-01** | `updateBookingStatus` | `!allowedStatuses.includes` | Trạng thái mới: `'TrangThaiTamBho'` | Báo lỗi `'Trạng thái cập nhật không hợp lệ'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-UB-02** | `updateBookingStatus` | `!booking` / Không phải chủ homestay | `bookingId: 999`, `ownerId: 1` | Báo lỗi `'Không tìm thấy đơn đặt, hoặc bạn không có quyền quản lý đơn này'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-UB-03** | `updateBookingStatus` | Xác nhận đơn không ở trạng thái ChoXacNhan | Đơn đang ở `DaHuy`, chuyển sang `DaXacNhan` | Báo lỗi `'Chỉ có thể xác nhận đơn đặt phòng đang ở trạng thái Chờ xác nhận'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-UB-04** | `updateBookingStatus` | Xác nhận đơn nhưng bị trùng lịch với đơn khác | Đơn khác đã được duyệt trong khoảng ngày | Báo lỗi `'Không thể xác nhận đơn này vì đã có đơn khác được xác nhận...'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-UB-05** | `updateBookingStatus` | Xác nhận đơn hợp lệ | Đơn `ChoXacNhan`, không có xung đột lịch | Cập nhật `TrangThai: 'DaXacNhan'` | Trả về đơn đã cập nhật `DaXacNhan` | **PASS** |
| **TC-UB-06** | `updateBookingStatus` | Chuyển `DangLuuTru` khi chưa xác nhận | Đơn đang ở `ChoXacNhan` | Báo lỗi `'Chỉ có thể chuyển sang Đang lưu trú khi đơn đã được xác nhận'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-UB-07** | `updateBookingStatus` | Chuyển `DangLuuTru` hợp lệ | Đơn đang ở `DaXacNhan` | Cập nhật `TrangThai: 'DangLuuTru'` | Trả về đơn `DangLuuTru` | **PASS** |
| **TC-UB-08** | `updateBookingStatus` | Hoàn thành đơn khi chưa qua xác nhận | Đơn đang ở `ChoXacNhan` | Báo lỗi `'Chỉ có thể hoàn thành đơn đã được xác nhận hoặc đang lưu trú'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-UB-09** | `updateBookingStatus` | Hoàn thành đơn hợp lệ | Đơn đang ở `DangLuuTru` | Cập nhật `TrangThai: 'DaHoanThanh'` | Trả về đơn `DaHoanThanh` | **PASS** |
| **TC-UB-10** | `updateBookingStatus` | Hủy đơn đã hoàn thành lưu trú | Đơn đang ở `DaHoanThanh` | Báo lỗi `'Không thể hủy đơn đặt phòng đã hoàn thành lưu trú'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-UB-11** | `updateBookingStatus` | Hủy đơn hợp lệ | Đơn đang ở `ChoXacNhan` | Cập nhật `TrangThai: 'DaHuy'` | Trả về đơn `DaHuy` | **PASS** |
| **TC-CB-01** | `cancelMyBooking` | `!booking` | `bookingId: 999` không tồn tại | Báo lỗi `'Không tìm thấy đơn đặt phòng'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-CB-02** | `cancelMyBooking` | `booking.MaNguoiDung !== userId` | Khách A hủy đơn của khách B | Báo lỗi `'Bạn không có quyền hủy đơn này'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-CB-03** | `cancelMyBooking` | `TrangThai !== 'ChoXacNhan'` | Khách hủy đơn đã `DaXacNhan` | Báo lỗi `'Không thể hủy đơn đã được xác nhận hoặc đã bị hủy'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-CB-04** | `cancelMyBooking` | Khách tự hủy đơn hợp lệ | Đơn của chính khách đang `ChoXacNhan` | Cập nhật `TrangThai: 'DaHuy'` | Trả về đơn `DaHuy` | **PASS** |
| **TC-CMP-01** | `createComplaint` | `!booking` | `bookingId: 999` không tồn tại | Báo lỗi `'Không tìm thấy đơn đặt phòng'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-CMP-02** | `createComplaint` | `booking.MaNguoiDung !== userId` | Khách gửi khiếu nại đơn của người khác | Báo lỗi `'Bạn không có quyền khiếu nại đơn này'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-CMP-03** | `createComplaint` | `existingComplaint` đã tồn tại | Gửi khiếu nại lần 2 cho cùng 1 đơn | Báo lỗi `'Bạn đã khiếu nại đơn này rồi'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-CMP-04** | `createComplaint` | Khiếu nại hợp lệ | Khách gửi nội dung khiếu nại lần đầu | Tạo bản ghi `kHIEU_NAI` với trạng thái `ChuaXuLy` | Trả về khiếu nại mới thành công | **PASS** |

### 4.2 Nhóm 2: Đăng ký & Đăng nhập (`auth.service.test.js` - 13 Test Cases)

| Mã Test Case | Hàm / Module | Nhánh / Điều kiện kiểm tra | Dữ liệu đầu vào (Input) | Kết quả mong đợi (Expected) | Kết quả thực tế | Đánh giá |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-REG-01** | `registerUser` | Email khách hàng đã tồn tại | `email: 'duplicate@test.com'` | Báo lỗi `'Email đã tồn tại'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-AUTH-REG-02** | `registerUser` | Đăng ký khách hàng thành công | Dữ liệu hợp lệ, mật khẩu chưa băm | Băm mật khẩu, xóa `MatKhau` trước khi trả về | Trả về user an toàn không kèm mật khẩu | **PASS** |
| **TC-AUTH-LOG-01** | `loginUser` | Email khách không tồn tại | `email: 'notfound@test.com'` | Báo lỗi `'Email không tồn tại'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-AUTH-LOG-02** | `loginUser` | Tài khoản khách bị khóa (`isActive: false`)| User có `isActive: false` | Báo lỗi `'Tài khoản của bạn đã bị khóa'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-AUTH-LOG-03** | `loginUser` | Sai mật khẩu đăng nhập | Nhập `'WrongPassword'` | Báo lỗi `'Mật khẩu không chính xác'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-AUTH-LOG-04** | `loginUser` | Đăng nhập khách thành công | Email & mật khẩu chính xác | Trả về user (đã xóa mật khẩu) & JWT chứa `userId` | Đăng nhập thành công, token hợp lệ | **PASS** |
| **TC-OWN-REG-01** | `registerOwner` | Email chủ homestay đã tồn tại | `email: 'existing@owner.com'` | Báo lỗi `'Email đã tồn tại'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-OWN-REG-02** | `registerOwner` | Số CCCD chủ homestay đã tồn tại | `soCCCD: '001234567890'` | Báo lỗi `'Số CCCD đã tồn tại'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-OWN-REG-03** | `registerOwner` | Đăng ký chủ homestay thành công | Dữ liệu hợp lệ, CCCD mới | Tạo chủ nhà, băm mật khẩu, xóa trường `MatKhau` | Trả về newOwner thành công | **PASS** |
| **TC-OWN-LOG-01** | `loginOwner` | Email chủ homestay không tồn tại | `email: 'unknown@owner.com'` | Báo lỗi `'Email không tồn tại'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-OWN-LOG-02** | `loginOwner` | Tài khoản chủ nhà bị khóa | Chủ nhà có `isActive: false` | Báo lỗi `'Tài khoản của bạn đã bị khóa'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-OWN-LOG-03** | `loginOwner` | Thiếu mật khẩu đăng nhập | `password: ''` | Báo lỗi `'Mật khẩu không chính xác'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-OWN-LOG-04** | `loginOwner` | Đăng nhập chủ nhà/admin thành công | Mật khẩu chính xác | Trả về owner & JWT chứa `ownerId` và `role` | Token hợp lệ chứa đúng role admin/host | **PASS** |

### 4.3 Nhóm 3: Middleware Phân quyền (`auth.middleware.test.js` - 18 Test Cases)

| Mã Test Case | Hàm / Module | Nhánh / Điều kiện kiểm tra | Dữ liệu đầu vào (Input) | Kết quả mong đợi (Expected) | Kết quả thực tế | Đánh giá |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-MID-CUST-01** | `protect` | Không có header Authorization | `req.headers: {}` | Mã HTTP 401: `'Không tìm thấy token...'` | Status 401, không gọi next() | **PASS** |
| **TC-MID-CUST-02** | `protect` | Token giả mạo hoặc hết hạn | `Bearer invalid.token.value` | Mã HTTP 401: `'Token không hợp lệ hoặc đã hết hạn.'` | Status 401, bắt đúng ngoại lệ JWT | **PASS** |
| **TC-MID-CUST-03** | `protect` | ID trong token không có trong DB | Token giải mã `userId: 999` (không thấy trong DB) | Mã HTTP 401: `'Người dùng không tồn tại.'` | Status 401 | **PASS** |
| **TC-MID-CUST-04** | `protect` | Tài khoản khách hàng đã bị khóa | User trong DB có `isActive: false` | Mã HTTP 403: `'Tài khoản đã bị khóa.'` | Status 403 Forbidden | **PASS** |
| **TC-MID-CUST-05** | `protect` | Khách hàng hợp lệ | Token chuẩn của khách hàng đang active | Gán `req.user = currentUser`, gọi `next()` | `req.user` đầy đủ, `next()` được gọi | **PASS** |
| **TC-MID-OWN-01** | `protectOwner` | Thiếu token | `req.headers: {}` | Mã HTTP 401: `'Không tìm thấy token...'` | Status 401 | **PASS** |
| **TC-MID-OWN-02** | `protectOwner` | Chủ nhà không tồn tại | Token chứa `ownerId: 888` | Mã HTTP 401: `'Chủ homestay không tồn tại.'` | Status 401 | **PASS** |
| **TC-MID-OWN-03** | `protectOwner` | Tài khoản chủ nhà bị khóa | Chủ nhà có `isActive: false` | Mã HTTP 403: `'Tài khoản đã bị khóa.'` | Status 403 | **PASS** |
| **TC-MID-OWN-04** | `protectOwner` | Chủ nhà hợp lệ | Token chuẩn của chủ homestay | Gán `req.owner = currentOwner`, gọi `next()` | `req.owner` đầy đủ, `next()` được gọi | **PASS** |
| **TC-MID-ADM-01** | `protectAdmin` | Thiếu token | `req.headers: {}` | Mã HTTP 401: `'Không tìm thấy token.'` | Status 401 | **PASS** |
| **TC-MID-ADM-02** | `protectAdmin` | User không tồn tại trong bảng chủ nhà | Token chứa `ownerId: 777` | Mã HTTP 401: `'Người dùng không tồn tại.'` | Status 401 | **PASS** |
| **TC-MID-ADM-03** | `protectAdmin` | Có tài khoản nhưng không phải Admin | User có `Quyen: 'chu_homestay'` | Mã HTTP 403: `'Không có quyền truy cập.'` | Status 403, chặn chủ nhà vào trang Admin | **PASS** |
| **TC-MID-ADM-04** | `protectAdmin` | Quản trị viên hợp lệ | User có `Quyen: 'admin'` | Gán `req.owner = admin`, gọi `next()` | Cho phép truy cập route Admin | **PASS** |
| **TC-MID-ANY-01** | `protectAny` | Thiếu token | `req.headers: {}` | Mã HTTP 401: `'Không tìm thấy token...'` | Status 401 | **PASS** |
| **TC-MID-ANY-02** | `protectAny` | Token lỗi cú pháp | Token rác | Mã HTTP 401: `'Token không hợp lệ...'` | Status 401 | **PASS** |
| **TC-MID-ANY-03** | `protectAny` | Token chứa `userId` hợp lệ | Khách hàng đăng nhập | Gán `req.user`, gọi `next()` | Nhận diện đúng Khách hàng | **PASS** |
| **TC-MID-ANY-04** | `protectAny` | Token chứa `ownerId` hợp lệ | Chủ homestay đăng nhập | Gán `req.owner`, gọi `next()` | Nhận diện đúng Chủ nhà | **PASS** |
| **TC-MID-ANY-05** | `protectAny` | Token không khớp user nào | `userId: 99` không có trong DB | Mã HTTP 401: `'Tài khoản không tồn tại...'` | Status 401 | **PASS** |

### 4.4 Nhóm 4: Quản trị & Duyệt/Xóa Homestay (`homestay.admin.test.js` - 13 Test Cases)

| Mã Test Case | Hàm / Module | Nhánh / Điều kiện kiểm tra | Dữ liệu đầu vào (Input) | Kết quả mong đợi (Expected) | Kết quả thực tế | Đánh giá |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-ADM-HS-01** | `updateHomestayApproval` | Trạng thái duyệt không hợp lệ | `status: 'TrangThaiLa'` | Báo lỗi `'Trạng thái duyệt không hợp lệ...'` | Ném ngoại lệ đúng danh sách enum | **PASS** |
| **TC-ADM-HS-02** | `updateHomestayApproval` | Homestay không tồn tại | `homestayId: 999` | Báo lỗi `'Không tìm thấy homestay'` | Ném ngoại lệ 404 | **PASS** |
| **TC-ADM-HS-03** | `updateHomestayApproval` | Admin phê duyệt thành công | `status: 'DaDuyet'` | Cập nhật `TrangThaiDuyet = 'DaDuyet'` | Homestay được duyệt hiển thị | **PASS** |
| **TC-ADM-HS-04** | `updateHomestayApproval` | Admin từ chối phê duyệt | `status: 'TuChoi'` | Cập nhật `TrangThaiDuyet = 'TuChoi'` | Homestay bị từ chối | **PASS** |
| **TC-OWN-DEL-01** | `deleteHomestay` (Owner) | Homestay không tồn tại | `homestayId: 999` | Báo lỗi `'Không tìm thấy homestay'` | Ném ngoại lệ đúng thông điệp | **PASS** |
| **TC-OWN-DEL-02** | `deleteHomestay` (Owner) | Chủ nhà xóa homestay của người khác | Homestay thuộc chủ 88, chủ 99 gọi xóa | Báo lỗi `'Không có quyền xóa homestay này'` | Chặn hành vi xóa trái phép | **PASS** |
| **TC-OWN-DEL-03** | `deleteHomestay` (Owner) | Xóa mềm thành công | Chủ sở hữu hợp lệ xóa homestay | Cập nhật `isActive: false` (bảo toàn lịch sử booking)| Cập nhật soft delete thành công | **PASS** |
| **TC-ADM-DEL-01** | `deleteHomestay` (Admin) | Homestay không tồn tại | `homestayId: 999` | Báo lỗi `'Không tìm thấy homestay'` | Ném ngoại lệ | **PASS** |
| **TC-ADM-DEL-02** | `deleteHomestay` (Admin) | Admin xóa cứng homestay | Homestay vi phạm nghiêm trọng | Gọi lệnh `prisma.hOMESTAY.delete` | Bản ghi bị xóa hoàn toàn khỏi DB | **PASS** |
| **TC-ADM-BAN-01** | `updateUserStatus` | Người dùng không tồn tại | `userId: 999` | Báo lỗi `'Không tìm thấy người dùng'` | Ném ngoại lệ | **PASS** |
| **TC-ADM-BAN-02** | `updateUserStatus` | Khóa tài khoản người dùng | `isActive: false` | Cập nhật `isActive: false`, xóa trường `MatKhau` | Khóa tài khoản thành công | **PASS** |
| **TC-ADM-BAN-03** | `updateOwnerStatus` | Chủ nhà không tồn tại | `ownerId: 999` | Báo lỗi `'Không tìm thấy chủ homestay'` | Ném ngoại lệ | **PASS** |
| **TC-ADM-BAN-04** | `updateOwnerStatus` | Khóa tài khoản chủ nhà | `isActive: false` | Cập nhật `isActive: false`, xóa trường `MatKhau` | Khóa tài khoản thành công | **PASS** |

### 4.5 Nhóm 5: Đánh giá & Điều kiện hoàn thành kỳ nghỉ (`review.service.test.js` - 7 Test Cases)

| Mã Test Case | Hàm / Module | Nhánh / Điều kiện kiểm tra | Dữ liệu đầu vào (Input) | Kết quả mong đợi (Expected) | Kết quả thực tế | Đánh giá |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-REV-01** | `createReview` | Homestay không tồn tại | `homestayId: 999` | Báo lỗi `'Không tìm thấy homestay'` | Ném ngoại lệ | **PASS** |
| **TC-REV-02** | `createReview` | Khách chưa từng hoàn thành kỳ nghỉ | Không có đơn `DaHoanThanh` tại homestay | Báo lỗi `'Chỉ khách hàng đã hoàn thành kỳ nghỉ...'` | Chặn đánh giá ảo thành công | **PASS** |
| **TC-REV-03** | `createReview` | Khách đã có đánh giá trước đó | Gửi lại review mới (sửa sao/bình luận) | Cập nhật bản ghi `dANH_GIA` cũ, không tạo trùng | Cập nhật đánh giá thành công | **PASS** |
| **TC-REV-04** | `createReview` | Khách đánh giá lần đầu | Đủ điều kiện và chưa có đánh giá cũ | Tạo bản ghi mới `dANH_GIA` với số sao và bình luận | Tạo review thành công | **PASS** |
| **TC-CKREV-01** | `checkCanReview` | Chưa đăng nhập | `userId = null` | Trả về `{ canReview: false, reason: 'Bạn cần đăng nhập...' }` | Trả về đúng lý do | **PASS** |
| **TC-CKREV-02** | `checkCanReview` | Chưa hoàn thành kỳ nghỉ | Khách chưa có đơn `DaHoanThanh` | Trả về `{ canReview: false, reason: 'Chỉ khách hàng...' }` | Trả về đúng lý do | **PASS** |
| **TC-CKREV-03** | `checkCanReview` | Đủ điều kiện đánh giá | Khách đã hoàn thành kỳ nghỉ | Trả về `{ canReview: true }` | Cho phép hiển thị form đánh giá | **PASS** |

### 4.6 Nhóm 6: Thanh toán mô phỏng & Cập nhật đơn (`payment.service.test.js` - 26 Test Cases)

| Mã Test Case | Hàm / Module | Nhánh / Điều kiện kiểm tra | Dữ liệu đầu vào (Input) | Kết quả mong đợi (Expected) | Kết quả thực tế | Đánh giá |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-PAY-INFO-01** | `getPaymentInfo` | Đơn phòng không tồn tại | `bookingId: 999` | Báo lỗi `'Không tìm thấy đơn đặt phòng'` | Ném ngoại lệ 404 | **PASS** |
| **TC-PAY-INFO-02** | `getPaymentInfo` | Người gọi không phải chủ đơn hay chủ nhà | Khách X xem đơn của Khách Y | Báo lỗi `'Bạn không có quyền xem thông tin thanh toán...'` | Chặn xem trộm đơn phòng | **PASS** |
| **TC-PAY-INFO-03** | `getPaymentInfo` | Đơn phòng đã bị hủy | Đơn có `TrangThai: 'DaHuy'` | Trả về `canPay: false`, thông báo đơn đã hủy | Chặn hiển thị mã thanh toán | **PASS** |
| **TC-PAY-INFO-04** | `getPaymentInfo` | Đơn phòng đã thanh toán | Đơn có `TrangThaiThanhToan: 'DaThanhToan'` | Trả về `canPay: false`, `isPaid: true` | Không cho thanh toán lần hai | **PASS** |
| **TC-PAY-INFO-05** | `getPaymentInfo` | Đơn hợp lệ chờ thanh toán | Đơn `ChoXacNhan`, `ChuaThanhToan` | Trả về `canPay: true`, sinh mã QR Data URL và memo `THANHTOAN DP3` | QR demo VietQR sinh chuẩn | **PASS** |
| **TC-PAY-SEL-01** | `selectPaymentMethod`| Phương thức không hỗ trợ | `method: 'Bitcoin'` | Báo lỗi `'Phương thức thanh toán không hợp lệ...'` | Chặn phương thức lạ | **PASS** |
| **TC-PAY-SEL-02** | `selectPaymentMethod`| Đơn phòng không tồn tại | `bookingId: 999` | Báo lỗi `'Không tìm thấy đơn đặt phòng'` | Ném ngoại lệ | **PASS** |
| **TC-PAY-SEL-03** | `selectPaymentMethod`| Không phải chủ đơn | User khác chọn phương thức | Báo lỗi `'Bạn không có quyền thay đổi phương thức...'` | Chặn can thiệp trái phép | **PASS** |
| **TC-PAY-SEL-04** | `selectPaymentMethod`| Đơn đã bị hủy | Đơn `DaHuy` | Báo lỗi `'Đơn đặt phòng đã bị hủy.'` | Chặn thao tác | **PASS** |
| **TC-PAY-SEL-05** | `selectPaymentMethod`| Đơn đã thanh toán trước đó | Đơn `DaThanhToan` | Báo lỗi `'Đơn đặt phòng đã được thanh toán.'` | Chặn đổi phương thức | **PASS** |
| **TC-PAY-SEL-06** | `selectPaymentMethod`| Chọn phương thức Tiền mặt thành công | Đơn hợp lệ, chọn `TienMat` | Cập nhật `PhuongThucThanhToan: 'TienMat'`, tạo giao dịch `ChoThanhToan` | Giao dịch khởi tạo chuẩn | **PASS** |
| **TC-PAY-SIM-01** | `simulatePayment` | Đơn phòng không tồn tại | `bookingId: 999` | Báo lỗi `'Không tìm thấy đơn đặt phòng'` | Ném ngoại lệ | **PASS** |
| **TC-PAY-SIM-02** | `simulatePayment` | Người thực hiện không phải chủ đơn | User khác mô phỏng thanh toán | Báo lỗi `'Bạn không có quyền thực hiện thanh toán...'` | Chặn thanh toán hộ/phá | **PASS** |
| **TC-PAY-SIM-03** | `simulatePayment` | Đơn phòng đã hủy | Đơn `DaHuy` | Báo lỗi `'Đơn đặt phòng đã bị hủy...'` | Chặn giao dịch | **PASS** |
| **TC-PAY-SIM-04** | `simulatePayment` | Đơn phòng đã thanh toán | Đơn `DaThanhToan` | Báo lỗi `'Đơn đặt phòng này đã được thanh toán trước đó...'` | Chống thanh toán 2 lần | **PASS** |
| **TC-PAY-SIM-05** | `simulatePayment` | Mô phỏng Thành công (`result: 'success'`) | Khách bấm xác nhận thành công | Đơn tự động sang `DaXacNhan`, `DaThanhToan`, tạo giao dịch `ThanhCong` | Biên lai sinh chuẩn, đơn được duyệt | **PASS** |
| **TC-PAY-SIM-06** | `simulatePayment` | Mô phỏng Thất bại (`result: 'failure'`) | Giả lập lỗi thiếu số dư / hủy GD | Đơn giữ nguyên `ChuaThanhToan`, tạo giao dịch `ThatBai` kèm lý do | Ghi vết lỗi, đơn không mất | **PASS** |
| **TC-PAY-CASH-01** | `confirmCashPayment` | Đơn phòng không tồn tại | `bookingId: 999` | Báo lỗi `'Không tìm thấy đơn đặt phòng'` | Ném ngoại lệ | **PASS** |
| **TC-PAY-CASH-02** | `confirmCashPayment` | Người gọi không phải Chủ nhà hay Admin | Khách hàng hoặc người lạ gọi hàm | Báo lỗi `'Bạn không có quyền xác nhận thu tiền...'` | Chặn khách tự xác nhận đã nộp tiền | **PASS** |
| **TC-PAY-CASH-03** | `confirmCashPayment` | Đơn phòng đã bị hủy | Đơn `DaHuy` | Báo lỗi `'Đơn đặt phòng đã bị hủy, không thể thu tiền'` | Chặn thu tiền đơn hủy | **PASS** |
| **TC-PAY-CASH-04** | `confirmCashPayment` | Đơn đã thu tiền trước đó | Đơn `DaThanhToan` | Báo lỗi `'Đơn đặt phòng này đã được xác nhận thanh toán trước đó'` | Chặn thu tiền trùng | **PASS** |
| **TC-PAY-CASH-05** | `confirmCashPayment` | Chủ nhà xác nhận thu tiền mặt thành công | Chủ sở hữu hợp lệ bấm xác nhận | Cập nhật `DaThanhToan`, tạo giao dịch với `VaiTro: 'ChuHomestay'` | Giao dịch tiền mặt hoàn tất | **PASS** |
| **TC-PAY-CASH-06** | `confirmCashPayment` | Admin xác nhận thu tiền mặt | Admin bấm hỗ trợ xác nhận | Cập nhật `DaThanhToan`, tạo giao dịch với `VaiTro: 'Admin'` | Giao dịch tiền mặt Admin hoàn tất | **PASS** |
| **TC-PAY-TXN-01** | `getBookingTransactions` | Đơn phòng không tồn tại | `bookingId: 999` | Báo lỗi `'Không tìm thấy đơn đặt phòng'` | Ném ngoại lệ | **PASS** |
| **TC-PAY-TXN-02** | `getBookingTransactions` | Người gọi không có quyền | Người lạ xem lịch sử giao dịch | Báo lỗi `'Bạn không có quyền xem lịch sử giao dịch...'` | Chặn truy cập trái phép | **PASS** |
| **TC-PAY-TXN-03** | `getBookingTransactions` | Lấy lịch sử giao dịch thành công | Chủ đơn hoặc chủ nhà xem | Trả về danh sách các bản ghi `GIAO_DICH` đã lưu vết | Hiển thị đầy đủ lịch sử | **PASS** |

---

## 5. HƯỚNG DẪN LỆNH CHẠY KIỂM THỬ

Toàn bộ test suite được cấu hình trong `backend/package.json` và có thể chạy trực tiếp bằng các lệnh sau:

### 5.1 Chạy kiểm thử nhanh (Standard Run)
```bash
cd D:\ptda\backend
npm test
```
*Lệnh này sẽ tự động tìm và chạy toàn bộ các file `tests/*.test.js`.*

### 5.2 Chạy kiểm thử kèm đo lường độ bao phủ (Coverage Run)
```bash
cd D:\ptda\backend
npm run test:coverage
```
*Lệnh này sẽ kích hoạt engine đo lường V8 tích hợp của Node.js, xuất báo cáo chi tiết về tỷ lệ phần trăm dòng (line), nhánh (branch), hàm (functions) và chỉ rõ các dòng chưa được chạy.*

### 5.3 Chạy riêng lẻ từng module khi phát triển
```bash
# Kiểm thử logic đặt phòng và chống trùng lịch:
node --test tests/booking.service.test.js

# Kiểm thử xác thực & phân quyền:
node --test tests/auth.service.test.js tests/auth.middleware.test.js

# Kiểm thử thanh toán mô phỏng:
node --test tests/payment.service.test.js
```

---

## 6. KẾT QUẢ THỰC TẾ (PASS / FAIL)

```text
▶ White-Box Testing: Authentication Services (Customer & Owner) (13 tests) - PASSED
▶ White-Box Testing: Role Authorization Middlewares (18 tests)           - PASSED
▶ White-Box Testing: Booking Service & Conflict Prevention (27 tests)     - PASSED
▶ White-Box Testing: Homestay Moderation & Administration (13 tests)     - PASSED
▶ White-Box Testing: Review Service & Completion Conditions (7 tests)     - PASSED
▶ White-Box Testing: Mock Payment Service & Status Transitions (26 tests) - PASSED

================================================================================
TỔNG SỐ TEST CASES THỰC THI : 104
SỐ LƯỢNG TEST CASE ĐẠT (PASS) : 104
SỐ LƯỢNG TEST CASE THẤT BẠI : 0
SỐ LƯỢNG BỊ HỦY / BỎ QUA     : 0
TỔNG THỜI GIAN CHẠY TOÀN BỘ : 3.07 giây
TỶ LỆ ĐẠT (SUCCESS RATE)     : 100.00%
================================================================================
```

---

## 7. BẢNG COVERAGE THỰC TẾ (CODE COVERAGE REPORT)

Bảng trích xuất trực tiếp từ kết quả chạy `npm run test:coverage`:

```text
-------------------------------------------------------------------------------------------------------------------
Tệp mã nguồn (Source File)             | Dòng (Line %) | Nhánh (Branch %) | Hàm (Funcs %) | Các dòng chưa chạy
-------------------------------------------------------------------------------------------------------------------
src/middlewares/auth.middleware.js     |    100.00%    |     100.00%      |    100.00%    | Không có
src/middlewares/admin.middleware.js    |     95.45%    |      90.00%      |    100.00%    | 37-38
src/middlewares/owner.middleware.js    |     96.00%    |      90.00%      |    100.00%    | 43-44
src/services/auth.service.js           |    100.00%    |      91.67%      |    100.00%    | Không có
src/services/booking.service.js        |     77.58%    |     100.00%      |     75.00%    | 173-222 (Legacy createBooking)
src/services/payment.service.js        |     99.49%    |      82.67%      |    100.00%    | 79-80 (Catch lỗi QR)
src/services/homestay.service.js       |     48.31%    |      96.88%      |     38.46%    | (Các hàm tìm kiếm/filter)
src/services/admin.service.js          |     36.48%    |     100.00%      |     25.00%    | (Các hàm query report)
src/services/owner.service.js          |     30.09%    |      85.71%      |     18.18%    | (Các hàm crud homestay của chủ)
src/config/prisma.js                   |    100.00%    |     100.00%      |    100.00%    | Không có
-------------------------------------------------------------------------------------------------------------------
TỔNG THỂ TOÀN BỘ (OVERALL)             |     60.22%    |      90.25%      |     55.22%    |
-------------------------------------------------------------------------------------------------------------------
```

---

## 8. PHÂN TÍCH NHỮNG NHÁNH CHƯA ĐƯỢC BAO PHỦ VÀ NGUYÊN NHÂN

1. **Khối bắt lỗi ngoại lệ cấp thấp của hệ thống (`catch (error)`):**
   - Trong `admin.middleware.js` (dòng 37-38) và `owner.middleware.js` (dòng 43-44), khối `catch` xử lý trường hợp lỗi không xác định từ thư viện JWT hoặc runtime. Các nhánh này chỉ kích hoạt khi có lỗi nghiêm trọng của máy ảo Node.js.
   - Trong `payment.service.js` (dòng 79-80), khối `catch` của hàm sinh mã `QRCode.toDataURL`. Trong môi trường unit test, thư viện `qrcode` hoạt động ổn định và tạo Data URL thành công nên nhánh bắt lỗi này không được kích hoạt.
2. **Hàm cũ `createBooking` trong `booking.service.js` (dòng 173-222):**
   - Hệ thống hiện tại đã nâng cấp và chuyển luồng đặt phòng chính sang `homestay.service.js:bookHomestay` (hàm có tích hợp thuật toán chống trùng lịch transaction anti-overbooking). Hàm cũ `booking.service.js:createBooking` được giữ lại để tương thích ngược API cũ và không nằm trong luồng giao diện chính.
3. **Các hàm truy vấn đọc dữ liệu báo cáo/thống kê (Query-only Functions):**
   - Các hàm như `admin.service.js:getAllHomestays`, `getDashboardStats`, `owner.service.js:getOwnerHomestays` không chứa các điều kiện rẽ nhánh nghiệp vụ phức tạp mà chỉ thực hiện câu lệnh `prisma.findMany()` / `prisma.count()`. Các hàm này thuộc phạm vi kiểm thử tích hợp (Integration Testing) với Database hơn là kiểm thử hộp trắng logic đơn vị.

---

## 9. CÁC ĐIỂM RỦI RO PHÁT HIỆN QUA KIỂM THỬ HỘP TRẮNG VÀ KIẾN NGHỊ

Qua quá trình lần theo từng dòng lệnh và nhánh điều kiện, nhóm ghi nhận các điểm cần lưu ý và đề xuất cải tiến:

1. **Sự tồn tại song song của 2 hàm tạo đặt phòng:**
   - **Hiện tượng:** Cả `booking.service.js` (hàm `createBooking`) và `homestay.service.js` (hàm `bookHomestay`) đều có logic tạo booking. Tuy nhiên, `booking.service.js:createBooking` **không** có bước kiểm tra xung đột trùng lịch, trong khi `homestay.service.js:bookHomestay` đã có kiểm tra trùng lịch rất chặt chẽ bằng Transaction.
   - **Kiến nghị:** Cần deprecate endpoint gọi `booking.service.js:createBooking` hoặc chuyển hướng toàn bộ controller sang sử dụng `homestay.service.js:bookHomestay` để đảm bảo 100% các đơn đặt phòng trong hệ thống đều đi qua thuật toán chống trùng lịch.
2. **Kiểm tra biên ngày đặt phòng với ngày hiện tại:**
   - **Hiện tượng:** Trong `homestay.service.js:bookHomestay`, điều kiện kiểm tra ngày đã có `soDem <= 0` (chặn đặt trả phòng trước hoặc cùng ngày nhận). Tuy nhiên, nên bổ sung thêm điều kiện chặn khách chọn `NgayNhan < Ngày hiện tại` tại Backend Service (hiện tại phần này chủ yếu đang chặn ở giao diện Frontend min-date).
3. **Bảo mật và chuẩn hóa xử lý lỗi:**
   - Khi token không hợp lệ hoặc đã hết hạn, middleware trả về mã HTTP 401 rõ ràng. Các thông báo lỗi tiếng Việt đã được chuẩn hóa giúp phía Frontend hiển thị thông báo toast thân thiện cho người dùng.

---
*Báo cáo được lập bởi Nhóm 16 - Môn học Kiểm thử phần mềm & Phát triển dự án.*

