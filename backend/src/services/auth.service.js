// src/services/auth.service.js
import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const registerUser = async (userData) => {
  const normalizedEmail = userData.email?.trim().toLowerCase();
  // 1. Kiểm tra email
  const existingUser = await prisma.nGUOI_DUNG.findUnique({
    where: { Email: normalizedEmail },
  });

  if (existingUser) {
    throw new Error('Email đã tồn tại');
  }

  // 2. Băm mật khẩu
  const hashedPassword = await bcrypt.hash(userData.password, 12);

  // 3. Tạo user - Ánh xạ tới đúng tên trường trong schema
  const user = await prisma.nGUOI_DUNG.create({
    data: {
      HoTen: userData.fullName?.trim(), 
      Email: normalizedEmail,    
      MatKhau: hashedPassword, 
      SoDienThoai: userData.soDienThoai?.trim() || null,
      isActive: true,
    },
  });

  // 4. Xóa mật khẩu trước khi trả về
  delete user.MatKhau; 
  return user;
};

/**
 * Đăng nhập một cổng duy nhất cho tất cả các vai trò: Customer, Host, Admin
 * Tự động nhận diện vai trò từ cơ sở dữ liệu dựa trên email và mật khẩu
 */
export const loginUser = async (userData) => {
  const normalizedEmail = (userData.email || '').trim().toLowerCase();
  const rawPassword = userData.password || userData.matKhau;

  if (!normalizedEmail || !rawPassword) {
    throw new Error('Vui lòng cung cấp đầy đủ email và mật khẩu');
  }

  // 1. Kiểm tra trong bảng CHU_HOMESTAY (bao gồm Chủ Homestay và Quản trị viên Admin)
  const owner = await prisma.cHU_HOMESTAY.findUnique({
    where: { Email: normalizedEmail },
  });

  if (owner) {
    if (owner.isActive === false) {
      throw new Error('Tài khoản của bạn đã bị khóa');
    }

    const isPasswordMatch = await bcrypt.compare(rawPassword, owner.MatKhau);
    if (!isPasswordMatch) {
      throw new Error('Mật khẩu không chính xác');
    }

    const role = owner.Quyen === 'admin' ? 'admin' : 'chu_homestay';

    // Tạo Token (JWT) cho Chủ nhà / Admin
    // Chứa ownerId tương thích tuyệt đối với middleware protectOwner, protectAdmin, protectAny
    const token = jwt.sign(
      {
        ownerId: owner.MaChu,
        role: role,
        email: owner.Email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '5h' }
    );

    delete owner.MatKhau;
    return {
      user: owner,
      token,
      role: role,
      userType: role === 'admin' ? 'admin' : 'host',
    };
  }

  // 2. Kiểm tra trong bảng NGUOI_DUNG (Khách hàng thông thường)
  const customer = await prisma.nGUOI_DUNG.findUnique({
    where: { Email: normalizedEmail },
  });

  if (customer) {
    if (customer.isActive === false) {
      throw new Error('Tài khoản của bạn đã bị khóa');
    }

    const isPasswordMatch = await bcrypt.compare(rawPassword, customer.MatKhau);
    if (!isPasswordMatch) {
      throw new Error('Mật khẩu không chính xác');
    }

    const role = 'customer';

    // Tạo Token (JWT) cho Khách hàng
    // Chứa userId tương thích tuyệt đối với middleware protect, protectAny
    const token = jwt.sign(
      {
        userId: customer.MaNguoiDung,
        role: role,
        email: customer.Email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '5h' }
    );

    delete customer.MatKhau;
    return {
      user: customer,
      token,
      role: role,
      userType: 'customer',
    };
  }

  // 3. Nếu không tìm thấy ở bất kỳ bảng nào
  throw new Error('Email không tồn tại');
};
