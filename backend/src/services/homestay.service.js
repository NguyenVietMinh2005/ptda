// src/services/homestay.service.js
import prisma from '../config/prisma.js';

/**
 * Lấy tất cả homestay từ database
 */
export const getAllHomestays = async (queryParams) => {
  // 1. ĐỊNH NGHĨA BIẾN Ở ĐÂY (Bạn đã bị thiếu dòng này)
  const { searchQuery, soKhachToiDa, giaMin, giaMax } = queryParams;

  const filters = {
    AND: [],
  };

  // 2. (Logic OR)
  // Bây giờ 'searchQuery' đã được định nghĩa
  if (searchQuery) {
    filters.AND.push({
      OR: [
        { DiaDiem: { contains: searchQuery } },
        { TenHomestay: { contains: searchQuery } } // Tìm cả trong Tên
      ]
    });
  }

  // 3. Logic lọc Số khách (Giữ nguyên)
  if (soKhachToiDa) {
    const soKhach = parseInt(soKhachToiDa);
    if (!isNaN(soKhach)) { 
      filters.AND.push({
        SoKhachToiDa: { gte: soKhach },
      });
    }
  }

  // 4. Logic lọc Giá (Giữ nguyên)
  if (giaMin) {
    const min = parseFloat(giaMin);
    if (!isNaN(min)) {
      filters.AND.push({
        Gia: { gte: min },
      });
    }
  }
  if (giaMax) {
    const max = parseFloat(giaMax);
    if (!isNaN(max)) {
      filters.AND.push({
        Gia: { lte: max },
      });
    }
  }

  // Chạy truy vấn
  const homestays = await prisma.hOMESTAY.findMany({
    where: filters,
    include: {
      HINH_ANH: { take: 1 },
    },
  });
  
  return homestays;
};
// (Sau này bạn sẽ thêm các hàm khác như getHomestayById, createHomestay, ...)

/**
 * Lấy một homestay bằng ID
 */
export const getHomestayById = async (homestayId) => {
  // Dùng 'findUnique' để tìm bản ghi duy nhất dựa vào 'MaHomestay'
  // 'hOMESTAY' là tên được Prisma tự động tạo
  const homestay = await prisma.hOMESTAY.findUnique({
    where: {
      // 'MaHomestay' phải khớp với tên trường trong schema của bạn
      MaHomestay: homestayId, 
    },
    // --- BẮT ĐẦU CẬP NHẬT ---
    // 'include' sẽ tự động JOIN các bảng liên quan
    include: {
      // 1. Lấy tất cả đánh giá (model DANH_GIA)
      DANH_GIA: {
        // Lấy luôn thông tin người dùng đã đánh giá
        include: {
          NGUOI_DUNG: {
            select: {
              HoTen: true // Chỉ lấy Tên, không lấy mật khẩu
            }
          }
        }
      }, 
      
      // 2. Lấy tất cả hình ảnh (model HINH_ANH)
      HINH_ANH: true,
      
      // 3. Lấy thông tin chủ homestay (model CHU_HOMESTAY)
      CHU_HOMESTAY: {
        select: {
          HoTen: true,
          Email: true,
          SoDienThoai: true
          // Tuyệt đối không 'include' MatKhau hay SoCCCD ở đây
        }
      }
    }
    // --- KẾT THÚC CẬP NHẬT ---
  });

  if (!homestay) {
    throw new Error('Không tìm thấy homestay');
  }

  return homestay;
};

/**
 * Thêm một homestay vào danh sách yêu thích của người dùng
 * @param {number} userId - ID của người dùng (từ req.user)
 * @param {number} homestayId - ID của homestay (từ req.params)
 * @param {object} reviewData - Dữ liệu review (từ req.body)
 * @param {object} bookingData - Dữ liệu đặt phòng (từ req.body)
 * @param {object} homestayData - Dữ liệu homestay (từ req.body)
 * @param {number} ownerId - ID của chủ homestay (từ req.owner)
 * @param {object} updateData - Dữ liệu cần cập nhật (từ req.body)
 * @param {Array} files - Danh sách file (từ multer)
 * @param {object} queryParams - Đối tượng chứa các tham số (từ req.query)
 * 
 */

export const addFavorite = async (userId, homestayId) => {
  // 1. Kiểm tra xem homestay có tồn tại không
  const homestayExists = await prisma.hOMESTAY.findUnique({
    where: { MaHomestay: homestayId },
  });

  if (!homestayExists) {
    throw new Error('Không tìm thấy homestay');
  }

  // 2. Kiểm tra xem có bị trùng không (người dùng đã thích cái này chưa)
  // 'yEU_THICH' là tên Prisma tạo ra từ model 'YEU_THICH'
  const existingFavorite = await prisma.yEU_THICH.findUnique({
    where: {
      // Đây là cú pháp cho @@id([MaNguoiDung, MaHomestay])
      MaNguoiDung_MaHomestay: {
        MaNguoiDung: userId,
        MaHomestay: homestayId,
      },
    },
  });

  if (existingFavorite) {
    throw new Error('Homestay này đã có trong danh sách yêu thích');
  }

  // 3. Tạo mục yêu thích mới
  const newFavorite = await prisma.yEU_THICH.create({
    data: {
      MaNguoiDung: userId,
      MaHomestay: homestayId,
    },
  });

  return newFavorite;
};


export const removeFavorite = async (userId, homestayId) => {
  // 1. Kiểm tra xem mục yêu thích này có tồn tại không
  // 'yEU_THICH' là tên Prisma tạo ra từ model 'YEU_THICH'
  const existingFavorite = await prisma.yEU_THICH.findUnique({
    where: {
      // Cú pháp cho @@id([MaNguoiDung, MaHomestay])
      MaNguoiDung_MaHomestay: {
        MaNguoiDung: userId,
        MaHomestay: homestayId,
      },
    },
  });

  if (!existingFavorite) {
    throw new Error('Homestay này không có trong danh sách yêu thích');
  }

  // 2. Xóa mục yêu thích
  await prisma.yEU_THICH.delete({
    where: {
      MaNguoiDung_MaHomestay: {
        MaNguoiDung: userId,
        MaHomestay: homestayId,
      },
    },
  });

  // Không cần trả về gì, chỉ cần xác nhận đã xóa
  return; 
};

export const createReview = async (userId, homestayId, reviewData) => {
  // 1. Kiểm tra homestay
  const homestayExists = await prisma.hOMESTAY.findUnique({
    where: { MaHomestay: homestayId },
  });

  if (!homestayExists) {
    throw new Error('Không tìm thấy homestay');
  }

  // 2. (MỚI) Tìm đánh giá cũ của chính người dùng này
  const existingReview = await prisma.dANH_GIA.findFirst({
    where: {
      MaNguoiDung: userId,
      MaHomestay: homestayId,
    }
  });

  // 3. Chuẩn bị dữ liệu
  const dataToSave = {
    // Logic || 5 vẫn giữ nguyên (nếu gửi 0 sao, sẽ lưu là 5)
    SoSao: reviewData.soSao || 5, 
    BinhLuan: reviewData.binhLuan,
  };

  if (existingReview) {
    // --- 4a. Nếu ĐÃ TÌM THẤY: CẬP NHẬT ---
    console.log(`Updating review for user ${userId} on homestay ${homestayId}`);
    const updatedReview = await prisma.dANH_GIA.update({
      where: {
        MaDanhGia: existingReview.MaDanhGia // Cập nhật dựa trên ID đánh giá cũ
      },
      data: dataToSave,
    });
    return updatedReview;

  } else {
    // --- 4b. Nếu KHÔNG TÌM THẤY: TẠO MỚI ---
    console.log(`Creating new review for user ${userId} on homestay ${homestayId}`);
    const newReview = await prisma.dANH_GIA.create({
      data: {
        MaNguoiDung: userId,
        MaHomestay: homestayId,
        ...dataToSave,
      },
    });
    return newReview;
  }
};

export const bookHomestay = async (userId, homestayId, bookingData) => {
  const { ngayNhan, ngayTra, soLuongKhach } = bookingData;

  // 1. Tìm homestay để lấy thông tin
  const homestay = await prisma.hOMESTAY.findUnique({
    where: { MaHomestay: homestayId },
  });

  if (!homestay) {
    throw new Error('Không tìm thấy homestay');
  }

  // 2. Kiểm tra số lượng khách
  if (soLuongKhach > homestay.SoKhachToiDa) {
    throw new Error('Số lượng khách vượt quá mức cho phép');
  }

  // 3. Tính toán cơ bản
  const ngayNhanDate = new Date(ngayNhan);
  const ngayTraDate = new Date(ngayTra);
  const soDem = (ngayTraDate - ngayNhanDate) / (1000 * 60 * 60 * 24); // Tính số đêm

  if (soDem <= 0) {
    throw new Error('Ngày trả phải sau ngày nhận');
  }

  // 'Gia' trong HOMESTAY là giá 1 đêm, 'Gia' trong DAT_PHONG là tổng tiền
  const tongGia = parseFloat(homestay.Gia) * soDem;

  // 4. (Quan trọng) Sử dụng Transaction
  // Ghi vào 2 bảng: DAT_PHONG và CHI_TIET_DAT_PHONG
  // $transaction đảm bảo rằng cả hai lệnh CÙNG thành công,
  // hoặc CÙNG thất bại (không bao giờ có chuyện tạo được 1 mà hỏng 1)
  
  const newBooking = await prisma.$transaction(async (tx) => {
    // a. Tạo đơn đặt phòng (model DAT_PHONG)
    const datPhong = await tx.dAT_PHONG.create({
      data: {
        MaNguoiDung: userId,
        NgayNhan: ngayNhanDate,
        NgayTra: ngayTraDate,
        SoLuong: soLuongKhach,
        Gia: tongGia,
        TrangThai: 'ChoXacNhan', // Mặc định khi mới đặt
      },
    });

    // b. Tạo chi tiết đơn (model CHI_TIET_DAT_PHONG)
    // Giả sử đặt 1 homestay này với số lượng 1
    await tx.cHI_TIET_DAT_PHONG.create({
      data: {
        MaDatPhong: datPhong.MaDatPhong, // Lấy ID từ bước (a)
        MaHomestay: homestayId,
        SoLuongPhong: 1, // Giả sử là 1 (bạn có thể thay đổi logic này)
      },
    });
    
    // Trả về đơn đặt phòng đã tạo
    return datPhong;
  });

  return newBooking;
};

export const createHomestay = async (homestayData, ownerId) => {
  const {
    tenHomestay,
    diaDiem,
    gia,
    soKhachToiDa,
    tienIch,
    moTa,
  } = homestayData;

  const newHomestay = await prisma.hOMESTAY.create({
    data: {
      TenHomestay: tenHomestay,
      DiaDiem: diaDiem,
      Gia: parseFloat(gia), // Đảm bảo 'Gia' là kiểu số
      SoKhachToiDa: parseInt(soKhachToiDa), // Đảm bảo là số nguyên
      TienIch: tienIch,
      MoTa: moTa,
      MaChu: ownerId, // <-- Liên kết với chủ homestay
    },
  });

  return newHomestay;
};

export const updateHomestay = async (homestayId, ownerId, updateData) => {
  // 1. Tìm homestay
  const homestay = await prisma.hOMESTAY.findUnique({
    where: { MaHomestay: homestayId },
  });

  if (!homestay) {
    throw new Error('Không tìm thấy homestay'); // Lỗi 404
  }

  // 2. (Quan trọng) Kiểm tra quyền sở hữu
  if (homestay.MaChu !== ownerId) {
    throw new Error('Không có quyền chỉnh sửa homestay này'); // Lỗi 403
  }

  // 3. Cập nhật homestay
  const updatedHomestay = await prisma.hOMESTAY.update({
    where: { MaHomestay: homestayId },
    data: {
      TenHomestay: updateData.tenHomestay,
      DiaDiem: updateData.diaDiem,
      Gia: parseFloat(updateData.gia),
      SoKhachToiDa: parseInt(updateData.soKhachToiDa),
      TienIch: updateData.tienIch,
      MoTa: updateData.moTa,
      // Chúng ta không cho phép cập nhật 'MaChu'
    },
  });

  return updatedHomestay;
};

export const deleteHomestay = async (homestayId, ownerId) => {
  // 1. Tìm homestay
  const homestay = await prisma.hOMESTAY.findUnique({
    where: { MaHomestay: homestayId },
  });

  if (!homestay) {
    throw new Error('Không tìm thấy homestay'); // Lỗi 404
  }

  // 2. (Quan trọng) Kiểm tra quyền sở hữu
  if (homestay.MaChu !== ownerId) {
    throw new Error('Không có quyền xóa homestay này'); // Lỗi 403
  }

  // 3. Xóa homestay
  // Lưu ý: Nhờ 'onDelete: Cascade' trong schema, khi bạn xóa homestay,
  // tất cả HINH_ANH, DANH_GIA, CHI_TIET_DAT_PHONG liên quan sẽ tự động bị xóa.
  await prisma.hOMESTAY.delete({
    where: { MaHomestay: homestayId },
  });

  return; // Xóa thành công, không cần trả về gì
};

export const uploadImages = async (homestayId, ownerId, files) => {
  // 1. Kiểm tra quyền sở hữu
  const homestay = await prisma.hOMESTAY.findUnique({
    where: { MaHomestay: homestayId },
  });

  if (!homestay) {
    throw new Error('Không tìm thấy homestay');
  }
  if (homestay.MaChu !== ownerId) {
    throw new Error('Không có quyền thêm ảnh vào homestay này');
  }

  // 2. Kiểm tra xem 'files' có tồn tại không
  if (!files || files.length === 0) {
    throw new Error('Không có file nào được tải lên');
  }

  // 3. Chuẩn bị dữ liệu để thêm vào bảng HINH_ANH
  // 'files' là một mảng, 'file.path' là đường dẫn multer đã lưu
  const imageEntries = files.map((file) => ({
    MaHomestay: homestayId,
    // Lưu đường dẫn (hoặc chỉ tên file) vào DB.
    // 'file.path' sẽ là 'uploads/image-12345.png'
    HinhAnh: file.path, 
  }));

  // 4. Thêm đồng loạt nhiều ảnh vào DB
  // 'hINH_ANH' là tên model Prisma
  await prisma.hINH_ANH.createMany({
    data: imageEntries,
  });

  return imageEntries;
};
