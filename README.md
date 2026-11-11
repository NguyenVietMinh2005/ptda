# HỆ THỐNG ĐẶT PHÒNG & QUẢN LÝ HOMESTAY TRỰC TUYẾN (PTDA HOMESTAY)

> **Môn học:** Kiểm thử phần mềm & Phát triển dự án  
> **Đề tài:** Nền tảng Đặt phòng & Quản lý Homestay trực tuyến (PTDA Homestay)  
> **Repository GitHub:** [https://github.com/HuyIT-art/Kiem_Thu_Phan_Mem_Nhom_16](https://github.com/HuyIT-art/Kiem_Thu_Phan_Mem_Nhom_16)  
> **Branch triển khai:** `staging/ptda-unified-login`
> **Nhóm thực hiện:** Nhóm 16  

---

## 📌 BẢNG THÔNG SỐ VÀ TRẠNG THÁI HỆ THỐNG

| Thành phần | Công nghệ / Phiên bản | Trạng thái kỹ thuật |
| :--- | :--- | :---: |
| **Backend API** | Node.js v20+ LTS, Express.js (ES Modules) | ![Node](https://img.shields.io/badge/Backend-Express.js-brightgreen) |
| **Database ORM** | PostgreSQL 14+, Prisma ORM v5.22.0 (8 Migrations) | ![Prisma](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Prisma%205.22-blue) |
| **Frontend SPA** | React 19, Vite 7, React Router DOM v7, Tailwind CSS | ![React](https://img.shields.io/badge/Frontend-React%2019%20%2F%20Vite%207-61dafb) |
| **Cloud Storage** | Dual Driver: Local Filesystem (Dev) & Supabase Storage (Prod) | ![Supabase](https://img.shields.io/badge/Storage-Supabase%20Storage-3ecf8e) |
| **Backend Testing** | Node.js Native Test Runner (`node:test`) | ![Tests](https://img.shields.io/badge/Tests-302%2F302%20PASS%20(100%25)-success) |
| **Frontend Quality** | ESLint 9 Flat Config (`eslint .`) & Vite Build | ![ESLint](https://img.shields.io/badge/ESLint-0%20errors%20%2F%200%20warnings-success) |
| **Target Cloud** | Render (Web Service), Supabase (DB/Storage), Vercel (SPA) | ![Cloud](https://img.shields.io/badge/Deploy-Render%20%7C%20Supabase%20%7C%20Vercel-blueviolet) |

---

## 📑 MỤC LỤC

1. [Tổng quan dự án & Điểm mới trên nhánh Staging](#1-tổng-quan-dự-án--điểm-mới-trên-nhánh-staging)
2. [Kiến trúc hệ thống & Tech Stack](#2-kiến-trúc-hệ-thống--tech-stack)
3. [Cấu trúc thư mục dự án](#3-cấu-trúc-thư-mục-dự-án)
4. [Yêu cầu môi trường cài đặt (Prerequisites)](#4-yêu-cầu-môi-trường-cài-đặt-prerequisites)
5. [Hướng dẫn Cài đặt & Khởi chạy Local (Step-by-Step)](#5-hướng-dẫn-cài-đặt--khởi-chạy-local-step-by-step)
6. [Quy trình Quản lý Database & Migrations (Prisma 5.22.0)](#6-quy-trình-quản-lý-database--migrations-prisma-5220)
7. [Danh mục URLs & Danh sách Tài khoản Demo](#7-danh-mục-urls--danh-sách-tài-khoản-demo)
8. [Hướng dẫn Chi tiết Luồng Nghiệp vụ](#8-hướng-dẫn-chi-tiết-luồng-nghiệp-vụ)
9. [Hướng dẫn Kiểm thử Tự động (Automated Testing Suite)](#9-hướng-dẫn-kiểm-thử-tự-động-automated-testing-suite)
10. [Hướng dẫn Triển khai Cloud Staging (Supabase + Render + Vercel)](#10-hướng-dẫn-triển-khai-cloud-staging-supabase--render--vercel)
11. [Bảng Khắc phục Sự cố Thường gặp (Troubleshooting)](#11-bảng-khắc-phục-sự-cố-thường-gặp-troubleshooting)

---

## 1. TỔNG QUAN DỰ ÁN & ĐIỂM MỚI TRÊN NHÁNH STAGING

Dự án **PTDA Homestay** là nền tảng thương mại điện tử chuyên biệt cho dịch vụ lưu trú du lịch homestay tại Việt Nam.

### 🌟 Các cải tiến và tính năng cốt lõi trên nhánh `staging/ptda-unified-login`:
1. **Cổng Đăng nhập Hợp nhất (Unified Login Portal):**
   - Hỗ trợ đăng nhập tất cả các vai trò (Khách hàng, Chủ nhà, Quản trị viên) ngay tại `/login`.
   - Hệ thống tự động thẩm định bảng dữ liệu (`NGUOI_DUNG` và `CHU_HOMESTAY`), mã hóa JWT chứa vai trò chính xác và tự động điều hướng người dùng về trang tương ứng.
   - Vẫn duy trì cổng chuyên biệt `/owner/login` phục vụ riêng cho Chủ nhà & Admin.
2. **Cơ chế Chống Xung đột Trùng phòng (Anti-Conflict Overbooking):**
   - Kiểm tra giao thoa ngày (`NgayNhanPhong`, `NgayTraPhong`) ngay trong transaction với các đơn đã xác nhận (`DaXacNhan`, `DangLuuTru`, `DaHoanThanh`).
3. **Mô phỏng Thanh toán Đa phương thức (Mock Payment & VietQR Demo):**
   - Thanh toán quét mã QR động hoặc Thanh toán Tiền mặt khi nhận phòng.
   - Ghi nhận lịch sử giao dịch minh bạch tại bảng `GIAO_DICH`.
4. **Thẩm định Quyền Đánh giá Nghiêm ngặt (Review Eligibility Barrier):**
   - Chỉ khách hàng có đơn đặt phòng ở trạng thái `DaHoanThanh` (`completed stay`) mới được phép gửi đánh giá và chấm sao.
5. **Hệ thống Lưu trữ Hình ảnh Kép (Dual Storage Driver Architecture):**
   - **Local Mode (Development):** Lưu trữ file tại thư mục `backend/uploads/`, tích hợp kiểm tra mã nhận dạng Magic Bytes, kích thước tối đa 4096px, phòng chống Path Traversal và Symlink.
   - **Supabase Cloud Mode (Production):** Tải ảnh trực tiếp lên Supabase Storage Bucket `homestays`, phân phát qua CDN tốc độ cao.
   - **Fail-Fast Guard:** Trong môi trường Production, backend từ chối khởi động nếu thiếu cấu hình Supabase Cloud Storage để loại trừ nguy cơ mất dữ liệu trên filesystem tạm thời (ephemeral) của Render.
6. **Background Storage Cleanup Queue & Worker:**
   - Cơ chế dọn dẹp ảnh mồ côi (orphaned photos) tự động qua bảng hàng đợi `STORAGE_CLEANUP_QUEUE`.
   - Bảo vệ phân tán bằng **Fencing Token**, **Lease Timeout**, **Exponential Backoff**, và **Crash Recovery**.
   - **Graceful Shutdown:** Đóng an toàn 5 pha (Worker -> HTTP -> Queue -> Prisma -> Exit) với Timeout Budget an toàn.

---

## 2. KIẾN TRÚC HỆ THỐNG & TECH STACK

```
┌────────────────────────────────────────────────────────────────────────┐
│                          NGƯỜI DÙNG / TRÌNH DUYỆT                      │
│        (Khách hàng: /  │  Chủ nhà: /owner  │  Admin: /admin)           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTPS / RESTful API (Bearer JWT)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND SPA (Vercel / Vite 7)                    │
│      React 19 + React Router DOM v7 + Tailwind CSS + Lucide Icons      │
│      Cấu hình Rewrite SPA: vercel.json (chống lỗi 404 Deep Link)       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTP API Calls (Axios)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     BACKEND WEB SERVICE (Render Node.js)               │
│   - Express.js REST API + Middleware (Auth, CORS, Multer Magic Bytes)  │
│   - Fail-Fast Storage Verification (AUDIT-F01)                         │
│   - Background Storage Cleanup Worker (Fencing Token / Crash Recovery) │
│   - Graceful Shutdown Controller (SIGTERM/SIGINT Timeout Budget)       │
└─────────────────────┬────────────────────────────┬─────────────────────┘
                      │                            │
      Prisma ORM 5.x  │ Direct / Pooler            │ Storage API (@supabase/supabase-js)
                      ▼                            ▼
┌────────────────────────────────┐     ┌─────────────────────────────────┐
│     POSTGRESQL DATABASE        │     │     SUPABASE STORAGE CDN        │
│   (Local DB / Supabase Cloud)  │     │   (Bucket: 'homestays' Public)  │
│   - 14 Bảng Nghiệp vụ          │     │   - Lưu trữ ảnh Homestay        │
│   - 1 Bảng Ledger Migrations   │     │   - Truy xuất trực tiếp qua CDN │
│   - Partial Unique Indexes     │     └─────────────────────────────────┘
└────────────────────────────────┘
```

### 2.1 Backend Stack
- **Runtime:** Node.js v20+ LTS (hỗ trợ native `node:test` runner).
- **Framework:** Express.js (ES Modules `import/export`).
- **ORM & Database:** Prisma ORM v5.22.0 kết hợp PostgreSQL 14+ (kết nối kép Transaction Pooler port 6543 và Session Direct port 5432).
- **Bảo mật:** JSON Web Token (JWT), `bcryptjs` hashing (salt rounds = 10).
- **Xử lý ảnh:** Multer, `sharp` (kiểm tra kích thước, re-encode phòng chống mã độc).
- **Lưu trữ đám mây:** `@supabase/supabase-js` v2.x.

### 2.2 Frontend Stack
- **Framework:** React 19 (SPA).
- **Build Tool:** Vite v7 (Hot Module Replacement, tối ưu bundle production).
- **Routing:** React Router DOM v7 (quản lý phân quyền Customer, Host, Admin).
- **CSS / UI:** Tailwind CSS, Lucide React Icons, React Hot Toast.
- **HTTP Client:** Axios tích hợp interceptors tự động gán Bearer Token.

---

## 3. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
D:\ptda\
├── backend\                           # MÁY CHỦ BACKEND API (Express + Prisma)
│   ├── prisma\
│   │   ├── migrations\                # 8 bản migration (4 MySQL baseline + 4 PostgreSQL)
│   │   │   ├── 20251022033346_add_reset_token\
│   │   │   ├── 20251022041952_\
│   │   │   ├── 20251022060444_add_user_status\
│   │   │   ├── 20251022061817_add_owner_status\
│   │   │   ├── 20260916132514_init\
│   │   │   ├── 20261001130122_update_booking_and_homestay_workflow\
│   │   │   ├── 20261010000000_add_payment_and_transactions\
│   │   │   └── 20261106160000_add_storage_cleanup_queue\
│   │   ├── schema.prisma              # Định nghĩa lược đồ cơ sở dữ liệu PostgreSQL
│   │   └── seed.js                    # Script nạp dữ liệu mẫu khởi tạo
│   ├── src\
│   │   ├── config\                    # Cấu hình Prisma Client & Supabase Client
│   │   │   ├── prisma.js
│   │   │   └── supabase.js
│   │   ├── controllers\               # Bộ điều khiển tiếp nhận & phản hồi HTTP
│   │   │   ├── admin.controller.js
│   │   │   ├── auth.controller.js
│   │   │   ├── booking.controller.js
│   │   │   ├── complaint.controller.js
│   │   │   ├── homestay.controller.js
│   │   │   └── owner.controller.js
│   │   ├── middlewares\               # Middleware kiểm soát quyền & tải tệp
│   │   │   ├── admin.middleware.js
│   │   │   ├── auth.middleware.js
│   │   │   ├── owner.middleware.js
│   │   │   └── upload.middleware.js
│   │   ├── routes\                    # Định tuyến API
│   │   │   ├── admin.route.js
│   │   │   ├── auth.route.js
│   │   │   ├── booking.route.js
│   │   │   ├── complaint.route.js
│   │   │   ├── homestay.route.js
│   │   │   └── owner.route.js
│   │   ├── services\                  # Tầng nghiệp vụ xử lý logic lõi
│   │   │   ├── admin.service.js
│   │   │   ├── auth.service.js
│   │   │   ├── booking.service.js
│   │   │   ├── homestay.service.js
│   │   │   ├── owner.service.js
│   │   │   ├── storage.service.js
│   │   │   └── storageCleanupQueue.service.js
│   │   └── server.js                  # Entry point, Graceful Shutdown & Worker Init
│   ├── tests\                         # BỘ KIỂM THỬ TỰ ĐỘNG (15 files)
│   │   ├── helpers\                   # Mocking helpers (mockPrisma, testClient)
│   │   ├── auth.middleware.test.js
│   │   ├── auth.service.test.js
│   │   ├── booking.service.test.js
│   │   ├── cleanupWorker.service.test.js
│   │   ├── homestay.admin.test.js
│   │   ├── imageDelete.service.test.js
│   │   ├── integration.test.js        # 7 Flows API Integration
│   │   ├── payment.service.test.js
│   │   ├── review.service.test.js
│   │   ├── serverLifecycle.service.test.js
│   │   ├── storage.service.test.js
│   │   ├── storageCleanupQueue.service.test.js # 49 Test cases Queue Core
│   │   ├── upload.middleware.test.js
│   │   └── system-e2e.test.js         # End-to-End Browser UI test (Puppeteer)
│   ├── uploads\                       # Thư mục chứa ảnh cục bộ (Local Mode)
│   ├── render.yaml                    # Blueprint triển khai Render Web Service
│   ├── .env.example                   # Biến môi trường mẫu Backend
│   └── package.json
│
├── frontend-simple\                   # GIAO DIỆN NGƯỜI DÙNG (React + Vite)
│   ├── src\
│   │   ├── assets\                    # Ảnh tĩnh, icon
│   │   ├── components\                # UI Components tái sử dụng (Header, Layouts, Modals)
│   │   │   ├── AdminLayout.jsx
│   │   │   ├── CreateHomestayModal.jsx
│   │   │   ├── EditHomestayModal.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── OwnerLayout.jsx
│   │   │   ├── PaymentModal.jsx
│   │   │   └── StarRating.jsx
│   │   ├── pages\                     # Các trang ứng dụng (Customer, Host, Admin)
│   │   │   ├── AdminBookingsPage.jsx
│   │   │   ├── AdminComplaintsPage.jsx
│   │   │   ├── AdminDashboardPage.jsx
│   │   │   ├── AdminHomestaysPage.jsx
│   │   │   ├── AdminOwnersPage.jsx
│   │   │   ├── AdminReviewsPage.jsx
│   │   │   ├── AdminTransactionsPage.jsx
│   │   │   ├── AdminUsersPage.jsx
│   │   │   ├── HomePage.jsx
│   │   │   ├── HomestayDetailPage.jsx
│   │   │   ├── LoginPage.jsx          # Unified Login Portal
│   │   │   ├── MyBookingsPage.jsx
│   │   │   ├── MyComplaintsPage.jsx
│   │   │   ├── MyFavoritesPage.jsx
│   │   │   ├── OwnerBookingsPage.jsx
│   │   │   ├── OwnerCalendarPage.jsx
│   │   │   ├── OwnerComplaintsPage.jsx
│   │   │   ├── OwnerDashboardPage.jsx
│   │   │   ├── OwnerHomestaysPage.jsx
│   │   │   ├── OwnerLoginPage.jsx
│   │   │   ├── OwnerProfilePage.jsx
│   │   │   ├── OwnerRegisterPage.jsx
│   │   │   ├── OwnerTransactionsPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── utils\
│   │   │   └── apiConfig.js           # Cấu hình tập trung API & Supabase CDN URL
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── eslint.config.js               # Cấu hình ESLint 9 Flat Config
│   ├── vercel.json                    # Cấu hình SPA Rewrite trên Vercel Edge
│   ├── .env.example                   # Biến môi trường mẫu Frontend
│   └── package.json
│
└── README.md                          # Tài liệu hướng dẫn toàn diện dự án
```

---

## 4. YÊU CẦU MÔI TRƯỜNG CÀI ĐẶT (PREREQUISITES)

Để chạy dự án cục bộ, máy tính cần cài đặt sẵn:
1. **Node.js:** Phiên bản **v20.x LTS** hoặc **v18.x LTS** (`node -v`).
2. **NPM:** Phiên bản đi kèm Node.js (`npm -v`).
3. **PostgreSQL Server:** Phiên bản **14.x** trở lên (`psql --version`).
4. **Git CLI:** Phiên bản 2.30 trở lên (`git --version`).

---

## 5. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY LOCAL (STEP-BY-STEP)

### Bước 1: Clone Repository & Chuyển nhánh Staging
```bash
git clone https://github.com/HuyIT-art/Kiem_Thu_Phan_Mem_Nhom_16.git
cd Kiem_Thu_Phan_Mem_Nhom_16
git checkout staging/ptda-unified-login
```

### Bước 2: Tạo Cơ sở dữ liệu PostgreSQL Local
Mở PowerShell hoặc terminal `psql`:
```sql
-- Đăng nhập vào PostgreSQL
psql -U postgres

-- Tạo cơ sở dữ liệu cho môi trường Staging (hoặc ptda_homestay)
CREATE DATABASE ptda_staging;

-- Thoát
\q
```

### Bước 3: Cấu hình biến môi trường Backend
Di chuyển vào thư mục `backend`:
```bash
cd backend
```
Tạo file `.env` từ `.env.example`:
- Trên Windows PowerShell: `Copy-Item .env.example .env`
- Trên Linux/macOS: `cp .env.example .env`

Mở file `backend/.env` và cập nhật các thông số cục bộ:
```env
# Kết nối PostgreSQL Local (thay đổi mật khẩu tương ứng của bạn)
DATABASE_URL="postgresql://postgres:mat_khau_cua_ban@localhost:5432/ptda_staging?schema=public"
DIRECT_URL="postgresql://postgres:mat_khau_cua_ban@localhost:5432/ptda_staging?schema=public"

# Khóa bí mật JWT
JWT_SECRET="ptda_homestay_secret_jwt_key_local_staging_2026"

# Cổng Backend
PORT=3000

# URL Frontend (CORS)
FRONTEND_URL="http://localhost:5173"

# Chế độ lưu trữ ảnh (Local Mode không cần Supabase credentials)
STORAGE_DRIVER="local"

# Cấu hình Background Cleanup Worker
STORAGE_CLEANUP_WORKER_ENABLED=true
STORAGE_CLEANUP_BATCH_SIZE=10
STORAGE_CLEANUP_POLL_INTERVAL_MS=10000
STORAGE_CLEANUP_SHUTDOWN_TIMEOUT_MS=20000
```

Cài đặt dependencies:
```bash
npm install
```

---

## 6. QUY TRÌNH QUẢN LÝ DATABASE & MIGRATIONS (PRISMA 5.22.0)

> [!IMPORTANT]
> **QUY TẮC MIGRATION BẮT BUỘC ĐỂ KHÔNG BỊ CRASH:**
> Repository chứa 4 migration MySQL cũ (từ giai đoạn phát triển trước) và 4 migration PostgreSQL mới.
> Nếu chạy trực tiếp `prisma migrate deploy` trên database PostgreSQL mới, Prisma sẽ cố gắng thực thi migration MySQL đầu tiên và báo lỗi syntax error.
> Do đó, **bắt buộc phải thực hiện Baseline** theo đúng trình tự sau:

### 6.1 Baseline 4 Migration MySQL Cũ
Đánh dấu 4 migration lịch sử đã được giải quyết vào bảng ledger `_prisma_migrations`:
```bash
npx prisma migrate resolve --applied 20251022033346_add_reset_token
npx prisma migrate resolve --applied 20251022041952_
npx prisma migrate resolve --applied 20251022060444_add_user_status
npx prisma migrate resolve --applied 20251022061817_add_owner_status
```

### 6.2 Áp dụng 4 Migration PostgreSQL Chính thức
```bash
npx prisma migrate deploy
```
*Kết quả:* Prisma sẽ áp dụng tuần tự 4 migration PostgreSQL (`init`, `update_booking_and_homestay_workflow`, `add_payment_and_transactions`, `add_storage_cleanup_queue`).

Kiểm tra trạng thái migration:
```bash
npx prisma migrate status
# Kết quả mong đợi: "Database schema is up to date!"
```

### 6.3 Tạo Prisma Client & Nạp Dữ liệu Mẫu (Seed Data)
```bash
# Tạo Prisma Client
npx prisma generate

# Nạp dữ liệu mẫu (24 homestay chuẩn, tài khoản demo)
npx prisma db seed
```

> [!CAUTION]
> Tuyệt đối **KHÔNG SỬ DỤNG** `npx prisma db push` hoặc `npx prisma migrate reset` trên môi trường Staging/Production vì sẽ làm sai lệch ledger hoặc xóa sạch dữ liệu.

### 6.4 Khởi động Backend
```bash
# Chế độ phát triển (tự động reload khi sửa file):
npm run dev

# Hoặc chế độ thông thường:
npm start
```
*Server sẽ thông báo lắng nghe tại:* `http://localhost:3000`

---

### Bước 4: Cấu hình & Khởi chạy Frontend
Mở cửa sổ Terminal/PowerShell thứ hai:
```bash
cd frontend-simple
```

Tạo file `.env` từ `.env.example`:
- Windows: `Copy-Item .env.example .env`
- Linux/macOS: `cp .env.example .env`

Nội dung `frontend-simple/.env`:
```env
VITE_API_URL="http://localhost:3000"
```

Cài đặt dependencies và chạy ứng dụng:
```bash
npm install
npm run dev
```
*Giao diện mở tại:* `http://localhost:5173`

---

## 7. DANH MỤC URLS & DANH SÁCH TÀI KHOẢN DEMO

### 7.1 Danh mục Đường dẫn (Routing Map)
| Phân hệ / Tính năng | Đường dẫn URL | Mô tả chức năng |
| :--- | :--- | :--- |
| **Trang chủ Khách hàng** | `http://localhost:5173/` | Tìm kiếm, xem 24 homestay, lọc giá, lọc địa điểm |
| **Cổng Đăng nhập Hợp nhất** | `http://localhost:5173/login` | Đăng nhập chung mọi vai trò (Customer / Host / Admin) |
| **Đăng ký Khách hàng** | `http://localhost:5173/register` | Đăng ký tài khoản khách mới |
| **Chi tiết Homestay** | `http://localhost:5173/homestay/:id` | Xem chi tiết tiện nghi, lịch trống, đặt phòng, xem review |
| **Đặt phòng của tôi** | `http://localhost:5173/my-bookings` | Quản lý đơn cá nhân, thanh toán QR, gửi khiếu nại, hủy phòng |
| **Danh sách Yêu thích** | `http://localhost:5173/my-favorites` | Quản lý danh sách homestay đã thả tim yêu thích |
| **Hồ sơ Cá nhân** | `http://localhost:5173/profile` | Xem và cập nhật thông tin cá nhân khách hàng |
| **Cổng Chủ homestay** | `http://localhost:5173/owner/login` | Cổng đăng nhập dành riêng cho Host và Quản trị viên |
| **Dashboard Chủ homestay** | `http://localhost:5173/owner/dashboard` | Thống kê doanh thu, tỷ lệ lấp đầy, số đơn mới |
| **Quản lý Homestay (Host)** | `http://localhost:5173/owner/homestays` | Thêm mới homestay, tải ảnh, sửa giá, xóa/ẩn homestay |
| **Lịch phòng (Host)** | `http://localhost:5173/owner/calendar` | Ma trận lịch phòng trống theo từng ngày trong tháng |
| **Xử lý Đơn (Host)** | `http://localhost:5173/owner/bookings` | Xác nhận đơn `ChoXacNhan`, Check-in, Check-out, Thu tiền mặt |
| **Giao dịch (Host)** | `http://localhost:5173/owner/transactions` | Lịch sử dòng tiền giao dịch của các homestay sở hữu |
| **Dashboard Quản trị viên** | `http://localhost:5173/admin/dashboard` | Thống kê toàn hệ thống: người dùng, doanh thu, homestay |
| **Kiểm duyệt Homestay** | `http://localhost:5173/admin/homestays` | Phê duyệt (`DaDuyet`) hoặc Từ chối (`TuChoi`) homestay |
| **Quản lý Người dùng** | `http://localhost:5173/admin/users` | Khóa (`isActive=false`) hoặc mở khóa tài khoản khách hàng |
| **Quản lý Chủ nhà** | `http://localhost:5173/admin/owners` | Khóa hoặc kích hoạt lại quyền hoạt động của chủ nhà |
| **Giải quyết Khiếu nại** | `http://localhost:5173/admin/complaints` | Tiếp nhận phản ánh từ khách và đưa ra phương án xử lý |
| **Quản lý Đánh giá** | `http://localhost:5173/admin/reviews` | Kiểm duyệt và gỡ bỏ đánh giá không phù hợp |
| **Backend Health Check** | `http://localhost:3000/` | Endpoint phản hồi HTTP 200 kiểm tra trạng thái máy chủ |

---

### 7.2 Danh sách Tài khoản Demo Khởi tạo sẵn
Sau khi chạy `npx prisma db seed`, bạn có thể đăng nhập ngay với các tài khoản sau:

| Vai trò (Role) | Email đăng nhập | Mật khẩu mặc định | Cổng đăng nhập | Quyền hạn nổi bật |
| :--- | :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@test.com` | `password123` | `/login` hoặc `/owner/login` | Quyền duyệt homestay, khóa người dùng, giải quyết khiếu nại |
| **Chủ homestay (Host)** | `seed.owner@test.com` | `password123` | `/login` hoặc `/owner/login` | Quản lý 24 homestay mẫu, xác nhận đơn, xem lịch phòng, đối soát tiền |
| **Khách hàng (Customer)** | `customer@test.com` | `password123` | `/login` | Đặt phòng, thanh toán QR, đánh giá dịch vụ sau lưu trú |

---

## 8. HƯỚNG DẪN CHI TIẾT LUỒNG NGHIỆP VỤ

### 8.1 Luồng Khách hàng (Customer Journey)
1. **Tìm kiếm & Xem chi tiết:** Tìm kiếm homestay theo địa điểm, chọn ngày dự kiến. Xem bộ sưu tập ảnh, tiện nghi và bảng lịch phòng trống.
2. **Đặt phòng:** Chọn ngày nhận - trả phòng. Hệ thống tính số đêm và kiểm tra tức thời chống trùng lịch (`ChoXacNhan`).
3. **Thanh toán:**
   - **Chuyển khoản QR:** Mở modal quét mã VietQR demo $\rightarrow$ Bấm **Mô phỏng thanh toán thành công** $\rightarrow$ Hệ thống chuyển trạng thái đơn sang `DaXacNhan` và `DaThanhToan`.
   - **Tiền mặt:** Chọn thanh toán khi nhận phòng $\rightarrow$ Đơn ghi nhận phương thức `TienMat`, chờ Chủ nhà xác nhận thu tiền tại quầy.
4. **Đánh giá dịch vụ:** Sau khi kỳ lưu trú hoàn tất (`DaHoanThanh`), nút **Viết đánh giá** sẽ được mở khóa để khách chấm sao và gửi bình luận.

### 8.2 Luồng Chủ nhà (Host Operations)
1. **Duyệt đơn đặt phòng:** Tiếp nhận đơn ở trạng thái `ChoXacNhan`, bấm **Xác nhận đặt phòng**.
2. **Check-in / Check-out:** Chuyển trạng thái đơn sang `DangLuuTru` khi khách đến và `DaHoanThanh` khi khách rời đi.
3. **Thu tiền mặt:** Đối với đơn chọn tiền mặt, Host bấm nút **Xác nhận đã thu tiền** để chốt trạng thái thanh toán.
4. **Quản lý phòng & ảnh:** Tạo homestay mới, tải ảnh phòng. Khi xóa ảnh, hệ thống tự động xóa an toàn và đưa vào hàng dọn dẹp Storage Cleanup Queue.

### 8.3 Luồng Quản trị viên (Admin Management)
1. **Kiểm duyệt:** Xét duyệt homestay mới đăng ký của đối tác trước khi hiển thị ra trang chủ.
2. **Kiểm soát bảo mật:** Khóa tài khoản khách hoặc chủ nhà có hành vi vi phạm điều khoản; tự động chặn truy cập vào hệ thống.
3. **Xử lý khiếu nại:** Đọc nội dung khiếu nại từ khách hàng và gửi phản hồi phương án giải quyết dứt điểm.

---

## 9. HƯỚNG DẪN KIỂM THỬ TỰ ĐỘNG (AUTOMATED TESTING SUITE)

Dự án áp dụng quy trình kiểm thử hộp trắng (White-box testing) và kiểm thử tích hợp (Integration testing) toàn diện trên nền tảng **Node.js Native Test Runner (`node:test`)**.

### 9.1 Chạy Toàn bộ Test Suite Backend
```bash
cd backend
npm test
```
- **Cấu hình thực thi:** `node --test --test-concurrency=1 tests/*.service.test.js tests/*.middleware.test.js tests/*.admin.test.js tests/integration.test.js`
- **Kết quả nghiệm thu:** **302/302 tests PASS (100%)** trên 67 test suites.
- **Thời gian chạy:** ~14 giây.

### 9.2 Chạy Từng Nhóm Kiểm thử Riêng biệt
```bash
# 1. Chạy riêng Unit Tests (270 test cases):
npm run test:unit

# 2. Chạy riêng Integration Tests API (32 test cases):
npm run test:integration

# 3. Chạy System E2E Browser Test (Puppeteer):
# (Yêu cầu bật sẵn backend :3000 và frontend :5173 trước khi chạy)
npm run test:system
```

### 9.3 Kiểm tra Chất lượng Mã nguồn Frontend
```bash
cd frontend-simple

# 1. Kiểm tra Linter (ESLint 9 Flat Config):
npm run lint
# Kết quả mong đợi: 0 errors, 0 warnings

# 2. Chạy Production Build:
npm run build
# Kết quả mong đợi: Build thành công dist/index.html, dist/assets/*.js, dist/assets/*.css
```

---

## 10. HƯỚNG DẪN TRIỂN KHAI CLOUD STAGING (SUPABASE + RENDER + VERCEL)

### 10.1 Kiến trúc Triển khai Đám mây
- **Supabase Cloud (ap-southeast-1):** Cơ sở dữ liệu PostgreSQL và Storage Bucket `homestays` (Public CDN).
- **Render (Singapore):** Web Service chạy Node.js Backend API, cấu hình Blueprint qua `backend/render.yaml`.
- **Vercel:** Single Page Application (React 19 + Vite 7), xử lý client routing qua `frontend-simple/vercel.json`.

---

### 10.2 Bảng Biến Môi Trường Cần Thiết

#### A. Render Web Service (Backend)
| Biến môi trường | Bắt buộc | Giá trị mẫu | Mục đích |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Có | `production` | Bật chế độ tối ưu production và Fail-Fast check |
| `PORT` | Có | `10000` | Cổng HTTP mà Render gán cho container |
| `DATABASE_URL` | Có | `postgresql://postgres.[ref]:[pwd]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true` | Kết nối Transaction Pooler cho truy vấn ứng dụng |
| `DIRECT_URL` | Có | `postgresql://postgres.[ref]:[pwd]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` | Kết nối Session Direct cho Prisma migration deploy |
| `JWT_SECRET` | Có | Chuỗi ngẫu nhiên tối thiểu 32 ký tự bí mật | Ký và xác thực mã thông báo JWT |
| `STORAGE_DRIVER` | Có | `supabase` | Bắt buộc trên Production để lưu trữ Cloud Storage |
| `SUPABASE_URL` | Có | `https://[project-ref].supabase.co` | URL gốc của dự án Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Có | `eyJh...` (Service Role Secret Key) | Quyền quản trị đọc/ghi tệp Storage |
| `FRONTEND_URL` | Khuyên dùng | `https://ptda-homestay-staging.vercel.app` | Khai báo URL frontend phục vụ CORS |

#### B. Vercel Project (Frontend)
| Biến môi trường | Bắt buộc | Giá trị mẫu | Mục đích |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | Có | `https://ptda-homestay-backend.onrender.com` | Địa chỉ Backend API triển khai trên Render |
| `VITE_SUPABASE_URL` | Khuyên dùng | `https://[project-ref].supabase.co` | URL tải ảnh trực tiếp từ Supabase Storage CDN |

---

### 10.3 Quy trình Triển khai Chuẩn 4 Bước (Tránh lỗi Crash Migration)

```
[Bước 1: Tạo Supabase Project & Bucket]
                  │
                  ▼
[Bước 2: Chạy Baseline 4 MySQL Migrations trên Supabase CLI]
                  │
                  ▼
[Bước 3: Chạy prisma migrate deploy trên Supabase]
                  │
                  ▼
[Bước 4: Deploy Render Backend & Vercel Frontend]
```

#### Bước 1: Khởi tạo trên Supabase
1. Tạo dự án Supabase mới (chọn Region `ap-southeast-1 Singapore`).
2. Vào **Storage** $\rightarrow$ **New Bucket** $\rightarrow$ Tạo bucket tên `homestays` $\rightarrow$ Tích chọn **Public bucket**.
3. Lưu lại chuỗi kết nối Database (Session Mode port 5432) và khóa `service_role` từ **Project Settings** $\rightarrow$ **API**.

#### Bước 2: Thực hiện Baseline 4 Migration MySQL trên Supabase
Từ terminal máy quản trị (với biến `DIRECT_URL` tạm thời trỏ đến database Supabase port 5432):
```bash
npx prisma migrate resolve --applied 20251022033346_add_reset_token
npx prisma migrate resolve --applied 20251022041952_
npx prisma migrate resolve --applied 20251022060444_add_user_status
npx prisma migrate resolve --applied 20251022061817_add_owner_status
```

#### Bước 3: Áp dụng 4 Migration PostgreSQL chính thức
```bash
npx prisma migrate deploy
# Kiểm tra:
npx prisma migrate status
# Kết quả: "Database schema is up to date!"
```

#### Bước 4: Triển khai Render & Vercel
1. **Render:** Tạo Web Service mới trỏ tới repository, chọn Root Directory là `backend`, cấu hình các biến môi trường tại mục 10.2A.
2. **Vercel:** Tạo dự án mới trỏ tới repository, chọn Root Directory là `frontend-simple`, cấu hình `VITE_API_URL` trỏ về domain Render vừa tạo.

---

## 11. BẢNG KHẮC PHỤC SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

| Hiện tượng sự cố | Nguyên nhân kỹ thuật | Biện pháp xử lý triệt để |
| :--- | :--- | :--- |
| **`PrismaClientInitializationError: P1001`** | PostgreSQL service chưa chạy hoặc sai port 5432. | Kiểm tra `services.msc` trên Windows $\rightarrow$ Start service `postgresql-x64-xx`. Xác nhận lại chuỗi `DATABASE_URL` trong `.env`. |
| **Lỗi `Syntax error` khi chạy `prisma migrate deploy` trên DB mới** | Database mới chưa được baseline 4 migration MySQL cũ. | Chạy 4 lệnh `npx prisma migrate resolve --applied` cho các migration MySQL trước theo hướng dẫn ở Mục 6.1. |
| **Backend crash ngay khi khởi động trên Render (`[STORAGE_CONFIG_CRITICAL]`)** | Thiếu biến `STORAGE_DRIVER=supabase` hoặc thiếu `SUPABASE_SERVICE_ROLE_KEY`. | Thêm đầy đủ 3 biến `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, và `SUPABASE_SERVICE_ROLE_KEY` trong Environment Variables của Render. |
| **Lỗi `404 Not Found` khi bấm F5 tải lại trang con trên Vercel** | Vercel Edge chưa được cấu hình Rewrite SPA về `index.html`. | Đảm bảo file `frontend-simple/vercel.json` chứa rewrite rules cho `/(.*)` trỏ về `/index.html`. |
| **Lỗi `EADDRINUSE: address already in use :::3000`** | Một tiến trình Node.js cũ chưa được giải phóng đang chiếm cổng 3000. | Trên PowerShell: `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess \| Stop-Process -Force`. |
| **Xung đột kiểm thử khi chạy `npm test` (`0 !== 2` hoặc `5 !== 88`)** | Test runner chạy song song nhiều tiến trình cùng truy cập vào bảng `STORAGE_CLEANUP_QUEUE`. | Chạy với cờ `--test-concurrency=1` (đã được tích hợp sẵn trong `npm test`). |
| **Ảnh homestay không hiển thị trên giao diện** | Đường dẫn ảnh sai hoặc chưa cấu hình đúng `VITE_SUPABASE_URL` / `STORAGE_DRIVER`. | Kiểm tra file `frontend-simple/src/utils/apiConfig.js`. Đảm bảo các ảnh upload trên Supabase nằm trong bucket công khai `homestays`. |

---

## 👥 THÔNG TIN DỰ ÁN & NHÓM THỰC HIỆN

- **Dự án:** Nền tảng Đặt phòng & Quản lý Homestay trực tuyến (PTDA Homestay)
- **Nhóm thực hiện:** Nhóm 16
- **Môn học:** Kiểm thử phần mềm & Phát triển dự án (Học kỳ 1 - 2026)
- **Bản quyền:** Mã nguồn phục vụ mục đích học tập, nghiên cứu và phát triển phần mềm ứng dụng.
