# DỰ ÁN HỆ THỐNG ĐẶT PHÒNG HOMESTAY TRỰC TUYẾN - NHÓM 16

> **Môn học:** Kiểm thử phần mềm & Phát triển dự án  
> **Đề tài:** Nền tảng Đặt phòng & Quản lý Homestay trực tuyến (PTDA Homestay)  
> **Repository GitHub:** [https://github.com/HuyIT-art/Kiem_Thu_Phan_Mem_Nhom_16](https://github.com/HuyIT-art/Kiem_Thu_Phan_Mem_Nhom_16)  
> **Nhóm thực hiện:** Nhóm 16  

---

## MỤC LỤC

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc hệ thống & Tech Stack](#2-kiến-trúc-hệ-thống--tech-stack)
3. [Cấu trúc thư mục dự án](#3-cấu-trúc-thư-mục-dự-án)
4. [Yêu cầu môi trường cài đặt](#4-yêu-cầu-môi-trường-cài-đặt)
5. [Hướng dẫn Clone Repository](#5-hướng-dẫn-clone-repository)
6. [Cài đặt & Cấu hình Database PostgreSQL](#6-cài-đặt--cấu-hình-database-postgresql)
7. [Cấu hình & Khởi chạy Backend](#7-cấu-hình--khởi-chạy-backend)
8. [Cấu hình & Khởi chạy Frontend](#8-cấu-hình--khởi-chạy-frontend)
9. [Tổng hợp URLs & Kiểm tra hệ thống](#9-tổng-hợp-urls--kiểm-tra-hệ-thống)
10. [Danh sách tài khoản Demo có sẵn](#10-danh-sách-tài-khoản-demo-có-sẵn)
11. [Hướng dẫn chi tiết luồng nghiệp vụ các phân hệ](#11-hướng-dẫn-chi-tiết-luồng-nghiệp-vụ-các-phân-hệ)
12. [Hướng dẫn kiểm thử phần mềm (Testing)](#15-hướng-dẫn-kiểm-thử-phần-mềm-testing)
13. [Bảng khắc phục sự cố thường gặp (Troubleshooting)](#16-bảng-khắc-phục-sự-cố-thường-gặp-troubleshooting)
14. [Hướng dẫn Build Production](#17-hướng-dẫn-build-production)

---

## 1. TỔNG QUAN DỰ ÁN

Dự án **PTDA Homestay** là nền tảng thương mại điện tử chuyên biệt cho dịch vụ lưu trú du lịch homestay tại Việt Nam. Hệ thống kết nối đa chiều giữa:
* **Khách du lịch (Customer):** Tìm kiếm homestay theo địa điểm/tiện ích/mức giá, đặt phòng trực quan, xem lịch phòng trống thực tế, thanh toán mô phỏng tức thời qua mã QR hoặc tiền mặt, quản lý lịch sử đơn và khiếu nại.
* **Chủ homestay (Host/Owner):** Quản trị danh sách homestay, cập nhật phòng và tiện nghi, theo dõi và phê duyệt đơn đặt phòng, quản lý lịch phòng trống thời gian thực, đối soát doanh thu.
* **Quản trị viên (Admin):** Kiểm duyệt homestay trước khi hiển thị công khai, quản lý người dùng và chủ nhà, giải quyết khiếu nại dịch vụ, theo dõi báo cáo phân tích toàn hệ thống.

---

## 2. KIẾN TRÚC HỆ THỐNG & TECH STACK

Hệ thống được xây dựng theo kiến trúc Client - Server tách biệt (Decoupled Single Page Application & RESTful API), đảm bảo tính module hóa cao và dễ dàng mở rộng.

### 2.1 Backend Stack
* **Runtime:** Node.js (v18+ LTS hoặc v20+ LTS)
* **Framework:** Express.js (RESTful API architecture)
* **Database ORM:** Prisma ORM 5.x (PostgreSQL client với Type-safe queries và Migration engine)
* **Database Engine:** PostgreSQL 14+ (Cơ sở dữ liệu quan hệ, hỗ trợ ACID transactions)
* **Authentication & Authorization:** JSON Web Token (JWT), bcryptjs hashing mật khẩu với salt rounds = 12
* **File Upload:** Multer (xử lý tải ảnh homestay và avatar lên thư mục lưu trữ cục bộ)
* **Security & Middleware:** CORS, Body-parser JSON, Custom error handlers

### 2.2 Frontend Stack
* **Framework:** React 19 (SPA)
* **Build Tool:** Vite 6.x (Hot Module Replacement cực nhanh)
* **Routing:** React Router DOM v7 (Quản lý route phân quyền: Public, Protected Customer, Protected Host, Protected Admin)
* **Styling:** Tailwind CSS & CSS Modules (Hệ thống design system: phong cách Modern Travel & Warm Nature)
* **Icons:** Lucide React
* **HTTP Client:** Fetch API chuẩn hóa qua wrapper centralized API service

---

## 3. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
D:\ptda\
├── backend\                     # Mã nguồn máy chủ API
│   ├── prisma\                  # Prisma ORM & Database
│   │   ├── migrations\          # Lịch sử các bản migration database
│   │   ├── schema.prisma        # Định nghĩa mô hình dữ liệu (Data Models)
│   │   └── seed.js              # Script khởi tạo 24 homestay, ảnh thực tế và tài khoản demo
│   ├── src\
│   │   ├── controllers\         # Điều hướng request/response
│   │   │   ├── authController.js
│   │   │   ├── bookingController.js
│   │   │   ├── homestayController.js
│   │   │   ├── paymentController.js
│   │   │   ├── reviewController.js
│   │   │   └── userController.js
│   │   ├── middlewares\         # Xác thực JWT, phân quyền role, upload
│   │   │   ├── auth.js
│   │   │   └── upload.js
│   │   ├── routes\              # Định tuyến endpoint API
│   │   │   ├── authRoutes.js
│   │   │   ├── bookingRoutes.js
│   │   │   ├── homestayRoutes.js
│   │   │   ├── paymentRoutes.js
│   │   │   ├── reviewRoutes.js
│   │   │   └── userRoutes.js
│   │   ├── services\            # Nghiệp vụ core (xử lý logic, tính tiền, chống trùng lịch)
│   │   │   ├── bookingService.js
│   │   │   └── homestayService.js
│   │   └── app.js               # Khởi tạo Express app và middleware
│   ├── uploads\                 # Thư mục lưu trữ hình ảnh homestay (hs*.jpg)
│   ├── .env.example             # Bản mẫu biến môi trường backend
│   ├── .gitignore               # Loại bỏ node_modules, .env, uploads tạm thời
│   ├── package.json             # Danh sách dependencies backend
│   └── server.js                # Điểm khởi chạy server (port 3000)
│
├── frontend-simple\             # Giao diện người dùng (React + Vite)
│   ├── public\                  # Tài nguyên tĩnh công khai
│   ├── src\
│   │   ├── assets\              # Hình ảnh logo, icons nội bộ
│   │   ├── components\          # Các UI components dùng chung (Header, Footer, Modals)
│   │   ├── context\             # React Context quản lý Authentication & App State
│   │   │   └── AuthContext.jsx
│   │   ├── layouts\             # Khung giao diện (Customer Layout, Admin/Host Layout)
│   │   ├── pages\               # Các trang giao diện chính
│   │   │   ├── admin\           # Phân hệ Quản trị viên (Admin Portal)
│   │   │   ├── auth\            # Trang Đăng nhập / Đăng ký
│   │   │   ├── customer\        # Trang Chủ, Chi tiết Homestay, Đặt phòng, Thanh toán
│   │   │   └── owner\           # Phân hệ Chủ homestay (Host Portal)
│   │   ├── services\            # Module gọi API backend
│   │   │   └── api.js
│   │   ├── App.jsx              # Định nghĩa cây điều hướng routes
│   │   ├── index.css            # CSS toàn cục và Tailwind directives
│   │   └── main.jsx             # Điểm gắn kết React DOM
│   ├── .env.example             # Bản mẫu biến môi trường frontend
│   ├── .gitignore               # Loại bỏ dist, node_modules, .env
│   ├── index.html               # Trang HTML gốc
│   ├── package.json             # Danh sách dependencies frontend
│   └── vite.config.js           # Cấu hình Vite build tool
│
├── .gitignore                   # Quy tắc gitignore chung toàn bộ dự án
└── README.md                    # Tài liệu hướng dẫn toàn diện từ A-Z
```

---

## 4. YÊU CẦU MÔI TRƯỜNG CÀI ĐẶT

Trước khi bắt đầu, các thành viên cần đảm bảo máy tính đã cài đặt các phần mềm sau:

1. **Node.js**: Phiên bản LTS khuyến nghị: **18.x** hoặc **20.x** (Kiểm tra bằng lệnh: `node -v`)
2. **NPM**: Đi kèm với Node.js (Kiểm tra bằng lệnh: `npm -v`)
3. **PostgreSQL**: Phiên bản **14.x** trở lên (Đã cài và dịch vụ PostgreSQL service đang chạy)
4. **Git**: Phiên bản 2.30+ (Kiểm tra bằng lệnh: `git --version`)
5. **Code Editor**: Khuyến nghị sử dụng **Visual Studio Code** kèm các Extension:
   - *Prisma* (hỗ trợ syntax highlighting `.prisma`)
   - *Tailwind CSS IntelliSense*
   - *ES7+ React/Redux/React-Native snippets*

---

## 5. HƯỚNG DẪN CLONE REPOSITORY

Mở Terminal hoặc PowerShell tại thư mục làm việc mong muốn (ví dụ `D:\workspace`):

```bash
# 1. Clone repository về máy tính
git clone https://github.com/HuyIT-art/Kiem_Thu_Phan_Mem_Nhom_16.git

# 2. Di chuyển vào thư mục dự án
cd Kiem_Thu_Phan_Mem_Nhom_16
```

---

## 6. CÀI ĐẶT & CẤU HÌNH DATABASE POSTGRESQL

Hệ thống sử dụng cơ sở dữ liệu quan hệ PostgreSQL với tên database mặc định là `ptda_homestay`.

### 6.1 Tạo Database qua pgAdmin hoặc SQL Shell (psql)

**Cách 1: Sử dụng giao diện pgAdmin 4:**
1. Mở pgAdmin 4 và kết nối tới PostgreSQL server của bạn.
2. Chuột phải vào mục **Databases** -> Chọn **Create** -> **Database...**
3. Nhập Database name: `ptda_homestay`
4. Nhấn **Save**.

**Cách 2: Sử dụng dòng lệnh `psql`:**
```sql
-- Đăng nhập vào postgres
psql -U postgres

-- Tạo cơ sở dữ liệu mới
CREATE DATABASE ptda_homestay;

-- Kiểm tra danh sách database
\l

-- Thoát psql
\q
```

---

## 7. CẤU HÌNH & KHỞI CHẠY BACKEND

### 7.1 Tạo file biến môi trường `.env`
Di chuyển vào thư mục `backend`:
```bash
cd backend
```
Tạo file `.env` bằng cách copy từ `.env.example`:
```bash
# Trên Windows PowerShell:
Copy-Item .env.example .env

# Hoặc trên Command Prompt (cmd):
copy .env.example .env
```

Mở file `backend/.env` và cập nhật chuỗi kết nối khớp với mật khẩu tài khoản PostgreSQL trên máy bạn:
```env
# Định dạng: postgresql://<username>:<password>@<host>:<port>/<database>?schema=public
DATABASE_URL="postgresql://postgres:mat_khau_cua_ban@localhost:5432/ptda_homestay?schema=public"

# Mã khóa bí mật ký JWT Token (có thể tùy chỉnh)
JWT_SECRET="ptda_homestay_secret_jwt_key_2026"

# Cổng lắng nghe của Backend Server
PORT=3000
```

### 7.2 Cài đặt thư viện dependencies
```bash
npm install
```

### 7.3 Đồng bộ Database & Nạp dữ liệu mẫu (Seed Data)
Chạy lần lượt các lệnh sau:

```bash
# 1. Tạo Prisma Client type-safe
npx prisma generate

# 2. Đẩy cấu trúc bảng (schema) vào database PostgreSQL
npx prisma db push
# Hoặc chạy migration nếu muốn lưu lịch sử:
# npx prisma migrate deploy

# 3. Nạp dữ liệu mẫu (24 homestay chuẩn, hình ảnh, tài khoản admin, host, customer)
npx prisma db seed
```

> **LƯU Ý CỰC KỲ QUAN TRỌNG:**
> * Tuyệt đối **KHÔNG CHẠY** `npx prisma migrate reset` nếu không có chỉ định, vì lệnh này sẽ xóa toàn bộ dữ liệu đang có trong database.
> * Script seed đã được cấu hình tự động bảo toàn ảnh nội bộ và tự tạo tài khoản đầy đủ các quyền.

### 7.4 Khởi động Backend Server
```bash
# Chạy ở chế độ phát triển (tự động reload khi sửa code):
npm run dev

# Hoặc chạy chế độ thông thường:
npm start
```
Khi thành công, màn hình sẽ thông báo:
```text
Server is running on port 3000
Connected to PostgreSQL successfully!
```

---

## 8. CẤU HÌNH & KHỞI CHẠY FRONTEND

Mở một cửa sổ Terminal/PowerShell **MỚI** (giữ nguyên cửa sổ Backend đang chạy):

### 8.1 Di chuyển vào thư mục `frontend-simple`
```bash
cd frontend-simple
```

### 8.2 Tạo file `.env`
```bash
# Trên Windows PowerShell:
Copy-Item .env.example .env

# Hoặc trên Command Prompt (cmd):
copy .env.example .env
```
Nội dung file `frontend-simple/.env`:
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 8.3 Cài đặt dependencies
```bash
npm install
```

### 8.4 Khởi chạy Frontend Development Server
```bash
npm run dev
```
Terminal sẽ hiển thị đường link truy cập cục bộ:
```text
  VITE v6.x.x  ready in 350 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## 9. TỔNG HỢP URLS & KIỂM TRA HỆ THỐNG

| Phân hệ / Tính năng | Đường dẫn URL | Mô tả |
| :--- | :--- | :--- |
| **Trang chủ Khách hàng** | `http://localhost:5173/` | Tìm kiếm, xem danh sách 24 homestay, lọc giá |
| **Đăng nhập Khách hàng** | `http://localhost:5173/login` | Đăng nhập tài khoản khách hàng |
| **Đăng ký Khách hàng** | `http://localhost:5173/register` | Đăng ký tài khoản khách mới |
| **Chi tiết Homestay** | `http://localhost:5173/homestay/:id` | Xem chi tiết tiện nghi, lịch trống, chọn ngày đặt phòng |
| **Đặt phòng & Thanh toán**| `http://localhost:5173/booking/:id` | Nhập thông tin, tạo đơn và thanh toán QR demo |
| **Lịch sử đơn của tôi** | `http://localhost:5173/my-bookings` | Quản lý lịch sử, hủy đơn, tải biên lai thanh toán |
| **Cổng Chủ homestay** | `http://localhost:5173/owner/login` | Đăng nhập cổng quản trị của Chủ nhà |
| **Dashboard Chủ homestay**| `http://localhost:5173/owner/dashboard` | Quản lý homestay, đơn đặt phòng, doanh thu |
| **Cổng Quản trị viên (Admin)**| `http://localhost:5173/admin/login` | Đăng nhập cổng Quản trị hệ thống |
| **Dashboard Admin** | `http://localhost:5173/admin/dashboard` | Thống kê, duyệt homestay, quản lý người dùng |
| **Backend REST API** | `http://localhost:3000/api` | API Base URL |

---

## 10. DANH SÁCH TÀI KHOẢN DEMO CÓ SẴN

Sau khi chạy lệnh `npx prisma db seed`, hệ thống đã sẵn sàng các tài khoản mẫu sau để demo và kiểm thử:

| Vai trò (Role) | Email đăng nhập | Mật khẩu mặc định | Cổng đăng nhập | Quyền hạn chính |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** (Quản trị viên) | `admin@test.com` | `password123` | `http://localhost:5173/admin/login` | Toàn quyền kiểm duyệt homestay, khóa/mở người dùng, xem báo cáo thống kê |
| **Chủ homestay** (Host) | `seed.owner@test.com` | `password123` | `http://localhost:5173/owner/login` | Quản lý 24 homestay mẫu, xác nhận đơn đặt phòng, theo dõi lịch phòng trống và doanh thu |
| **Khách hàng** (Customer) | `customer@test.com` | `password123` | `http://localhost:5173/login` | Xem danh sách homestay, đặt phòng, thanh toán QR demo, đánh giá dịch vụ |

---

## 11. HƯỚNG DẪN CHI TIẾT LUỒNG NGHIỆP VỤ CÁC PHÂN HỆ

### 11.1 Luồng Khách hàng (Customer Journey)
1. **Tìm kiếm & Lựa chọn:** Khách vào trang chủ, tìm theo địa điểm (Hà Nội, Đà Lạt, Sa Pa, Ninh Bình...), lọc theo khoảng giá hoặc sức chứa.
2. **Xem chi tiết homestay:** Xem bộ 4 ảnh thực tế chất lượng cao, danh sách tiện ích (Wifi, Bếp, Bể bơi...), bảng lịch phòng trống theo ngày.
3. **Đặt phòng:**
   - Chọn ngày nhận phòng (`NgayNhanPhong`) và ngày trả phòng (`NgayTraPhong`).
   - Hệ thống tự động tính số đêm và tổng tiền.
   - Nhấn **Đặt phòng ngay** $\rightarrow$ Hệ thống kiểm tra chống trùng lịch và tạo đơn với trạng thái `ChoXacNhan`.
4. **Thanh toán:**
   - Giao diện thanh toán lập tức xuất hiện mã QR VietQR demo.
   - Khách có thể chọn **Thanh toán chuyển khoản QR** (mô phỏng thành công/thất bại) hoặc **Thanh toán tiền mặt khi nhận phòng**.
5. **Theo dõi đơn:** Vào mục **Đặt phòng của tôi** (`/my-bookings`) để xem trạng thái đơn, hóa đơn chi tiết, hoặc thực hiện hủy phòng nếu chưa đến ngày.

### 11.2 Luồng Chủ homestay (Host Operations)
1. **Đăng nhập:** Truy cập `/owner/login` bằng tài khoản chủ homestay.
2. **Quản lý danh sách Homestay:** Thêm mới homestay, tải lên hình ảnh, chỉnh sửa giá phòng, tiện ích và sức chứa.
3. **Xử lý đơn đặt phòng:**
   - Nhận thông báo đơn mới ở trạng thái `ChoXacNhan`.
   - Nhấn **Xác nhận đặt phòng** để chuyển trạng thái sang `DaXacNhan`.
   - Với các đơn chọn phương thức tiền mặt: Chủ nhà có nút **Xác nhận đã thu tiền** khi khách nhận phòng.
4. **Lịch phòng trống:** Xem ma trận lịch phòng theo tháng để nắm bắt số lượng phòng đang được giữ và phòng còn trống.
5. **Thống kê doanh thu:** Biểu đồ doanh thu thực tế theo từng tháng, tổng số lượt đặt thành công.

### 11.3 Luồng Quản trị viên (Admin Management)
1. **Đăng nhập:** Truy cập `/admin/login` bằng tài khoản Quản trị viên.
2. **Kiểm duyệt Homestay:** Duyệt (`DaDuyet`) hoặc từ chối (`TuChoi`) các homestay mới đăng ký từ các chủ nhà trước khi được công khai lên trang chủ.
3. **Quản lý người dùng:** Xem danh sách toàn bộ khách hàng và chủ homestay, khóa tài khoản vi phạm hoặc kích hoạt lại.
4. **Xử lý khiếu nại:** Tiếp nhận khiếu nại từ khách hàng về chất lượng phòng hoặc thái độ phục vụ, phản hồi giải quyết khiếu nại.
5. **Báo cáo tổng quan:** Số lượng người dùng, tổng số homestay hoạt động, số đơn đặt phòng thành công trên toàn hệ thống.

---


## 12. HƯỚNG DẪN KIỂM THỬ PHẦN MỀM (TESTING)

Dự án phục vụ môn học **Kiểm thử phần mềm**, cấu trúc mã nguồn được thiết kế thuận tiện cho các loại hình kiểm thử:

### 12.1 Kiểm thử Đơn vị & Tích hợp (API Testing)
* Các file cấu hình test hoặc kịch bản kiểm thử API bằng Postman Collection / Newman / Jest có thể đặt tại thư mục `backend/tests/` hoặc thư mục gốc `tests/`.
* Chạy kịch bản kiểm thử tự động (nếu có cấu hình script):
  ```bash
  cd backend
  npm test
  ```

### 12.2 Kiểm thử Chức năng & Luồng Người dùng (Manual & End-to-End Testing)
Nhóm có thể thực hiện kiểm thử theo ma trận Test Cases mẫu:
1. **TC-AUTH-01:** Đăng ký tài khoản với email đã tồn tại $\rightarrow$ Kỳ vọng: Báo lỗi email trùng.
2. **TC-AUTH-02:** Đăng nhập sai mật khẩu $\rightarrow$ Kỳ vọng: Báo lỗi thông tin đăng nhập không hợp lệ.
3. **TC-BOOKING-01:** Chọn ngày trả phòng trước ngày nhận phòng $\rightarrow$ Kỳ vọng: Bị chặn ngay tại giao diện hoặc backend báo lỗi 400.
4. **TC-BOOKING-02:** Đặt trùng ngày với đơn đã xác nhận $\rightarrow$ Kỳ vọng: Backend báo lỗi xung đột lịch phòng.
5. **TC-PAYMENT-01:** Thanh toán mô phỏng thành công $\rightarrow$ Kỳ vọng: Trạng thái chuyển thành `DaThanhToan`, xuất hiện biên lai.
6. **TC-ROLE-01:** Tài khoản khách hàng truy cập `/admin/dashboard` $\rightarrow$ Kỳ vọng: Bị chuyển hướng hoặc chặn truy cập (403 Forbidden).

---

## 13. BẢNG KHẮC PHỤC SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

| Hiện tượng lỗi | Nguyên nhân gốc | Cách khắc phục |
| :--- | :--- | :--- |
| **`PrismaClientInitializationError: P1001`** (Can't reach database server) | Dịch vụ PostgreSQL chưa chạy hoặc sai cổng 5432. | Mở `services.msc` trên Windows $\rightarrow$ Tìm `postgresql-x64-xx` $\rightarrow$ Nhấn **Start**. Kiểm tra lại port trong `.env`. |
| **`PrismaClientKnownRequestError: P1000`** (Authentication failed) | Sai mật khẩu tài khoản `postgres` trong file `.env`. | Mở file `backend/.env`, kiểm tra lại mật khẩu sau dấu `:` và trước `@localhost:5432`. |
| **Lỗi CORS policy** trên trình duyệt khi gọi API | Frontend chạy cổng khác chưa được whitelist hoặc backend chưa bật middleware CORS. | Xác nhận `backend/src/app.js` đã có `app.use(cors())`. Đảm bảo backend chạy port 3000 và frontend gọi đúng `http://localhost:3000/api`. |
| **Hình ảnh homestay bị vỡ / 404 Not Found** | Server backend chưa cấu hình static folder hoặc đường dẫn ảnh bị sai. | Kiểm tra `backend/server.js` có dòng `app.use('/uploads', express.static(...))`. Đảm bảo các file ảnh tồn tại trong `backend/uploads/`. |
| **Lỗi `EADDRINUSE: address already in use :::3000`** | Đang có một tiến trình node cũ chiếm cổng 3000. | Trên Windows PowerShell chạy: `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess \| Stop-Process -Force` để giải phóng port. |
| **Giao diện không cập nhật sau khi sửa code** | Cache trình duyệt hoặc Vite chưa nhận. | Nhấn `Ctrl + F5` trên trình duyệt để hard refresh, hoặc xóa thư mục `frontend-simple/node_modules/.vite` rồi chạy lại `npm run dev`. |
| **Prisma schema thay đổi nhưng code không nhận** | Chưa cập nhật lại Prisma Client. | Chạy lệnh `npx prisma generate` trong thư mục `backend`. |

---

## 14. HƯỚNG DẪN BUILD PRODUCTION

### 14.1 Build Frontend
```bash
cd frontend-simple
npm run build
```
Kết quả bản build tối ưu hóa sẽ được xuất ra thư mục `frontend-simple/dist/`. Bạn có thể chạy thử bản build bằng lệnh:
```bash
npm run preview
```

### 14.2 Chạy Backend Production
```bash
cd backend
NODE_ENV=production node server.js
```
*Bản quyền tài liệu thuộc về Nhóm 16 - Dự án Kiểm thử phần mềm & Phát triển phần mềm ứng dụng.*

