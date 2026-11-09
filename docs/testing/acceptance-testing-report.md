# BÁO CÁO KIỂM THỬ THEO TIÊU CHÍ CHẤP NHẬN MÔ PHỎNG (SIMULATED ACCEPTANCE TESTING REPORT)
**Dự án:** Hệ thống Quản lý và Đặt phòng Homestay (PTDA Homestay)  
**Môn học:** Đảm bảo chất lượng & Kiểm thử phần mềm  
**Phương pháp:** Đối soát theo Tiêu chí chấp nhận mô phỏng (Simulated Acceptance Criteria) của 3 nhóm tác nhân (Khách hàng, Chủ nhà, Quản trị viên)  
**Thời gian thực hiện:** Tháng 10/2026  
**Đánh giá tổng quan:** 16/16 Tiêu chí chức năng mô phỏng ĐẠT YÊU CẦU NỘI BỘ  

---

## 1. MỤC TIÊU VÀ TÍNH CHẤT CỦA KIỂM THỬ CHẤP NHẬN

### 1.1. Mục tiêu
- Đối soát các chức năng đã xây dựng của hệ thống phần mềm với các yêu cầu nghiệp vụ mô phỏng trong đề cương BTL môn học.
- Đảm bảo hệ thống cung cấp đủ các luồng tác vụ cho 3 nhóm đối tượng: Khách hàng (Customer), Chủ Homestay (Host/Owner) và Quản trị viên (Admin).

### 1.2. Lưu ý về Tính chất Pháp lý & Nghiệm thu
> [!IMPORTANT]
> - Đây là **kiểm thử theo tiêu chí chấp nhận mô phỏng (Simulated UAT)** do nhóm phát triển tự xây dựng và tự đối soát.
> - Hệ thống **CHƯA ĐƯỢC nghiệm thu chính thức** bởi khách hàng doanh nghiệp bên ngoài hoặc hội đồng chấm thi môn học.
> - Buổi nghiệm thu thực tế chính thức sẽ diễn ra tại buổi báo cáo bảo vệ Bài tập lớn.

---

## 2. MA TRẬN TIÊU CHÍ CHẤP NHẬN MÔ PHỎNG (UAT MATRIX)

### 2.1. Phân hệ Khách hàng (7 Tiêu chí)
| Mã UAT | Câu chuyện Người dùng | Tiêu chí Chấp nhận Mô phỏng | Kết quả Đối soát |
| :---: | :--- | :--- | :---: |
| **UAT-CUS-01** | Khám phá và lọc homestay | Hiển thị homestay công khai kèm ảnh, giá, địa chỉ rõ ràng | **ĐẠT (Mô phỏng)** |
| **UAT-CUS-02** | Xem chi tiết và lịch phòng | Hiển thị ma trận ngày đã kín chỗ, chặn chọn ngày trùng | **ĐẠT (Mô phỏng)** |
| **UAT-CUS-03** | Đặt phòng nhanh chóng | Tính tiền tự động, kiểm tra số khách, lưu đơn `ChoXacNhan` | **ĐẠT (Mô phỏng)** |
| **UAT-CUS-04** | Thanh toán trực tuyến mô phỏng | Có mã QR demo, nội dung chuyển khoản, nút bấm mô phỏng | **ĐẠT (Mô phỏng)** |
| **UAT-CUS-05** | Thanh toán tiền mặt | Tùy chọn tiền mặt tại homestay, không ép thanh toán trước | **ĐẠT (Mô phỏng)** |
| **UAT-CUS-06** | Theo dõi lịch sử đặt phòng | Xem danh sách đơn cá nhân trong "Đặt phòng của tôi" | **ĐẠT (Mô phỏng)** |
| **UAT-CUS-07** | Đánh giá sau kỳ lưu trú | Chỉ cho phép đánh giá sau khi hoàn tất kỳ nghỉ | **ĐẠT (Mô phỏng)** |

### 2.2. Phân hệ Chủ Homestay (5 Tiêu chí)
| Mã UAT | Câu chuyện Người dùng | Tiêu chí Chấp nhận Mô phỏng | Kết quả Đối soát |
| :---: | :--- | :--- | :---: |
| **UAT-OWN-01** | Cổng đăng nhập Host | Cổng đăng nhập `/owner/login`, phân quyền riêng với khách | **ĐẠT (Mô phỏng)** |
| **UAT-OWN-02** | Thống kê Dashboard | Hiển thị tổng doanh thu tích lũy và số đơn theo trạng thái | **ĐẠT (Mô phỏng)** |
| **UAT-OWN-03** | Phê duyệt đơn đặt | Có chức năng Chấp nhận hoặc Từ chối đơn kèm lý do | **ĐẠT (Mô phỏng)** |
| **UAT-OWN-04** | Xác nhận thu tiền mặt | Nút xác nhận đã thu tiền mặt chuyển trạng thái thanh toán | **ĐẠT (Mô phỏng)** |
| **UAT-OWN-05** | Quản lý danh mục | Xem danh sách homestay sở hữu, thêm/sửa thông tin | **ĐẠT (Mô phỏng)** |

### 2.3. Phân hệ Quản trị viên (4 Tiêu chí)
| Mã UAT | Câu chuyện Người dùng | Tiêu chí Chấp nhận Mô phỏng | Kết quả Đối soát |
| :---: | :--- | :--- | :---: |
| **UAT-ADM-01** | Bảng điều khiển Quản trị | Hiển thị tổng số người dùng, tổng homestay, tổng doanh thu | **ĐẠT (Mô phỏng)** |
| **UAT-ADM-02** | Kiểm duyệt homestay mới | Xem danh sách chờ duyệt, nút Phê duyệt / Từ chối hồ sơ | **ĐẠT (Mô phỏng)** |
| **UAT-ADM-03** | Quản trị tài khoản | Xem toàn bộ tài khoản, hỗ trợ khóa/mở khóa khi vi phạm | **ĐẠT (Mô phỏng)** |
| **UAT-ADM-04** | Bảo mật phân quyền | Chặn người dùng thường và chủ nhà gọi vào API Quản trị | **ĐẠT (Mô phỏng)** |

---

## 3. KẾT LUẬN VÀ KẾ HOẠCH NGHIỆM THU CHÍNH THỨC

1. Hệ thống đã đáp ứng đầy đủ 16 tiêu chí chức năng mô phỏng do nhóm đặt ra.
2. **Kế hoạch tiếp theo**: Chuẩn bị kịch bản demo trực tiếp cho buổi bảo vệ Bài tập lớn để Giảng viên hướng dẫn và Hội đồng nghiệm thu thực tế.
