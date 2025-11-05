// backend/prisma/seed.js
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs' // <-- Đảm bảo bạn đã import
const prisma = new PrismaClient()

// Dữ liệu mock (tôi đã thêm ID chủ homestay vào)
const mockHomestayData = [
  { "TenHomestay": "Biệt thự view hồ Tuyền Lâm", "DiaDiem": "Đà Lạt", "Gia": "2500000", "SoKhachToiDa": 6, "HinhAnh": "uploads/hs1.jpg" },
  { "TenHomestay": "Căn hộ hiện đại tại Quận 1", "DiaDiem": "TP. Hồ Chí Minh", "Gia": "1200000", "SoKhachToiDa": 3, "HinhAnh": "uploads/hs2.jpg" },
  { "TenHomestay": "Nhà vườn yên tĩnh ở Hội An", "DiaDiem": "Hội An", "Gia": "900000", "SoKhachToiDa": 4, "HinhAnh": "uploads/hs3.jpg" },
  { "TenHomestay": "Bungalow sát biển Phú Quốc", "DiaDiem": "Phú Quốc", "Gia": "1800000", "SoKhachToiDa": 2, "HinhAnh": "uploads/hs4.jpg" },
  { "TenHomestay": "Penthouse sang trọng Landmark 81", "DiaDiem": "TP. Hồ Chí Minh", "Gia": "4500000", "SoKhachToiDa": 4, "HinhAnh": "uploads/hs5.jpg" },
  { "TenHomestay": "Nhà gỗ mộc mạc Sapa", "DiaDiem": "Sapa", "Gia": "750000", "SoKhachToiDa": 2, "HinhAnh": "uploads/hs6.jpg" },
  { "TenHomestay": "Căn hộ studio Phố Cổ", "DiaDiem": "Hà Nội", "Gia": "800000", "SoKhachToiDa": 2, "HinhAnh": "uploads/hs7.jpg" },
  { "TenHomestay": "Villa hồ bơi riêng Vũng Tàu", "DiaDiem": "Vũng Tàu", "Gia": "3200000", "SoKhachToiDa": 8, "HinhAnh": "uploads/hs8.jpg" },
  { "TenHomestay": "Nhà trên cây (Treehouse) Đà Lạt", "DiaDiem": "Đà Lạt", "Gia": "1300000", "SoKhachToiDa": 2, "HinhAnh": "uploads/hs9.jpg" },
  { "TenHomestay": "Căn hộ dịch vụ Tây Hồ", "DiaDiem": "Hà Nội", "Gia": "1100000", "SoKhachToiDa": 2, "HinhAnh": "uploads/hs10.jpg" },
  { "TenHomestay": "Gác mái ấm cúng (Loft)", "DiaDiem": "TP. Hồ Chí Minh", "Gia": "950000", "SoKhachToiDa": 2, "HinhAnh": "uploads/hs11.jpg" },
  { "TenHomestay": "Biệt thự biển An Bàng", "DiaDiem": "Hội An", "Gia": "2800000", "SoKhachToiDa": 6, "HinhAnh": "uploads/hs12.jpg" },
  { "TenHomestay": "Phòng view biển Nha Trang", "DiaDiem": "Nha Trang", "Gia": "1400000", "SoKhachToiDa": 2, "HinhAnh": "uploads/hs13.jpg" },
  { "TenHomestay": "Nhà sàn truyền thống Hà Giang", "DiaDiem": "Hà Giang", "Gia": "500000", "SoKhachToiDa": 4, "HinhAnh": "uploads/hs14.jpg" },
  { "TenHomestay": "Căn hộ gần Cầu Rồng", "DiaDiem": "Đà Nẵng", "Gia": "850000", "SoKhachToiDa": 3, "HinhAnh": "uploads/hs15.jpg" },
  { "TenHomestay": "Homestay giữa đồng lúa", "DiaDiem": "Ninh Bình", "Gia": "600000", "SoKhachToiDa": 2, "HinhAnh": "uploads/hs16.jpg" },
  { "TenHomestay": "Villa đồi thông Sóc Sơn", "DiaDiem": "Hà Nội", "Gia": "3500000", "SoKhachToiDa": 10, "HinhAnh": "uploads/hs17.jpg" },
  { "TenHomestay": "Phòng trọ decor kiểu Hàn", "DiaDiem": "TP. Hồ Chí Minh", "Gia": "700000", "SoKhachToiDa": 2, "HinhAnh": "uploads/hs18.jpg" },
  { "TenHomestay": "Resort nghỉ dưỡng Mũi Né", "DiaDiem": "Phan Thiết", "Gia": "2100000", "SoKhachToiDa": 2, "HinhAnh": "uploads/hs19.jpg" },
  { "TenHomestay": "Căn hộ ven sông Sài Gòn", "DiaDiem": "TP. Hồ Chí Minh", "Gia": "1500000", "SoKhachToiDa": 3, "HinhAnh": "uploads/hs20.jpg" }
];
async function main() {
  console.log('Start seeding ...')

  // 1. Tạo một chủ homestay (owner) để làm chủ sở hữu
  const owner = await prisma.cHU_HOMESTAY.upsert({
    where: { Email: 'seed.owner@test.com' },
    update: {},
    create: {
      HoTen: 'Chủ Seed Data',
      Email: 'seed.owner@test.com',
      MatKhau: await bcrypt.hash('password123', 12),
      SoCCCD: '999999999999',
    },
  })
  console.log(`Created owner: ${owner.HoTen}`)

  // 2. Xóa homestay cũ (nếu có) để tránh trùng lặp
  await prisma.hOMESTAY.deleteMany({ where: { MaChu: owner.MaChu }})
  console.log('Deleted old homestays.')

  // 3. Tạo 20 homestay mới
  for (const hs of mockHomestayData) {
    await prisma.hOMESTAY.create({
      data: {
        TenHomestay: hs.TenHomestay,
        DiaDiem: hs.DiaDiem,
        Gia: parseFloat(hs.Gia),
        SoKhachToiDa: hs.SoKhachToiDa,
        MoTa: 'Đây là mô tả mẫu cho homestay.',
        TienIch: 'Wifi, Điều hòa, Nóng lạnh',
        MaChu: owner.MaChu,
        HINH_ANH: {
          create: {
            HinhAnh: hs.HinhAnh, // Lưu link ảnh Unsplash
          },
        },
      },
    })
  }
  console.log(`Created ${mockHomestayData.length} new homestays.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    console.log('Seeding complete.')
  })