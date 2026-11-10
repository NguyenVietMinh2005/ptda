// src/services/owner.service.js
import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
/**
 * Đăng ký một tài khoản Chủ Homestay mới
 */
export const registerOwner = async (ownerData) => {
  const normalizedEmail = ownerData.email?.trim().toLowerCase();
  // 1. Kiểm tra email
  const existingOwner = await prisma.cHU_HOMESTAY.findUnique({
    where: { Email: normalizedEmail },
  });

  if (existingOwner) {
    throw new Error('Email đã tồn tại');
  }

  // 2. Kiểm tra CCCD
  const existingCCCD = await prisma.cHU_HOMESTAY.findUnique({
    where: { SoCCCD: ownerData.soCCCD?.trim() },
  });

  if (existingCCCD) {
    throw new Error('Số CCCD đã tồn tại');
  }

  // 3. Băm mật khẩu
  const hashedPassword = await bcrypt.hash(ownerData.password, 12);

  // 4. Tạo chủ homestay mới
  const newOwner = await prisma.cHU_HOMESTAY.create({
    data: {
      HoTen: ownerData.hoTen?.trim(),
      Email: normalizedEmail,
      MatKhau: hashedPassword,
      SoCCCD: ownerData.soCCCD?.trim(),
      SoDienThoai: ownerData.soDienThoai?.trim() || null,
      DiaChi: ownerData.diaChi?.trim() || null,
      isActive: true,
      // 'Quyen' sẽ tự động dùng giá trị 'chu_homestay' (default)
    },
  });
  
  // 5. Xóa mật khẩu và trả về
  delete newOwner.MatKhau;
  return newOwner;
};

/**
 * Đăng nhập một tài khoản Chủ Homestay
 */
export const loginOwner = async (ownerData) => {
  const normalizedEmail = ownerData.email?.trim().toLowerCase();
  const rawPassword = ownerData.password || ownerData.matKhau;

  // 1. Tìm chủ homestay bằng email
  const owner = await prisma.cHU_HOMESTAY.findUnique({
    where: { Email: normalizedEmail },
  });

  if (!owner) {
    throw new Error('Email không tồn tại');
  }
  
  if (owner.isActive === false) {
    throw new Error('Tài khoản của bạn đã bị khóa');
  }

  if (!rawPassword) {
    throw new Error('Mật khẩu không chính xác');
  }

  // 2. So sánh mật khẩu
  const isPasswordMatch = await bcrypt.compare(rawPassword, owner.MatKhau);

  if (!isPasswordMatch) {
    throw new Error('Mật khẩu không chính xác');
  }


  // 3. Tạo Token (JWT)
  // Lần này, chúng ta đưa 'MaChu' và 'Quyen' vào token
  const token = jwt.sign(
    { 
      ownerId: owner.MaChu, 
      role: owner.Quyen // Sẽ là 'chu_homestay' hoặc 'admin'
    },
    process.env.JWT_SECRET,        // Dùng chung secret key
    { expiresIn: '5h' }
  );

  // 4. Xóa mật khẩu và trả về
  delete owner.MatKhau;
  return { owner, token };
};
/**
 * Xử lý yêu cầu quên mật khẩu (Chủ Homestay)
 */
export const requestPasswordReset = async (email) => {
  const owner = await prisma.cHU_HOMESTAY.findUnique({
    where: { Email: email },
  });

  if (!owner) {
    throw new Error('Email không tồn tại');
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  const resetExpires = new Date(Date.now() + 10 * 60 * 1000); 

  await prisma.cHU_HOMESTAY.update({
    where: { Email: email },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpires: resetExpires,
    },
  });

  return resetToken;
};

/**
 * Xử lý đặt lại mật khẩu (Chủ Homestay)
 */
export const resetPassword = async (token, newPassword) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const owner = await prisma.cHU_HOMESTAY.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!owner) {
    throw new Error('Token không hợp lệ hoặc đã hết hạn');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.cHU_HOMESTAY.update({
    where: { MaChu: owner.MaChu },
    data: {
      MatKhau: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return;
};

/**
 * Lấy danh sách homestay thuộc sở hữu của một chủ
 * @param {number} ownerId - ID của chủ homestay (từ req.owner)
 */
export const getMyHomestays = async (ownerId) => {
  const homestays = await prisma.hOMESTAY.findMany({
    where: {
      MaChu: ownerId,
    },
    // Lấy kèm các thông tin liên quan
    include: {
      DANH_GIA: true, // Lấy tất cả đánh giá
      HINH_ANH: true, // Lấy tất cả hình ảnh
    },
    orderBy: {
      created_at: 'desc', // Sắp xếp homestay mới nhất lên đầu
    },
  });

  return homestays;
};

export const getMyBookings = async (ownerId) => {
  // 1. Lấy danh sách ID các homestay mà chủ này sở hữu
  const myHomestayIds = await prisma.hOMESTAY.findMany({
    where: { MaChu: ownerId },
    select: { MaHomestay: true }, // Chỉ chọn ID
  });

  // Chuyển [ { MaHomestay: 1 }, { MaHomestay: 2 } ] thành [ 1, 2 ]
  const homestayIdList = myHomestayIds.map((h) => h.MaHomestay);

  // 2. Tìm tất cả các đơn ĐẶT PHÒNG
  const bookings = await prisma.dAT_PHONG.findMany({
    where: {
      // (Logic phức tạp)
      // Tìm các đơn đặt phòng MÀ trong CHI_TIET_DAT_PHONG
      CHI_TIET_DAT_PHONG: {
        some: {
          // có MaHomestay nằm trong danh sách homestay của tôi
          MaHomestay: {
            in: homestayIdList,
          },
        },
      },
    },
    // Lấy kèm thông tin chi tiết
    include: {
      NGUOI_DUNG: { // Lấy thông tin người đặt
        select: {
          HoTen: true,
          Email: true,
          SoDienThoai: true
        }
      }, 
      CHI_TIET_DAT_PHONG: { // Lấy chi tiết đặt phòng
        include: {
          HOMESTAY: { // Lấy thông tin homestay được đặt
            select: { TenHomestay: true }
          }
        }
      },
      GIAO_DICH: {
        orderBy: { created_at: 'desc' }
      }
    },
    orderBy: {
      NgayNhan: 'asc', // Sắp xếp theo ngày nhận phòng
    },
  });

  return bookings;
};

export const getMyComplaints = async (ownerId) => {
  // 1. Lấy danh sách ID các homestay mà chủ này sở hữu
  const myHomestayIds = await prisma.hOMESTAY.findMany({
    where: { MaChu: ownerId },
    select: { MaHomestay: true },
  });
  const homestayIdList = myHomestayIds.map((h) => h.MaHomestay);

  // 2. Tìm tất cả các KHIẾU NẠI
  // 'kHIEU_NAI' là tên model Prisma
  const complaints = await prisma.kHIEU_NAI.findMany({
    where: {
      // (Logic phức tạp)
      // Tìm khiếu nại MÀ đơn đặt phòng của nó...
      DAT_PHONG: {
        // ...có chứa chi tiết đặt phòng...
        CHI_TIET_DAT_PHONG: {
          some: {
            // ...liên quan đến một homestay trong danh sách của tôi
            MaHomestay: {
              in: homestayIdList,
            },
          },
        },
      },
    },
    // Lấy kèm thông tin chi tiết
    include: {
      NGUOI_DUNG: { // Lấy thông tin người khiếu nại
        select: {
          HoTen: true,
          Email: true,
        },
      },
      DAT_PHONG: { // Lấy thông tin đơn đặt phòng bị khiếu nại
        select: {
          MaDatPhong: true,
          NgayNhan: true,
          NgayTra: true,
        },
      },
    },
    orderBy: {
      NgayTao: 'desc', // Ưu tiên khiếu nại mới
    },
  });

  return complaints;
};
export const getDashboardStats = async (ownerId) => {
  // 1. Lấy danh sách ID các homestay của chủ này
  const myHomestayIds = await prisma.hOMESTAY.findMany({
    where: { MaChu: ownerId },
    select: { MaHomestay: true },
  });
  const homestayIdList = myHomestayIds.map((h) => h.MaHomestay);

  // 2. Đếm tổng số homestay
  const totalHomestays = homestayIdList.length;

  // 3. Lấy tất cả các đơn đặt phòng liên quan
  const allBookings = await prisma.dAT_PHONG.findMany({
    where: {
      CHI_TIET_DAT_PHONG: {
        some: {
          MaHomestay: { in: homestayIdList },
        },
      },
    },
    select: {
      TrangThai: true,
      Gia: true, // Tổng giá của đơn đặt
    },
  });

  // 4. Lấy tất cả khiếu nại liên quan
  const allComplaints = await prisma.kHIEU_NAI.findMany({
    where: {
      DAT_PHONG: {
        CHI_TIET_DAT_PHONG: {
          some: {
            MaHomestay: { in: homestayIdList },
          },
        },
      },
    },
    select: {
      TrangThai: true,
    },
  });

  // 5. Tính toán các số liệu
  let totalRevenue = 0;
  let confirmedBookings = 0;
  let pendingBookings = 0;
  let stayingBookings = 0;
  let completedBookings = 0;
  let cancelledBookings = 0;

  allBookings.forEach((booking) => {
    if (booking.TrangThai === 'DaXacNhan' || booking.TrangThai === 'DangLuuTru' || booking.TrangThai === 'DaHoanThanh') {
      totalRevenue += parseFloat(booking.Gia || 0);
    }
    if (booking.TrangThai === 'DaXacNhan') {
      confirmedBookings += 1;
    } else if (booking.TrangThai === 'ChoXacNhan') {
      pendingBookings += 1;
    } else if (booking.TrangThai === 'DangLuuTru') {
      stayingBookings += 1;
    } else if (booking.TrangThai === 'DaHoanThanh') {
      completedBookings += 1;
    } else if (booking.TrangThai === 'DaHuy') {
      cancelledBookings += 1;
    }
  });

  const pendingComplaints = allComplaints.filter(
    (c) => c.TrangThai === 'ChuaXuLy'
  ).length;

  // 6. Trả về kết quả
  return {
    totalHomestays,
    totalBookings: allBookings.length,
    totalRevenue,
    confirmedBookings,
    pendingBookings,
    stayingBookings,
    completedBookings,
    cancelledBookings,
    pendingComplaints,
  };
};

/**
 * Lấy lịch sử giao dịch thanh toán liên quan đến homestay của chủ nhà
 */
export const getMyTransactions = async (ownerId) => {
  const myHomestayIds = await prisma.hOMESTAY.findMany({
    where: { MaChu: ownerId },
    select: { MaHomestay: true },
  });
  const homestayIdList = myHomestayIds.map((h) => h.MaHomestay);

  const transactions = await prisma.gIAO_DICH.findMany({
    where: {
      DAT_PHONG: {
        CHI_TIET_DAT_PHONG: {
          some: {
            MaHomestay: { in: homestayIdList }
          }
        }
      }
    },
    include: {
      DAT_PHONG: {
        include: {
          NGUOI_DUNG: { select: { HoTen: true, Email: true, SoDienThoai: true } },
          CHI_TIET_DAT_PHONG: {
            include: {
              HOMESTAY: { select: { MaHomestay: true, TenHomestay: true } }
            }
          }
        }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  return transactions;
};

/**
 * Lấy thông tin hồ sơ chủ homestay
 */
export const getOwnerProfile = async (ownerId) => {
  const owner = await prisma.cHU_HOMESTAY.findUnique({
    where: { MaChu: ownerId },
    select: {
      MaChu: true,
      HoTen: true,
      Email: true,
      SoDienThoai: true,
      DiaChi: true,
      SoCCCD: true,
      Quyen: true,
      isActive: true,
      created_at: true,
    }
  });

  if (!owner) {
    throw new Error('Không tìm thấy tài khoản chủ homestay');
  }

  return owner;
};

/**
 * Cập nhật thông tin hồ sơ chủ homestay
 */
export const updateOwnerProfile = async (ownerId, profileData) => {
  const { hoTen, soDienThoai, diaChi, soCCCD } = profileData;

  const updatedOwner = await prisma.cHU_HOMESTAY.update({
    where: { MaChu: ownerId },
    data: {
      ...(hoTen !== undefined && { HoTen: hoTen }),
      ...(soDienThoai !== undefined && { SoDienThoai: soDienThoai }),
      ...(diaChi !== undefined && { DiaChi: diaChi }),
      ...(soCCCD !== undefined && { SoCCCD: soCCCD }),
    },
    select: {
      MaChu: true,
      HoTen: true,
      Email: true,
      SoDienThoai: true,
      DiaChi: true,
      SoCCCD: true,
      Quyen: true,
      isActive: true,
      created_at: true,
    }
  });

  return updatedOwner;
};