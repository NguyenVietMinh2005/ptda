# BÁO CÁO KIỂM THỬ ĐƠN VỊ (UNIT TESTING REPORT)
**Dự án:** Hệ thống Quản lý và Đặt phòng Homestay (PTDA Homestay)  
**Môn học:** Đảm bảo chất lượng & Kiểm thử phần mềm  
**Môi trường thực thi:** Node.js v24.21.0, Node Test Runner (`node:test`), Node.js V8 Experimental Coverage  
**Thời gian thực hiện:** Tháng 10/2026  
**Trạng thái kiểm thử:** 104/104 Test Cases PASSED (Tỷ lệ đạt 100%)  
**Cơ chế lưu trữ:** 100% Mocking trong RAM (`mockPrisma.js`), không ghi hay đọc cơ sở dữ liệu vật lý  

---

## 1. MỤC TIÊU VÀ PHẠM VI KIỂM THỬ ĐƠN VỊ

### 1.1. Mục tiêu
- Kiểm chứng tính đúng đắn của từng đơn vị hàm logic độc lập (unit) trong tầng **Services** và **Middlewares** của backend.
- Đảm bảo các quy tắc nghiệp vụ cốt lõi (Business Rules), xử lý ngoại lệ (Exception Handling), kiểm tra điều kiện biên (Boundary Value Analysis) và phân vùng tương đương (Equivalence Partitioning) hoạt động chính xác trước khi ghép nối hệ thống.
- Thực hiện kiểm thử hộp trắng (White-box Testing) với phương pháp Mocking cách ly hoàn toàn tầng dữ liệu.

### 1.2. Phạm vi kiểm thử
Kiểm thử tập trung vào 6 suite kiểm thử độc lập trong thư mục `backend/tests/`:
1. **Booking Service (`booking.service.test.js` - 27 tests)**: Kiểm tra logic đặt phòng, tính tiền theo đêm, kiểm tra giới hạn khách, chống đặt trùng lịch (Overlapping Dates), xử lý ngoại lệ cơ sở dữ liệu.
2. **Auth Service (`auth.service.test.js` - 13 tests)**: Đăng ký, đăng nhập tài khoản khách/chủ nhà, mã hóa mật khẩu `bcrypt`, sinh mã JWT, xử lý email trùng lặp và tài khoản bị vô hiệu hóa.
3. **Auth Middleware (`auth.middleware.test.js` - 18 tests)**: Xác thực JWT token, chặn truy cập khi thiếu token hoặc token sai định dạng, phân quyền nghiêm ngặt giữa `khach_hang`, `chu_homestay`, `admin`.
4. **Homestay Admin & Host Service (`homestay.admin.test.js` - 13 tests)**: Duyệt/từ chối homestay, kiểm tra trạng thái phê duyệt (`ChoDuyet`, `DaDuyet`, `TuChoi`), kiểm tra quyền sở hữu homestay của chủ nhà.
5. **Review Service (`review.service.test.js` - 7 tests)**: Đánh giá và xếp hạng sao, kiểm tra điều kiện tiên quyết (chỉ khách đã hoàn thành kỳ lưu trú mới được đánh giá), ngăn chặn spam review.
6. **Payment Service (`payment.service.test.js` - 26 tests)**: Xử lý thanh toán mô phỏng (QR MoMo/Ngân hàng, Tiền mặt khi nhận phòng), chuyển đổi trạng thái giao dịch (`PENDING` $\rightarrow$ `PAID` / `FAILED`), đối soát dữ liệu thanh toán.

---

## 2. PHƯƠNG PHÁP VÀ MÔI TRƯỜNG THỰC THI

### 2.1. Phương pháp Kiểm thử Hộp trắng & Mocking Isolation
- **Mocking & Isolation**: Tách biệt hoàn toàn tầng logic khỏi cơ sở dữ liệu vật lý bằng module giả lập `mockPrisma.js`. Mọi lời gọi `prisma.$transaction`, `findUnique`, `findMany`, `create`, `update` đều được kiểm soát trong bộ nhớ RAM. Do đó, bài test chạy với tốc độ cực nhanh (~3.6s) và **không làm biến đổi hay phụ thuộc vào dữ liệu PostgreSQL thật**.
- **Equivalence Partitioning (Phân vùng tương đương)**: Chia dữ liệu đầu vào thành các lớp hợp lệ (Valid Partition) và không hợp lệ (Invalid Partition).
- **Boundary Value Analysis (Phân tích giá trị biên)**: Kiểm thử tại các ngưỡng tới hạn như: 0 đêm (`ngayNhan === ngayTra`), số khách vượt quá sức chứa tối đa (`soKhach > SucChuaToiDa`), đánh giá 0 sao hoặc 6 sao.
- **Branch / Decision Coverage**: Thiết lập test case đi qua tất cả các nhánh `if/else`, toán tử 3 ngôi và khối `catch` xử lý lỗi.

### 2.2. Môi trường và Lệnh thực thi
- **Test Runner**: Native Node.js Test Runner (`node --test`).
- **Lệnh thực thi độc lập Unit Tests**:
  ```powershell
  cd D:\ptda\backend
  npm run test:unit
  ```
- **Lệnh đo độ bao phủ mã nguồn**:
  ```powershell
  cd D:\ptda\backend
  npm run test:coverage
  ```

---

## 3. BẢNG ĐO ĐỘ BAO PHỦ MÃ NGUỒN THỰC TẾ (CODE COVERAGE REPORT)

Bảng kết quả đo lường thực tế từ công cụ `node --test --experimental-test-coverage`:

| Tên File Mã Nguồn | Line Coverage (%) | Branch Coverage (%) | Function Coverage (%) | Dòng mã chưa bao phủ (Uncovered Lines) |
| :--- | :---: | :---: | :---: | :--- |
| `src/config/prisma.js` | 100.00% | 100.00% | 100.00% | *(Không có)* |
| `src/middlewares/auth.middleware.js` | 100.00% | 100.00% | 100.00% | *(Không có)* |
| `src/middlewares/admin.middleware.js` | 95.45% | 90.00% | 100.00% | 37-38 |
| `src/middlewares/owner.middleware.js` | 96.00% | 90.00% | 100.00% | 43-44 |
| `src/services/auth.service.js` | 100.00% | 91.67% | 100.00% | *(Không có)* |
| `src/services/payment.service.js` | 99.49% | 82.67% | 100.00% | 79-80 |
| `src/services/booking.service.js` | 77.58% | 100.00% | 75.00% | 173-222 (hàm phụ hủy/đổi lịch) |
| `src/services/homestay.service.js` | 48.31% | 96.88% | 38.46% | 8-65, 73-115, 133-166, 386-407 |
| `src/services/admin.service.js` | 36.48% | 100.00% | 25.00% | 8-19, 26-39, 87-119, 306-400 |
| `src/services/owner.service.js` | 30.09% | 85.71% | 18.18% | 102-125, 185-233, 286-367 |
| `tests/helpers/mockPrisma.js` | 85.19% | 72.73% | 100.00% | 12-13, 31-34, 50-51 |
| **TOÀN BỘ CÁC FILE ĐƯỢC ĐO (ALL FILES)** | **60.23%** | **90.25%** | **55.22%** | *Tập trung vào logic cốt lõi* |

> **Nhận xét chuyên sâu:**
> - **Độ bao phủ nhánh (Branch Coverage) đạt 90.25%**: Đây là chỉ số quan trọng nhất trong kiểm thử hộp trắng, chứng minh các điều kiện rẽ nhánh nghiệp vụ trọng yếu (chặn đặt trùng, kiểm tra vai trò người dùng, kiểm tra trạng thái thanh toán) đã được kiểm thử toàn diện.
> - **Line Coverage đạt 60.23% và Function Coverage đạt 55.22%**: Lý do là các service `admin.service.js`, `owner.service.js`, `homestay.service.js` chứa nhiều tính năng quản lý mở rộng (quản lý danh mục tiện ích, tra cứu lịch sử khiếu nại, thống kê doanh thu đa chiều) chưa có bài unit test tương ứng trong phạm vi BTL này.

---

## 4. BẢNG DANH MỤC 104 UNIT TEST CASES CHI TIẾT

Toàn bộ 104 test case đã được thực thi và xác minh 100% PASS:
- Suite 1: `booking.service.test.js` (27 test cases) - PASS 27/27
- Suite 2: `auth.service.test.js` (13 test cases) - PASS 13/13
- Suite 3: `auth.middleware.test.js` (18 test cases) - PASS 18/18
- Suite 4: `homestay.admin.test.js` (13 test cases) - PASS 13/13
- Suite 5: `review.service.test.js` (7 test cases) - PASS 7/7
- Suite 6: `payment.service.test.js` (26 test cases) - PASS 26/26

---

## 5. ĐÁNH GIÁ VÀ KẾT LUẬN KIỂM THỬ ĐƠN VỊ

1. **Hiệu năng thực thi**: Toàn bộ 104 test case hoàn tất trong **~3.6 giây**.
2. **Tính toàn vẹn dữ liệu**: 100% Mocking trong RAM, không phụ thuộc vào cơ sở dữ liệu thật.
3. **Độ tin cậy nghiệp vụ**: 100% test case vượt qua (PASSED), không có lỗi crash tiến trình.
4. **Kết luận**: Cấp độ Kiểm thử Đơn vị đã hoàn thành đạt chuẩn.
