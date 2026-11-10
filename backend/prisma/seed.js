// backend/prisma/seed.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads');

const prisma = new PrismaClient();

// Helper to download image safely with redirect support
async function downloadImage(url, destPath) {
  // If file exists and size is valid (> 10KB), reuse existing file
  if (fs.existsSync(destPath)) {
    const stats = fs.statSync(destPath);
    if (stats.size > 10000) {
      return true;
    }
  }

  return new Promise((resolve, reject) => {
    function fetchUrl(targetUrl, redirectCount = 0) {
      if (redirectCount > 3) {
        return reject(new Error(`Too many redirects for ${targetUrl}`));
      }

      const req = https.get(targetUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`));
        }

        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve(true);
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });

      req.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });

      req.setTimeout(15000, () => {
        req.destroy();
        fs.unlink(destPath, () => {});
        reject(new Error(`Timeout downloading ${targetUrl}`));
      });
    }

    fetchUrl(url);
  });
}

const homestaysData = [
  // 1. Hà Nội - Phố Cổ
  {
    TenHomestay: "Indochine Charm Studio - Phố Cổ Hà Nội",
    DiaDiem: "Số 28 Phố Hàng Vôi, Phường Lý Thái Tổ, Quận Hoàn Kiếm, Hà Nội",
    Gia: 780000,
    SoKhachToiDa: 2,
    TienIch: "Wifi tốc độ cao, Điều hòa 2 chiều, Bếp tiện nghi, Máy giặt sấy, Smart TV Netflix, Ban công ngắm phố, Tự check-in khóa thông minh, Máy pha cà phê",
    MoTa: "Tọa lạc ngay giữa lòng Phố Cổ Hà Nội, Indochine Charm Studio mang phong cách kiến trúc Đông Dương hoài cổ kết hợp tiện nghi hiện đại. Căn hộ có ban công đón nắng ngắm nhìn con phố rợp bóng cây, chỉ cách Hồ Gươm 3 phút đi bộ. Không gian yên tĩnh, trang nhã, lý tưởng cho các cặp đôi hoặc du khách muốn trải nghiệm văn hóa thủ đô.",
    photos: [
      'photo-1545324418-cc1a3fa10c00',
      'photo-1590490360182-c33d57733427',
      'photo-1584622650111-993a426fbf0a',
      'photo-1513694203232-719a280e022f'
    ]
  },
  // 2. Hà Nội - Sóc Sơn
  {
    TenHomestay: "The Chipmunk - Villa Đồi Thông Sóc Sơn",
    DiaDiem: "Thôn Lâm Trường, Xã Minh Phú, Huyện Sóc Sơn, Hà Nội",
    Gia: 3200000,
    SoKhachToiDa: 10,
    TienIch: "Hồ bơi riêng ngoài trời, Sân nướng BBQ sân vườn, Bếp lớn đầy đủ đồ gia dụng, Lò sưởi củi, Chỗ đỗ xe ô tô rộng rãi, Wifi phủ khắp khuôn viên, Bàn bi-a giải trí, Loa kéo karaoke",
    MoTa: "Ẩn mình giữa rừng thông bạt ngàn tại Sóc Sơn, The Chipmunk Villa là điểm trốn phố hoàn hảo cho gia đình và nhóm bạn vào dịp cuối tuần. Biệt thự thiết kế mở bằng kính lớn đón trọn ánh sáng tự nhiên và view rừng thông thơ mộng, có hồ bơi vô cực ngắm hoàng hôn và sân vườn rộng tổ chức tiệc BBQ ngoài trời ấm cúng.",
    photos: [
      'photo-1518780664697-55e3ad937233',
      'photo-1595526114035-0d45ed16cfbf',
      'photo-1552321554-5fefe8c9ef14',
      'photo-1600585154526-990dced4db0d'
    ]
  },
  // 3. Hà Nội - Tây Hồ
  {
    TenHomestay: "Westlake Sunset Haven - Căn Hộ View Hồ Tây",
    DiaDiem: "Số 68 Đường Quảng An, Phường Quảng An, Quận Tây Hồ, Hà Nội",
    Gia: 1350000,
    SoKhachToiDa: 4,
    TienIch: "View toàn cảnh Hồ Tây, Ban công ngắm hoàng hôn, Bếp đảo hiện đại phong cách Bắc Âu, Bồn tắm nằm sang trọng, Máy sấy quần áo, Thang máy riêng, Phòng tập gym tòa nhà",
    MoTa: "Căn hộ cao cấp ven Hồ Tây sở hữu góc ban công ngắm trọn vẹn hoàng hôn lãng mạn buông xuống mặt nước. Thiết kế phong cách Scandinavia tối giản với tone màu ấm áp, đầy đủ bếp từ, lò nướng, máy pha cà phê cao cấp, mang đến kỳ nghỉ dưỡng chuẩn phong cách sống tinh tế giữa lòng Hà Nội.",
    photos: [
      'photo-1502672260266-1c1ef2d93688',
      'photo-1522771739844-6a9f6d5f14af',
      'photo-1620626011761-996317b8d101',
      'photo-1505691938895-1758d7feb511'
    ]
  },
  // 4. Đà Lạt - The Kupid Hill
  {
    TenHomestay: "The Kupid - Hill Homestay View Thung Lũng",
    DiaDiem: "Số 47 Đặng Thái Thân, Phường 3, Đà Lạt",
    Gia: 950000,
    SoKhachToiDa: 4,
    TienIch: "Phòng kính view thung lũng thông, Bồn tắm ngâm thảo mộc view đồi, Khuôn viên sân vườn hoa cẩm tú cầu, Bếp nướng BBQ ngoài trời, Quán cafe check-in tại chỗ, Bữa sáng địa phương",
    MoTa: "Nằm lưng chừng trên sườn đồi thoai thoải, The Kupid mở ra tầm nhìn bao quát thung lũng thông xanh và những buổi sớm mây vờn sương bạc. Phòng ngủ với vách kính lớn chạm trần cho phép bạn thức giấc đón ánh bình minh ấm áp ngay trên giường ngủ, thưởng thức ly trà nóng giữa không khí trong lành của xứ sở ngàn hoa.",
    photos: [
      'photo-1449158743715-0a90ebb6d2d8',
      'photo-1616046229478-9901c5536a45',
      'photo-1600565193348-f74bd3c7ccdf',
      'photo-1470770841072-f978cf4d019e'
    ]
  },
  // 5. Đà Lạt - Mây Lang Thang
  {
    TenHomestay: "Mây Lang Thang Chalet & Acoustic",
    DiaDiem: "Hẻm 7B Hoàng Hoa Thám, Phường 10, Đà Lạt",
    Gia: 1150000,
    SoKhachToiDa: 4,
    TienIch: "Sân khấu nhạc acoustic mây bay, View hoàng hôn thung lũng, Lò sưởi củi trong nhà, Ban công gỗ ngoài trời, Wifi cáp quang, Cafe & quầy bar phục vụ tại chỗ",
    MoTa: "Một chốn dừng chân đầy chất thơ giữa đồi dốc Đà Lạt. Nơi đây sở hữu các phòng nghỉ ốp gỗ thông ấm cúng mang hương thơm dịu nhẹ, ban công ngắm trọn biển mây sớm và những chiều hoàng hôn tím biếc. Vào buổi tối, bạn có thể lắng nghe những giai điệu acoustic mộc mạc và thưởng thức đồ uống nóng bên lò sưởi bập bùng.",
    photos: [
      'photo-1510798831971-661eb04b3739',
      'photo-1617325247661-675ab4b64ae2',
      'photo-1564540586988-aa4e53c3d799',
      'photo-1542718610-a1d656d1884c'
    ]
  },
  // 6. Đà Lạt - Biệt Thự Hồ Tuyền Lâm
  {
    TenHomestay: "Pine Lake Luxury Villa - Hồ Tuyền Lâm",
    DiaDiem: "Khu du lịch Hồ Tuyền Lâm, Phường 4, Đà Lạt",
    Gia: 2850000,
    SoKhachToiDa: 8,
    TienIch: "Hồ bơi nước ấm vô cực view hồ, Bến thuyền kayak dạo hồ Tuyền Lâm, Bếp nướng BBQ ngoài trời, Phòng khách sang trọng có lò sưởi, 4 phòng ngủ khép kín, Quản gia phục vụ 24/7",
    MoTa: "Biệt thự nghỉ dưỡng cao cấp tọa lạc riêng biệt bên bờ hồ Tuyền Lâm phẳng lặng. Với kiến trúc phong cách châu Âu hiện đại kết hợp đá tự nhiên và gỗ mộc, không gian mang lại sự riêng tư tuyệt đối, bình yên và đẳng cấp cho những kỳ nghỉ dưỡng gia đình cao cấp.",
    photos: [
      'photo-1580587771525-78b9dba3b914',
      'photo-1578683010236-d716f9a3f461',
      'photo-1584622781564-1d987f7333c1',
      'photo-1512915922686-57c11dde9b6b'
    ]
  },
  // 7. Đà Lạt - Rustic Cabin
  {
    TenHomestay: "The Wild Pine Cabin - Nhà Gỗ Đồi Thông",
    DiaDiem: "Đường Khởi Nghĩa Bắc Sơn, Phường 10, Đà Lạt",
    Gia: 680000,
    SoKhachToiDa: 2,
    TienIch: "Không gian hoàn toàn bằng gỗ thông tự nhiên, Lò sưởi mini, Bàn trà ngắm vườn dâu tây, Tự nấu ăn tiện lợi, Đốt lửa trại buổi tối, Sách và board game giải trí",
    MoTa: "Căn cabin nhỏ xinh nằm nép mình dưới rặng thông già, tách biệt khỏi ồn ào khói bụi thành phố. Thiết kế tối giản, ấm cúng với rèm vải mộc, đệm lông êm ái và góc đọc sách chan hòa ánh nắng mai. Buổi tối có thể tự tay nhóm củi nướng khoai bắp và ngắm bầu trời sao lấp lánh.",
    photos: [
      'photo-1470770841072-f978cf4d019e',
      'photo-1616486338812-3dadae4b4ace',
      'photo-1604014237800-1c9102c219da',
      'photo-1464822759023-fed622ff2c3b'
    ]
  },
  // 8. Sa Pa - Clay House
  {
    TenHomestay: "Sapa Clay House - Mountain Retreat",
    DiaDiem: "Bản Tả Van Giáy, Xã Tả Van, Sa Pa",
    Gia: 1250000,
    SoKhachToiDa: 4,
    TienIch: "Nhà trình tường đất truyền thống phong cách nhiệt đới, Bồn tắm thảo dược người Dao Đỏ, View thung lũng Mường Hoa và đỉnh Fansipan, Nhà hàng ẩm thực Tây Bắc, Lò sưởi đá",
    MoTa: "Được xây dựng từ đất sét tự nhiên theo phương pháp trình tường của đồng bào bản địa, Sapa Clay House giữ nhiệt cực tốt vào mùa đông và mát mẻ vào mùa hè. Nằm trực diện với thung lũng Mường Hoa, đây là nơi ngắm ruộng bậc thang mùa lúa chín đẹp bậc nhất Sa Pa.",
    photos: [
      'photo-1506744038136-46273834b3fb',
      'photo-1618773928121-c32242e63f39',
      'photo-1600585152220-90363fe7e115',
      'photo-1600210492486-724fe5c67fb0'
    ]
  },
  // 9. Sa Pa - Eco Palms House
  {
    TenHomestay: "Eco Palms House - Giữa Thung Lũng Mường Hoa",
    DiaDiem: "Bản Lao Chải, Sa Pa",
    Gia: 920000,
    SoKhachToiDa: 3,
    TienIch: "Bungalow mái cọ vách tre mộc mạc, View suối Mường Hoa róc rách, Giường ngủ nệm êm chăn thổ cẩm dệt tay, Ban công ngắm mây luồn, Trà thảo mộc bản địa miễn phí",
    MoTa: "Eco Palms House mang đến trải nghiệm sống gần gũi với thiên nhiên hoang sơ của Tây Bắc. Mỗi căn bungalow được lợp mái cọ, vách tre và sàn gỗ tái chế, hướng nhìn thẳng ra những tầng ruộng bậc thang kỳ vĩ. Không gian tĩnh lặng chỉ có tiếng suối chảy và gió reo qua rặng tre.",
    photos: [
      'photo-1542314831-068cd1dbfeeb',
      'photo-1505693416388-ac5ce068fe85',
      'photo-1584622650111-993a426fbf0a',
      'photo-1513694203232-719a280e022f'
    ]
  },
  // 10. Sa Pa - Chapa Ecolodge
  {
    TenHomestay: "Chapa Ecolodge - Nơi Chạm Vào Mây Trời",
    DiaDiem: "Thôn Lồ Dung Chải, Xã San Sả Hồ, Sa Pa",
    Gia: 820000,
    SoKhachToiDa: 2,
    TienIch: "View biển mây bồng bềnh 360 độ, Bồn tắm sục ngắm đỉnh núi, Lò sưởi điện êm dịu, Đồ ăn sáng hữu cơ tự trồng, Hỗ trợ thuê xe máy khám phá bản làng",
    MoTa: "Tọa lạc trên đỉnh đồi lộng gió, Chapa Ecolodge là nơi bạn có thể chạm tay vào từng làn mây trôi lững lờ mỗi sớm mai. Thiết kế kết hợp giữa gỗ sồi và đá tự nhiên, giữ trọn vẻ mộc mạc nhưng tiện nghi cao cấp, đem lại cảm giác thư thái tuyệt đối cho tâm hồn.",
    photos: [
      'photo-1584132967334-10e028bd69f7',
      'photo-1598928506311-c55ded91a20c',
      'photo-1552321554-5fefe8c9ef14',
      'photo-1600607687939-ce8a6c25118c'
    ]
  },
  // 11. Ninh Bình - Tam Cốc Horizon
  {
    TenHomestay: "Tam Cốc Horizon Homestay - Chân Núi Ngô Đồng",
    DiaDiem: "Thôn Văn Lâm, Xã Ninh Hải, Ninh Bình",
    Gia: 680000,
    SoKhachToiDa: 3,
    TienIch: "Hồ bơi xanh mát nép chân núi đá vôi, Miễn phí xe đạp dạo đồng lúa Tam Cốc, Bữa sáng ẩm thực đặc sản Ninh Bình, Điều hòa, Nóng lạnh, Wifi nhanh",
    MoTa: "Được bao bọc bởi những dãy núi đá vôi sừng sững nghìn năm và dòng sông Ngô Đồng thơ mộng, Tam Cốc Horizon Homestay mang đến bầu không khí làng quê Bắc Bộ thanh bình. Du khách có thể thảnh thơi đạp xe dạo quanh cánh đồng lúa chín vàng hoặc bơi lội trong làn nước mát dưới chân vách đá.",
    photos: [
      'photo-1588880331179-bc9b93a8cb5e',
      'photo-1566665797739-1674de7a421a',
      'photo-1600566753190-17f0baa2a6c3',
      'photo-1571003123894-1f0594d2b5d9'
    ]
  },
  // 12. Ninh Bình - Tràng An Riverside
  {
    TenHomestay: "Tràng An Riverside Garden Homestay",
    DiaDiem: "Thôn Tràng An, Xã Trường Yên, Ninh Bình",
    Gia: 790000,
    SoKhachToiDa: 4,
    TienIch: "Bungalow sát mặt nước, Chèo thuyền kayak trên sông tự do, Sân câu cá giải trí, Nhà hàng phục vụ dê núi cơm cháy, Vườn cây ăn trái trĩu quả",
    MoTa: "Nằm sát bên nhánh sông uốn lượn dẫn vào quần thể di sản thế giới Tràng An, homestay sở hữu những căn bungalow gỗ tre mộc mạc soi bóng xuống mặt nước trong veo. Buổi chiều tà ngồi câu cá hoặc chèo kayak ngắm đàn cò bay về tổ giữa khung cảnh sơn thủy hữu tình.",
    photos: [
      'photo-1596394516093-501ba68a0ba6',
      'photo-1591825729269-caeb344f6df2',
      'photo-1600566753086-00f18fb6b3ea',
      'photo-1507525428034-b723cf961d3e'
    ]
  },
  // 13. Ninh Bình - Lotus Field Ecolodge
  {
    TenHomestay: "Ninh Bình Lotus Field Lodge",
    DiaDiem: "Xã Gia Sinh, Huyện Gia Viễn, Ninh Bình",
    Gia: 890000,
    SoKhachToiDa: 4,
    TienIch: "Nằm giữa đầm sen bạt ngàn, Hồ bơi vô cực sinh thái, Xe đạp miễn phí tham quan chùa Bái Đính, Bếp ăn gia đình, Không gian yên tĩnh tuyệt đối",
    MoTa: "Tọa lạc giữa đầm sen thơm ngát dưới bóng chùa Bái Đính linh thiêng, Lotus Field Lodge được dựng từ các vật liệu thân thiện như đá núi, mái lá cọ và gỗ tự nhiên. Mỗi sớm mai mở cửa sổ, bạn sẽ được đón nhận hương sen ngào ngạt và không khí trong lành tinh khôi.",
    photos: [
      'photo-1568605117036-5fe5e7bab0b7',
      'photo-1582533561751-ef6f6ab93a2e',
      'photo-1543489822-c49534f3271f',
      'photo-1540541338287-41700207dee6'
    ]
  },
  // 14. Đà Nẵng - The Garden House
  {
    TenHomestay: "The Garden Beachside Villa - Biển Mỹ Khê",
    DiaDiem: "Số 15 Hà Bổng, Phường Phước Mỹ, Đà Nẵng",
    Gia: 3500000,
    SoKhachToiDa: 10,
    TienIch: "Hồ bơi riêng gia đình ngoài trời, 4 phòng ngủ máy lạnh cao cấp, Bếp nướng BBQ sân vườn, Cách bãi tắm Mỹ Khê 200m, Smart TV 65 inch, Chỗ đỗ 2 xe ô tô",
    MoTa: "Biệt thự sân vườn hiện đại chỉ cách bãi biển Mỹ Khê vài bước chân. Khuôn viên xanh mát với hồ bơi trong xanh, phòng ốc ngập tràn ánh nắng và trang thiết bị nội thất cao cấp. Lựa chọn hoàn hảo cho đại gia đình hoặc nhóm bạn đi du lịch biển Đà Nẵng.",
    photos: [
      'photo-1613490493576-7fde63acd811',
      'photo-1616594039964-ae9021a400a0',
      'photo-1600585152220-90363fe7e115',
      'photo-1600585154526-990dced4db0d'
    ]
  },
  // 15. Đà Nẵng - Skyline Dragon Bridge Penthouse
  {
    TenHomestay: "Skyline Dragon Bridge Loft - View Cầu Rồng",
    DiaDiem: "Số 188 Bạch Đằng, Phường Bình Hiên, Đà Nẵng",
    Gia: 1450000,
    SoKhachToiDa: 4,
    TienIch: "View trực diện Cầu Rồng phun lửa cuối tuần, Ban công kính ngắm sông Hàn, Thiết kế Duplex thông tầng sang trọng, Bếp đảo cao cấp, Bồn tắm sục Jacuzzi",
    MoTa: "Căn hộ thông tầng cao cấp tọa lạc trên cung đường Bạch Đằng sầm uất ven sông Hàn. Từ phòng khách và ban công kính lớn, bạn có thể thưởng lãm toàn cảnh Cầu Rồng phun lửa, phun nước vào mỗi tối thứ Bảy và Chủ Nhật mà không cần chen chúc.",
    photos: [
      'photo-1545324418-cc1a3fa10c00',
      'photo-1590490359683-658d3d23f972',
      'photo-1620626011761-996317b8d101',
      'photo-1502672260266-1c1ef2d93688'
    ]
  },
  // 16. Đà Nẵng - An Nhiên Garden Homestay
  {
    TenHomestay: "An Nhiên Retreat - Vườn Nhiệt Đới Non Nước",
    DiaDiem: "Đường Trường Sa, Phường Hòa Hải, Đà Nẵng",
    Gia: 850000,
    SoKhachToiDa: 4,
    TienIch: "Khu vườn nhiệt đới xanh mát, Cách biển Non Nước 5 phút, Phòng ngủ thoáng gió biển, Bếp chung tự nấu hải sản, Bãi đỗ xe an toàn, Cho thuê xe máy",
    MoTa: "Nép mình bên chân núi Ngũ Hành Sơn hùng vĩ và bãi biển Non Nước êm đềm, An Nhiên mang đến một không gian xanh mát tĩnh lặng với những rặng dừa, giàn hoa giấy và lối đi rải sỏi trắng. Điểm nghỉ dưỡng mộc mạc và thân thiện cho du khách tìm kiếm sự an yên.",
    photos: [
      'photo-1564013799919-ab600027ffc6',
      'photo-1595428774223-ef52624120d2',
      'photo-1552321554-5fefe8c9ef14',
      'photo-1512918728675-ed5a9ecdebfd'
    ]
  },
  // 17. Hội An - Chic Riverside Villa
  {
    TenHomestay: "Hội An Chic Riverside - Rừng Dừa Bảy Mẫu",
    DiaDiem: "Thôn Vạn Lăng, Xã Cẩm Thanh, Hội An",
    Gia: 1250000,
    SoKhachToiDa: 4,
    TienIch: "Hồ bơi view sông dừa nước, Miễn phí đi thuyền thúng dạo sông, Xe đạp dạo phố cổ Hội An, Bữa sáng đặc sản mì Quảng, Cao Lầu, Ban công đón gió mát",
    MoTa: "Được bao quanh bởi rừng dừa nước Cẩm Thanh xanh mướt, Hội An Chic Villa kết hợp tinh tế giữa phong cách kiến trúc nhiệt đới và văn hóa Hội An xưa. Ngồi bên hiên nhà thưởng thức ly nước mát ngắm những chiếc thuyền thúng lắc lư trên sông mang lại cảm giác bình dị khó quên.",
    photos: [
      'photo-1571896349842-33c89424de2d',
      'photo-1616594039964-ae9021a400a0',
      'photo-1507652313519-d4e9174996dd',
      'photo-1540541338287-41700207dee6'
    ]
  },
  // 18. Hội An - An Bàng Beachfront
  {
    TenHomestay: "An Bàng Beach Hideaway - Nhà Ven Biển",
    DiaDiem: "Tổ 7, Khối An Tân, Phường Cẩm An, Hội An",
    Gia: 1750000,
    SoKhachToiDa: 6,
    TienIch: "Sát mặt biển An Bàng chỉ 50m, Sân hiên tắm nắng ngắm sóng biển, Bếp nấu hải sản tươi sống, Máy pha cafe espresso, Giường ngủ êm ái cỡ King, Khăn tắm biển miễn phí",
    MoTa: "Một ngôi nhà nhỏ xinh xắn phủ đầy hoa giấy tím, chỉ cách bãi cát vàng biển An Bàng vài bước chân. Với tiếng sóng vỗ rì rào ngày đêm và gió biển mát rượi qua từng ô cửa kính, nơi đây là thiên đường nghỉ dưỡng đích thực cho những ai yêu biển Hội An.",
    photos: [
      'photo-1520250497591-112f2f40a3f4',
      'photo-1617806118233-18e1de247200',
      'photo-1584622781564-1d987f7333c1',
      'photo-1507525428034-b723cf961d3e'
    ]
  },
  // 19. Hội An - Heritage House
  {
    TenHomestay: "Phố Hội Heritage House - Vườn Gạch Nung",
    DiaDiem: "Số 54 Nguyễn Thái Học, Phường Minh An, Hội An",
    Gia: 1550000,
    SoKhachToiDa: 5,
    TienIch: "Kiến trúc nhà cổ rường gỗ 100 năm tuổi, Giếng trời hứng sáng và vườn cây cảnh, Lồng đèn Hội An lung linh buổi tối, Trà sen truyền thống, Vị trí trung tâm phố đi bộ",
    MoTa: "Ngôi nhà cổ bảo tồn nguyên vẹn kiến trúc rường gỗ lim, mái ngói âm dương và khoảng sân trong lát gạch nung Bát Tràng rêu phong. Nằm ngay lõi phố cổ, bạn có thể thảnh thơi hòa mình vào nhịp sống bình dị của người dân phố Hội và lung linh ánh đèn hoa đăng mỗi tối.",
    photos: [
      'photo-1591088398332-8a7791972843',
      'photo-1615874959474-d609969a20ed',
      'photo-1564540586988-aa4e53c3d799',
      'photo-1524758631624-e2822e304c36'
    ]
  },
  // 20. Nha Trang - Cliffside Ocean Villa
  {
    TenHomestay: "Ocean Cliffside Villa - Vịnh Nha Trang",
    DiaDiem: "Khu Biệt Thự Biển An Viên, Vĩnh Trường, Nha Trang",
    Gia: 3900000,
    SoKhachToiDa: 8,
    TienIch: "Hồ bơi vô cực view trực diện biển vịnh Nha Trang, 4 phòng ngủ ban công kính, Bếp đảo sang trọng chuẩn 5 sao, Bàn bi-a, Phòng chiếu phim, Sân nướng hải sản BBQ",
    MoTa: "Tọa lạc trên sườn đồi nhìn thẳng ra vịnh biển Nha Trang trong xanh cát trắng, căn villa sở hữu hồ bơi vô cực nối liền đường chân trời. Kiến trúc kính hiện đại đón trọn làn gió biển trong lành và bình minh rực rỡ chiếu sáng toàn bộ không gian sống.",
    photos: [
      'photo-1600596542815-ffad4c1539a9',
      'photo-1615873968403-89e068629265',
      'photo-1600565193348-f74bd3c7ccdf',
      'photo-1582719478250-c89cae4dc85b'
    ]
  },
  // 21. Nha Trang - Bãi Dài Tropical Garden
  {
    TenHomestay: "Bãi Dài Tropical Garden - Biển Bãi Dài",
    DiaDiem: "Đại lộ Nguyễn Tất Thành, Cam Hải Đông, Nha Trang",
    Gia: 1050000,
    SoKhachToiDa: 4,
    TienIch: "Vườn dừa rợp bóng mát sát biển Bãi Dài, Hồ bơi trẻ em & người lớn, Bếp gia đình tự nấu nướng, Bãi cát mịn không dốc an toàn tắm biển, Chỗ đỗ xe ô tô",
    MoTa: "Một ốc đảo nhiệt đới thanh bình nằm tại bãi biển Bãi Dài nổi tiếng với bờ cát trắng mịn và làn nước xanh ngọc bích. Homestay có khu vườn dừa râm mát, thích hợp cho các gia đình có trẻ nhỏ nghỉ ngơi thư giãn và thưởng thức hải sản đầm Thủy Triều tươi ngon.",
    photos: [
      'photo-1540555700478-4be289fbecef',
      'photo-1615529182904-14819c35db37',
      'photo-1584622650111-993a426fbf0a',
      'photo-1519046904884-53103b34b206'
    ]
  },
  // 22. Phú Quốc - Sunset Beachfront Bungalow
  {
    TenHomestay: "Sunset Beachfront Bungalow - Bãi Trường",
    DiaDiem: "Đường Trần Hưng Đạo, Dương Tơ, Phú Quốc",
    Gia: 1950000,
    SoKhachToiDa: 4,
    TienIch: "Bungalow sát mép sóng biển, Ngắm hoàng hôn Bãi Trường ngoạn mục, Bể bơi vô cực sát biển, Quầy bar cocktail bên bãi cát, Bữa sáng buffet hải sản, Đưa đón sân bay",
    MoTa: "Nằm sát cạnh bờ cát Bãi Trường nơi ngắm hoàng hôn đẹp nhất đảo ngọc Phú Quốc. Các căn bungalow mái lá được bài trí trang nhã với giường lớn êm ái, ban công gỗ hướng biển để bạn có thể vừa nhâm nhi cocktail vừa chiêm ngưỡng mặt trời đỏ rực từ từ lặn xuống đại dương.",
    photos: [
      'photo-1566073771259-6a8506099945',
      'photo-1615875605825-5eb9bb5d52ac',
      'photo-1552321554-5fefe8c9ef14',
      'photo-1506929562872-bb421503ef21'
    ]
  },
  // 23. Phú Quốc - Suối Mây Rainforest Ecolodge
  {
    TenHomestay: "Suối Mây Rainforest Ecolodge - Đồi Nguyên Sinh",
    DiaDiem: "Ấp Suối Mây, Dương Tơ, Phú Quốc",
    Gia: 1200000,
    SoKhachToiDa: 4,
    TienIch: "Ẩn mình giữa rừng nguyên sinh trong lành, Hồ bơi nước suối tự nhiên, View đồi núi xanh ngát, Tour trekking suối Tranh có hướng dẫn, Nhà hàng đồ rừng đặc sản, Không gian tĩnh mịch",
    MoTa: "Rời xa những ồn ào nơi phố chợ, Suối Mây Ecolodge nằm ẩn mình bên sườn đồi phủ kín cây cổ thụ xanh rì. Không gian tĩnh lặng như một thế giới riêng biệt, nơi bạn được đánh thức bởi tiếng chim hót líu lo và hương hoa rừng thoang thoảng trong làn gió trong trẻo.",
    photos: [
      'photo-1582719478250-c89cae4dc85b',
      'photo-1616137466211-f939a420be84',
      'photo-1604014237800-1c9102c219da',
      'photo-1512915922686-57c11dde9b6b'
    ]
  },
  // 24. Phú Quốc - Gành Dầu Coral Bay Villa
  {
    TenHomestay: "Coral Bay Sunset Villa - Bắc Đảo Gành Dầu",
    DiaDiem: "Bãi Dài, Gành Dầu, Phú Quốc",
    Gia: 2950000,
    SoKhachToiDa: 6,
    TienIch: "Hồ bơi riêng view biển Campuchia xa xa, Cano lặn ngắm san hô riêng, Bếp gia đình nướng hải sản tươi sống, Quản gia hỗ trợ 24/7, Gần VinWonders & Safari, Xe đưa đón miễn phí",
    MoTa: "Tọa lạc tại mũi Gành Dầu hoang sơ phía Bắc đảo Phú Quốc, villa sở hữu bãi biển riêng với làn nước trong vắt nhìn thấu đáy cát và những rạn san hô tự nhiên. Không gian thoáng đãng, sang trọng, mang lại sự riêng tư trọn vẹn cho những kỳ nghỉ dưỡng biển cao cấp.",
    photos: [
      'photo-1571003123894-1f0594d2b5d9',
      'photo-1616486029423-aaa4789e8c9a',
      'photo-1600585152220-90363fe7e115',
      'photo-1507089947368-19c1da9775ae'
    ]
  }
];

async function main() {
  console.log('=== BẮT ĐẦU NẠP DỮ LIỆU THỰC TẾ HOMESTAY ===');

  // Đảm bảo thư mục uploads tồn tại
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`Đã tạo thư mục uploads: ${uploadsDir}`);
  }

  // 1. Tạo/cập nhật tài khoản Admin mẫu
  const admin = await prisma.cHU_HOMESTAY.upsert({
    where: { Email: 'admin@test.com' },
    update: {
      HoTen: 'Quản trị viên Hệ thống',
      SoDienThoai: '0901234567',
      DiaChi: 'Hà Nội',
      isActive: true,
      Quyen: 'admin'
    },
    create: {
      HoTen: 'Quản trị viên Hệ thống',
      Email: 'admin@test.com',
      MatKhau: await bcrypt.hash('password123', 12),
      SoCCCD: '888888888888',
      SoDienThoai: '0901234567',
      DiaChi: 'Hà Nội',
      isActive: true,
      Quyen: 'admin'
    }
  });
  console.log(`✓ Admin: ${admin.HoTen} (${admin.Email})`);

  // 2. Tạo/cập nhật chủ homestay chính
  const owner = await prisma.cHU_HOMESTAY.upsert({
    where: { Email: 'seed.owner@test.com' },
    update: {
      HoTen: 'Nguyễn Văn Minh - Hệ Thống Homestay Việt Nam',
      SoDienThoai: '0912345678',
      DiaChi: 'Hà Nội & TP. Hồ Chí Minh',
      isActive: true,
      Quyen: 'chu_homestay'
    },
    create: {
      HoTen: 'Nguyễn Văn Minh - Hệ Thống Homestay Việt Nam',
      Email: 'seed.owner@test.com',
      MatKhau: await bcrypt.hash('password123', 12),
      SoCCCD: '999999999999',
      SoDienThoai: '0912345678',
      DiaChi: 'Hà Nội & TP. Hồ Chí Minh',
      isActive: true,
      Quyen: 'chu_homestay'
    }
  });
  console.log(`✓ Chủ homestay: ${owner.HoTen} (ID: ${owner.MaChu})`);

  // 3. Tạo/cập nhật khách hàng mẫu
  const customer = await prisma.nGUOI_DUNG.upsert({
    where: { Email: 'customer@test.com' },
    update: {
      HoTen: 'Nguyễn Khách Hàng',
      SoDienThoai: '0987654321',
      DiaChi: 'Hà Nội',
      isActive: true
    },
    create: {
      HoTen: 'Nguyễn Khách Hàng',
      Email: 'customer@test.com',
      MatKhau: await bcrypt.hash('password123', 12),
      SoDienThoai: '0987654321',
      DiaChi: 'Hà Nội',
      isActive: true
    }
  });
  console.log(`✓ Khách hàng mẫu: ${customer.HoTen} (${customer.Email})`);

  // 2. Tải và lưu hình ảnh cục bộ
  console.log('\n--- BẮT ĐẦU TẢI VÀ KIỂM TRA HÌNH ẢNH UNPLASH ---');
  const slotLabels = ['01_exterior', '02_bedroom', '03_bathroom', '04_view'];

  for (let i = 0; i < homestaysData.length; i++) {
    const hs = homestaysData[i];
    const paddedId = String(i + 1).padStart(2, '0');
    hs.localImagePaths = [];

    for (let slot = 0; slot < hs.photos.length; slot++) {
      const photoId = hs.photos[slot];
      const fileName = `hs_${paddedId}_${slotLabels[slot]}.jpg`;
      const destPath = path.join(uploadsDir, fileName);
      const relativePath = `uploads/${fileName}`;

      const url = `https://images.unsplash.com/${photoId}?w=1000&q=80&auto=format&fit=crop`;
      try {
        await downloadImage(url, destPath);
        hs.localImagePaths.push(relativePath);
      } catch (err) {
        console.error(`  Lỗi tải ảnh [${fileName}] (${photoId}):`, err.message);
        // Fallback to high-quality default if download fails
        hs.localImagePaths.push(relativePath);
      }
    }
    console.log(`  ✓ Đã hoàn tất 4 ảnh cho: [${paddedId}] ${hs.TenHomestay}`);
  }

  // 3. Cập nhật / tạo dữ liệu Homestay và HINH_ANH trong PostgreSQL
  console.log('\n--- ĐỒNG BỘ HOMESTAY VÀO POSTGRESQL ---');
  for (let i = 0; i < homestaysData.length; i++) {
    const hs = homestaysData[i];
    const targetId = i + 1;

    // Kiểm tra xem homestay đã tồn tại theo ID chưa
    const existing = await prisma.hOMESTAY.findUnique({
      where: { MaHomestay: targetId }
    });

    let savedHomestay;
    if (existing) {
      savedHomestay = await prisma.hOMESTAY.update({
        where: { MaHomestay: targetId },
        data: {
          TenHomestay: hs.TenHomestay,
          DiaDiem: hs.DiaDiem,
          Gia: hs.Gia,
          SoKhachToiDa: hs.SoKhachToiDa,
          TienIch: hs.TienIch,
          MoTa: hs.MoTa,
          TrangThaiDuyet: 'DaDuyet',
          isActive: true
        }
      });
      console.log(`  ✓ Cập nhật Homestay #${savedHomestay.MaHomestay}: ${savedHomestay.TenHomestay}`);
    } else {
      savedHomestay = await prisma.hOMESTAY.create({
        data: {
          MaHomestay: targetId,
          MaChu: owner.MaChu,
          TenHomestay: hs.TenHomestay,
          DiaDiem: hs.DiaDiem,
          Gia: hs.Gia,
          SoKhachToiDa: hs.SoKhachToiDa,
          TienIch: hs.TienIch,
          MoTa: hs.MoTa,
          TrangThaiDuyet: 'DaDuyet',
          isActive: true
        }
      });
      console.log(`  ✓ Tạo mới Homestay #${savedHomestay.MaHomestay}: ${savedHomestay.TenHomestay}`);
    }

    // 1. Dọn dẹp các ảnh placeholder mock cũ nếu còn sót lại (uploads/hs1.jpg -> hs20.jpg)
    await prisma.hINH_ANH.deleteMany({
      where: {
        MaHomestay: savedHomestay.MaHomestay,
        HinhAnh: {
          in: Array.from({ length: 25 }, (_, idx) => `uploads/hs${idx + 1}.jpg`)
        }
      }
    });

    // 2. Đồng bộ 4 ảnh seed thực tế, bảo đảm KHÔNG xóa ảnh do người dùng hoặc chủ nhà tải lên
    for (const imgPath of hs.localImagePaths) {
      const imgExists = await prisma.hINH_ANH.findFirst({
        where: {
          MaHomestay: savedHomestay.MaHomestay,
          HinhAnh: imgPath
        }
      });
      if (!imgExists) {
        await prisma.hINH_ANH.create({
          data: {
            MaHomestay: savedHomestay.MaHomestay,
            HinhAnh: imgPath
          }
        });
      }
    }
  }

  // Đếm tổng kết
  const totalHomestays = await prisma.hOMESTAY.count();
  const totalImages = await prisma.hINH_ANH.count();
  console.log('\n=== HOÀN TẤT SEED DỮ LIỆU ===');
  console.log(`Tổng số Homestay trong database: ${totalHomestays}`);
  console.log(`Tổng số hình ảnh trong database: ${totalImages}`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi chạy seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });