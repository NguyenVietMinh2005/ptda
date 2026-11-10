// src/services/payment.service.js
import prisma from '../config/prisma.js';
import QRCode from 'qrcode';

/**
 * Lấy thông tin thanh toán cho một đơn đặt phòng kèm mã QR demo
 */
export const getPaymentInfo = async (bookingId, userId, ownerId = null) => {
  const booking = await prisma.dAT_PHONG.findUnique({
    where: { MaDatPhong: bookingId },
    include: {
      CHI_TIET_DAT_PHONG: {
        include: {
          HOMESTAY: {
            include: {
              CHU_HOMESTAY: {
                select: {
                  MaChu: true,
                  HoTen: true,
                  SoDienThoai: true,
                },
              },
            },
          },
        },
      },
      GIAO_DICH: {
        orderBy: { created_at: 'desc' },
      },
    },
  });

  if (!booking) {
    throw new Error('Không tìm thấy đơn đặt phòng');
  }

  // Kiểm tra quyền: phải là chủ đơn (User) hoặc chủ Homestay sở hữu
  const isGuest = userId && booking.MaNguoiDung === userId;
  const isOwner = ownerId && booking.CHI_TIET_DAT_PHONG.some(
    (detail) => detail.HOMESTAY.MaChu === ownerId
  );

  if (!isGuest && !isOwner) {
    throw new Error('Bạn không có quyền xem thông tin thanh toán đơn này');
  }

  const homestay = booking.CHI_TIET_DAT_PHONG[0]?.HOMESTAY;
  const isPaid = booking.TrangThaiThanhToan === 'DaThanhToan';
  const isCancelled = booking.TrangThai === 'DaHuy';

  // Điều kiện để khách có thể thanh toán:
  // - Chưa thanh toán ('ChuaThanhToan')
  // - Chưa bị hủy
  const canPay = !isPaid && !isCancelled;

  let paymentRestrictionMessage = '';
  if (isCancelled) {
    paymentRestrictionMessage = 'Đơn đặt phòng này đã bị hủy, không thể thực hiện thanh toán.';
  } else if (isPaid) {
    paymentRestrictionMessage = 'Đơn đặt phòng này đã được thanh toán thành công.';
  }

  // Nội dung mã QR mô phỏng - KHÔNG dùng thông tin thật, ghi rõ DEMO
  const memoContent = `THANHTOAN DP${booking.MaDatPhong}`;
  const qrDemoText = `DEMOPAY|DP${booking.MaDatPhong}|${booking.Gia}|${memoContent}|HOMESTAY_DEMO_PROJECT`;

  let qrCodeDataUrl = null;
  try {
    qrCodeDataUrl = await QRCode.toDataURL(qrDemoText, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 280,
      color: {
        dark: '#1e3a2b',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Lỗi khi tạo mã QR demo:', err);
  }

  return {
    bookingId: booking.MaDatPhong,
    homestayName: homestay?.TenHomestay || 'Homestay',
    homestayAddress: homestay?.DiaDiem || '',
    ngayNhan: booking.NgayNhan,
    ngayTra: booking.NgayTra,
    soLuongKhach: booking.SoLuong,
    soTien: parseFloat(booking.Gia),
    trangThaiDon: booking.TrangThai,
    trangThaiThanhToan: booking.TrangThaiThanhToan,
    phuongThucThanhToan: booking.PhuongThucThanhToan || null,
    ngayThanhToan: booking.NgayThanhToan,
    canPay,
    isPaid,
    paymentRestrictionMessage,
    demoBankInfo: {
      bankName: 'DEMO BANK (Ngân hàng mô phỏng đồ án)',
      accountNumber: '0000-DEMO-8888',
      accountName: 'HE THONG HOMESTAY DEMO',
      amount: parseFloat(booking.Gia),
      transferMemo: memoContent,
      notice: 'THANH TOÁN DEMO — KHÔNG CHUYỂN TIỀN THẬT',
      qrCodeDataUrl,
    },
    transactions: booking.GIAO_DICH,
  };
};

/**
 * Khách hàng chọn phương thức thanh toán (Tiền mặt hoặc Chuyển khoản QR)
 */
export const selectPaymentMethod = async (bookingId, userId, method) => {
  if (!['ChuyenKhoanQR', 'TienMat'].includes(method)) {
    throw new Error('Phương thức thanh toán không hợp lệ. Chỉ chấp nhận ChuyenKhoanQR hoặc TienMat.');
  }

  const booking = await prisma.dAT_PHONG.findUnique({
    where: { MaDatPhong: bookingId },
  });

  if (!booking) {
    throw new Error('Không tìm thấy đơn đặt phòng');
  }

  if (booking.MaNguoiDung !== userId) {
    throw new Error('Bạn không có quyền thay đổi phương thức thanh toán cho đơn này');
  }

  if (booking.TrangThai === 'DaHuy') {
    throw new Error('Đơn đặt phòng đã bị hủy.');
  }

  if (booking.TrangThaiThanhToan === 'DaThanhToan') {
    throw new Error('Đơn đặt phòng đã được thanh toán.');
  }

  const user = await prisma.nGUOI_DUNG.findUnique({
    where: { MaNguoiDung: userId },
    select: { HoTen: true },
  });

  // Cập nhật phương thức thanh toán và ghi nhận lịch sử giao dịch
  const updatedBooking = await prisma.$transaction(async (tx) => {
    const updated = await tx.dAT_PHONG.update({
      where: { MaDatPhong: bookingId },
      data: {
        PhuongThucThanhToan: method,
      },
    });

    const txnId = `TX-INIT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    await tx.gIAO_DICH.create({
      data: {
        MaGiaoDich: txnId,
        MaDatPhong: bookingId,
        SoTien: booking.Gia,
        PhuongThuc: method,
        TrangThai: 'ChoThanhToan',
        NguoiThaoTac: user?.HoTen || 'Khách hàng',
        MaNguoiThaoTac: userId,
        VaiTroNguoiThaoTac: 'KhachHang',
        GhiChu:
          method === 'TienMat'
            ? 'Khách chọn thanh toán tiền mặt khi nhận phòng (sẽ thanh toán trực tiếp cho chủ homestay)'
            : 'Khách chọn thanh toán chuyển khoản qua mã QR mô phỏng',
      },
    });

    return updated;
  });

  return updatedBooking;
};

/**
 * Mô phỏng kết quả thanh toán chuyển khoản QR (Demo: Thành công hoặc Thất bại)
 * Chỉ cho phép trong môi trường phát triển/đồ án
 */
export const simulatePayment = async (bookingId, userId, { result, reason }) => {
  const booking = await prisma.dAT_PHONG.findUnique({
    where: { MaDatPhong: bookingId },
    include: {
      NGUOI_DUNG: {
        select: { HoTen: true },
      },
    },
  });

  if (!booking) {
    throw new Error('Không tìm thấy đơn đặt phòng');
  }

  if (booking.MaNguoiDung !== userId) {
    throw new Error('Bạn không có quyền thực hiện thanh toán cho đơn này');
  }

  if (booking.TrangThai === 'DaHuy') {
    throw new Error('Đơn đặt phòng đã bị hủy, không thể thực hiện giao dịch.');
  }

  if (booking.TrangThaiThanhToan === 'DaThanhToan') {
    throw new Error('Đơn đặt phòng này đã được thanh toán trước đó. Không thể thanh toán lần hai.');
  }

  const txnId = `TX-DEMO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const userName = booking.NGUOI_DUNG?.HoTen || 'Khách hàng';

  if (result === 'success') {
    // Mô phỏng thành công: Cập nhật DAT_PHONG và lưu GIAO_DICH
    const { updatedBooking, transaction } = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.dAT_PHONG.update({
        where: { MaDatPhong: bookingId },
        data: {
          TrangThai: 'DaXacNhan', // Đã thanh toán online -> tự động xác nhận đơn
          TrangThaiThanhToan: 'DaThanhToan',
          PhuongThucThanhToan: booking.PhuongThucThanhToan || 'ChuyenKhoanQR',
          NgayThanhToan: new Date(),
        },
      });

      const transaction = await tx.gIAO_DICH.create({
        data: {
          MaGiaoDich: txnId,
          MaDatPhong: bookingId,
          SoTien: booking.Gia, // Số tiền được lấy 100% từ Database
          PhuongThuc: booking.PhuongThucThanhToan || 'ChuyenKhoanQR',
          TrangThai: 'ThanhCong',
          NguoiThaoTac: userName,
          MaNguoiThaoTac: userId,
          VaiTroNguoiThaoTac: 'KhachHang',
          NgayThanhToan: new Date(),
          GhiChu: 'Mô phỏng thanh toán thành công qua QR (Môi trường đồ án/demo)',
        },
      });

      return { updatedBooking, transaction };
    });

    return {
      success: true,
      message: 'Mô phỏng thanh toán thành công!',
      transaction,
      booking: updatedBooking,
    };
  } else {
    // Mô phỏng thất bại: Giữ nguyên TrangThaiThanhToan = ChuaThanhToan, ghi nhận vào GIAO_DICH
    const transaction = await prisma.gIAO_DICH.create({
      data: {
        MaGiaoDich: txnId,
        MaDatPhong: bookingId,
        SoTien: booking.Gia,
        PhuongThuc: booking.PhuongThucThanhToan || 'ChuyenKhoanQR',
        TrangThai: 'ThatBai',
        NguoiThaoTac: userName,
        MaNguoiThaoTac: userId,
        VaiTroNguoiThaoTac: 'KhachHang',
        GhiChu: reason || 'Mô phỏng thanh toán thất bại: Số dư không đủ hoặc người dùng hủy thao tác',
      },
    });

    return {
      success: false,
      message: 'Mô phỏng thanh toán thất bại (đã ghi nhận lịch sử vào hệ thống). Đơn phòng chưa được thanh toán.',
      transaction,
      booking,
    };
  }
};

/**
 * Chủ homestay hoặc Quản trị viên xác nhận đã thu tiền mặt khi khách nhận phòng
 * KHÁCH HÀNG TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP GỌI HÀM NÀY
 */
export const confirmCashPayment = async (bookingId, ownerId, adminUser = null) => {
  const booking = await prisma.dAT_PHONG.findUnique({
    where: { MaDatPhong: bookingId },
    include: {
      CHI_TIET_DAT_PHONG: {
        include: {
          HOMESTAY: true,
        },
      },
    },
  });

  if (!booking) {
    throw new Error('Không tìm thấy đơn đặt phòng');
  }

  // Xác thực quyền: Người gọi phải là Chủ sở hữu homestay này hoặc Admin
  const isOwner = ownerId && booking.CHI_TIET_DAT_PHONG.some(
    (detail) => detail.HOMESTAY.MaChu === ownerId
  );
  const isAdmin = !!adminUser;

  if (!isOwner && !isAdmin) {
    throw new Error('Bạn không có quyền xác nhận thu tiền cho đơn đặt phòng này');
  }

  if (booking.TrangThai === 'DaHuy') {
    throw new Error('Đơn đặt phòng đã bị hủy, không thể thu tiền');
  }

  if (booking.TrangThaiThanhToan === 'DaThanhToan') {
    throw new Error('Đơn đặt phòng này đã được xác nhận thanh toán trước đó');
  }

  let operatorName = 'Chủ Homestay';
  let operatorId = ownerId;
  let operatorRole = 'ChuHomestay';

  if (isAdmin) {
    operatorName = adminUser.HoTen || 'Quản Trị Viên';
    operatorId = adminUser.MaChu || adminUser.MaNguoiDung || 18;
    operatorRole = 'Admin';
  } else if (ownerId) {
    const owner = await prisma.cHU_HOMESTAY.findUnique({
      where: { MaChu: ownerId },
      select: { HoTen: true },
    });
    if (owner) operatorName = owner.HoTen;
  }

  const txnId = `TX-CASH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { updatedBooking, transaction } = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.dAT_PHONG.update({
      where: { MaDatPhong: bookingId },
      data: {
        TrangThaiThanhToan: 'DaThanhToan',
        PhuongThucThanhToan: 'TienMat',
        NgayThanhToan: new Date(),
      },
    });

    const transaction = await tx.gIAO_DICH.create({
      data: {
        MaGiaoDich: txnId,
        MaDatPhong: bookingId,
        SoTien: booking.Gia,
        PhuongThuc: 'TienMat',
        TrangThai: 'ThanhCong',
        NguoiThaoTac: operatorName,
        MaNguoiThaoTac: operatorId,
        VaiTroNguoiThaoTac: operatorRole,
        NgayThanhToan: new Date(),
        GhiChu: `Xác nhận đã nhận tiền mặt trực tiếp từ khách khi nhận phòng bởi ${operatorName}`,
      },
    });

    return { updatedBooking, transaction };
  });

  return {
    success: true,
    message: 'Đã xác nhận thu tiền mặt thành công!',
    transaction,
    booking: updatedBooking,
  };
};

/**
 * Lấy lịch sử tất cả các giao dịch của một đơn đặt phòng
 */
export const getBookingTransactions = async (bookingId, userId, ownerId = null) => {
  const booking = await prisma.dAT_PHONG.findUnique({
    where: { MaDatPhong: bookingId },
    include: {
      CHI_TIET_DAT_PHONG: {
        include: { HOMESTAY: true },
      },
      GIAO_DICH: {
        orderBy: { created_at: 'desc' },
      },
    },
  });

  if (!booking) {
    throw new Error('Không tìm thấy đơn đặt phòng');
  }

  const isGuest = userId && booking.MaNguoiDung === userId;
  const isOwner = ownerId && booking.CHI_TIET_DAT_PHONG.some(
    (detail) => detail.HOMESTAY.MaChu === ownerId
  );

  if (!isGuest && !isOwner) {
    throw new Error('Bạn không có quyền xem lịch sử giao dịch của đơn này');
  }

  return booking.GIAO_DICH;
};

