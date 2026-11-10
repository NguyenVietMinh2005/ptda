// src/services/homestay.service.js
import prisma from '../config/prisma.js';
import * as storageService from './storage.service.js';
import { enqueueCleanup, processQueue } from './storageCleanupQueue.service.js';

/**
 * Lấy tất cả homestay từ database
 */
export const getAllHomestays = async (queryParams) => {
  // 1. ĐỊNH NGHĨA BIẾN Ở ĐÂY (Bạn đã bị thiếu dòng này)
  const { searchQuery, soKhachToiDa, giaMin, giaMax } = queryParams;

  const filters = {
    AND: [
      { isActive: true },
      { TrangThaiDuyet: 'DaDuyet' }
    ],
  };

  // 2. (Logic OR)
  // Bây giờ 'searchQuery' đã được định nghĩa
  if (searchQuery) {
    filters.AND.push({
      OR: [
        { DiaDiem: { contains: searchQuery, mode: 'insensitive' } },
        { TenHomestay: { contains: searchQuery, mode: 'insensitive' } } // Tìm cả trong Tên
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

  // 2. (QUAN TRỌNG) KIỂM TRA ĐIỀU KIỆN LƯU TRÚ:
  // Khách hàng PHẢI có ít nhất 1 đơn đặt phòng đã hoàn thành ('DaHoanThanh') tại homestay này
  const completedBooking = await prisma.dAT_PHONG.findFirst({
    where: {
      MaNguoiDung: userId,
      CHI_TIET_DAT_PHONG: {
        some: { MaHomestay: homestayId },
      },
      TrangThai: 'DaHoanThanh',
    },
  });

  if (!completedBooking) {
    throw new Error('Chỉ khách hàng đã hoàn thành kỳ nghỉ (trạng thái Đã hoàn thành) tại homestay này mới có thể gửi đánh giá.');
  }

  // 3. Tìm đánh giá cũ của chính người dùng này
  const existingReview = await prisma.dANH_GIA.findFirst({
    where: {
      MaNguoiDung: userId,
      MaHomestay: homestayId,
    }
  });

  // 4. Chuẩn bị dữ liệu
  const dataToSave = {
    SoSao: reviewData.soSao || 5, 
    BinhLuan: reviewData.binhLuan,
  };

  if (existingReview) {
    // 4a. Cập nhật đánh giá cũ
    console.log(`Updating review for user ${userId} on homestay ${homestayId}`);
    const updatedReview = await prisma.dANH_GIA.update({
      where: {
        MaDanhGia: existingReview.MaDanhGia
      },
      data: dataToSave,
    });
    return updatedReview;

  } else {
    // 4b. Tạo đánh giá mới
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

/**
 * Kiểm tra xem người dùng hiện tại có đủ điều kiện đánh giá homestay hay không
 */
export const checkCanReview = async (userId, homestayId) => {
  if (!userId) {
    return { canReview: false, reason: 'Bạn cần đăng nhập để đánh giá' };
  }

  const completedBooking = await prisma.dAT_PHONG.findFirst({
    where: {
      MaNguoiDung: userId,
      CHI_TIET_DAT_PHONG: {
        some: { MaHomestay: homestayId },
      },
      TrangThai: 'DaHoanThanh',
    },
  });

  if (!completedBooking) {
    return {
      canReview: false,
      reason: 'Chỉ khách hàng đã hoàn thành kỳ nghỉ (trạng thái Đã hoàn thành) tại homestay này mới có thể gửi đánh giá.',
    };
  }

  return { canReview: true };
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

  if (homestay.isActive === false || homestay.TrangThaiDuyet !== 'DaDuyet') {
    throw new Error('Homestay hiện không nhận đặt phòng');
  }

  // 2. Kiểm tra số lượng khách
  if (soLuongKhach > homestay.SoKhachToiDa) {
    throw new Error('Số lượng khách vượt quá mức cho phép');
  }

  // 3. Tính toán và kiểm tra ngày nhận/trả
  const ngayNhanDate = new Date(ngayNhan);
  const ngayTraDate = new Date(ngayTra);

  if (isNaN(ngayNhanDate.getTime()) || isNaN(ngayTraDate.getTime())) {
    throw new Error('Ngày nhận hoặc ngày trả phòng không hợp lệ');
  }

  const soDem = (ngayTraDate - ngayNhanDate) / (1000 * 60 * 60 * 24);

  if (soDem <= 0) {
    throw new Error('Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm');
  }

  // 'Gia' trong HOMESTAY là giá 1 đêm, 'Gia' trong DAT_PHONG là tổng tiền
  const tongGia = parseFloat(homestay.Gia) * soDem;

  // 4. (Quan trọng) Sử dụng Transaction kiểm tra chống trùng lịch (Anti-overbooking)
  const newBooking = await prisma.$transaction(async (tx) => {
    // KIỂM TRA TRÙNG LỊCH:
    // Khoảng ngày mới [ngayNhanDate, ngayTraDate) bị trùng nếu:
    // (NgayNhanCu < ngayTraDate) VÀ (NgayTraCu > ngayNhanDate)
    const conflictBooking = await tx.dAT_PHONG.findFirst({
      where: {
        CHI_TIET_DAT_PHONG: {
          some: { MaHomestay: homestayId },
        },
        TrangThai: {
          in: ['ChoXacNhan', 'DaXacNhan', 'DangLuuTru'],
        },
        AND: [
          { NgayNhan: { lt: ngayTraDate } },
          { NgayTra: { gt: ngayNhanDate } },
        ],
      },
    });

    if (conflictBooking) {
      throw new Error('Khoảng thời gian này đã có khách đặt hoặc đang chờ xác nhận. Vui lòng chọn ngày khác.');
    }

    // a. Tạo đơn đặt phòng (model DAT_PHONG)
    const datPhong = await tx.dAT_PHONG.create({
      data: {
        MaNguoiDung: userId,
        NgayNhan: ngayNhanDate,
        NgayTra: ngayTraDate,
        SoLuong: soLuongKhach,
        Gia: tongGia,
        TrangThai: 'ChoXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
      },
    });

    // b. Tạo chi tiết đơn (model CHI_TIET_DAT_PHONG)
    await tx.cHI_TIET_DAT_PHONG.create({
      data: {
        MaDatPhong: datPhong.MaDatPhong,
        MaHomestay: homestayId,
        SoLuongPhong: 1,
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

  // 3. Xóa homestay dạng soft-delete (vô hiệu hóa) để bảo tồn lịch sử booking và doanh thu
  await prisma.hOMESTAY.update({
    where: { MaHomestay: homestayId },
    data: { isActive: false }
  });

  return; // Xóa thành công, không cần trả về gì
};

export const getHomestayAvailability = async (homestayId) => {
  const activeBookings = await prisma.dAT_PHONG.findMany({
    where: {
      CHI_TIET_DAT_PHONG: {
        some: { MaHomestay: parseInt(homestayId) }
      },
      TrangThai: {
        in: ['ChoXacNhan', 'DaXacNhan', 'DangLuuTru']
      }
    },
    select: {
      NgayNhan: true,
      NgayTra: true,
      TrangThai: true
    }
  });

  const bookedRanges = activeBookings.map(b => ({
    startDate: b.NgayNhan,
    endDate: b.NgayTra,
    status: b.TrangThai
  }));

  return {
    homestayId: parseInt(homestayId),
    totalUnits: 1,
    unitType: 'Nguyên căn / Phòng độc lập',
    bookedRanges
  };
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
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new Error('Không có file nào được tải lên');
  }

  // 3. Tải file lên Storage (hỗ trợ cả Local và Supabase)
  const uploadedResults = await storageService.uploadFiles(files, homestayId);

  // 4. Chuẩn bị dữ liệu để thêm vào bảng HINH_ANH (Lưu Object Key hoặc đường dẫn chuẩn hóa)
  const imageEntries = uploadedResults.map((item) => ({
    MaHomestay: homestayId,
    HinhAnh: item.path,
  }));

  try {
    // 5. Thêm đồng loạt nhiều ảnh vào DB
    await prisma.hINH_ANH.createMany({
      data: imageEntries,
    });
  } catch (err) {
    // Nếu ghi DB thất bại: Kích hoạt cơ chế bồi hoàn xóa các file đã tải lên Storage
    for (const item of uploadedResults) {
      try {
        const delRes = await storageService.deleteFileFromStorage(item.path, item.bucketName);
        if (!delRes || !delRes.success) {
          throw new Error(delRes?.error || 'Xóa bù trừ không thành công');
        }
      } catch (cleanupErr) {
        console.error(
          `[STORAGE_COMPENSATION_ERROR] Lỗi khi xóa file bù trừ ${item.path}:`,
          cleanupErr.message
        );
        // Nếu xóa bù trừ trực tiếp thất bại: Đưa vào Cleanup Queue hoặc Emergency Buffer
        try {
          await enqueueCleanup(
            {
              filePath: item.path,
              bucketName: item.bucketName,
              reason: 'UPLOAD_COMPENSATION',
            },
            prisma
          );
        } catch (enqueueErr) {
          console.error(
            `[STORAGE_ENQUEUE_FALLBACK] Database lỗi khi enqueue cleanup cho ${item.path}, lưu vào emergency buffer:`,
            enqueueErr.message
          );
          storageService.pushToEmergencyBuffer({
            filePath: item.path,
            bucketName: item.bucketName,
            reason: 'UPLOAD_COMPENSATION',
            homestayId,
          });
        }
      }
    }
    throw err;
  }

  return imageEntries;
};

/**
 * Xóa một ảnh riêng lẻ của homestay bởi Host sở hữu.
 *
 * Yêu cầu:
 * 1. Xác minh homestay tồn tại và thuộc quyền sở hữu của Host.
 * 2. Xác minh ảnh tồn tại và thực sự thuộc homestay.
 * 3. Enqueue Cleanup Job và xóa bản ghi ảnh trong cùng 1 database transaction.
 * 4. Kích hoạt xử lý Queue sau khi commit thành công.
 *
 * @param {number} homestayId
 * @param {number} ownerId
 * @param {number} imageId
 * @returns {Promise<{ success: boolean }>}
 */
export const deleteImage = async (homestayId, ownerId, imageId) => {
  // 1. Kiểm tra Homestay tồn tại
  const homestay = await prisma.hOMESTAY.findUnique({
    where: { MaHomestay: homestayId },
  });

  if (!homestay) {
    throw new Error('Không tìm thấy homestay');
  }

  // 2. Kiểm tra quyền sở hữu của Host
  if (homestay.MaChu !== ownerId) {
    throw new Error('Không có quyền xóa ảnh của homestay này');
  }

  // 3. Kiểm tra ảnh tồn tại
  const image = await prisma.hINH_ANH.findUnique({
    where: { MaAnh: imageId },
  });

  if (!image) {
    throw new Error('Không tìm thấy ảnh');
  }

  // 4. Kiểm tra ảnh có thuộc đúng homestay không
  if (image.MaHomestay !== homestayId) {
    throw new Error('Ảnh không thuộc homestay này');
  }

  // 5. Xác định loại đường dẫn qua Path Classifier
  const classification = await storageService.classifyAndValidateImagePath(image.HinhAnh);
  const shouldEnqueue = classification.isDeletable && (classification.type === 'LOCAL' || classification.type === 'SUPABASE');

  // 6. Thực hiện Transaction bắt buộc: Enqueue Cleanup (nếu là ảnh Local/Supabase) + Xóa bản ghi DB
  await prisma.$transaction(async (tx) => {
    // a. Enqueue Cleanup trong cùng transaction client (tx) nếu ảnh cần xóa vật lý
    if (shouldEnqueue) {
      await enqueueCleanup(
        {
          filePath: classification.filePath || image.HinhAnh,
          bucketName: classification.bucketName,
          reason: 'DELETE_IMAGE',
        },
        tx
      );
    }

    // b. Xóa bản ghi ảnh khỏi bảng HINH_ANH (luôn xóa để loại bỏ khỏi homestay)
    await tx.hINH_ANH.delete({
      where: { MaAnh: imageId },
    });
  });

  // 7. Sau khi transaction commit thành công: kích hoạt xử lý Queue nếu có ảnh cần xóa vật lý
  if (shouldEnqueue) {
    processQueue(storageService.deleteFileFromStorage).catch((err) => {
      console.error(
        '[STORAGE_QUEUE_TRIGGER_WARN] Lỗi khi kích hoạt processQueue sau khi xóa ảnh:',
        err.message
      );
    });
  }

  return { success: true };
};
