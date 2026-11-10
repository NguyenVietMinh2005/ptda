-- AlterTable
ALTER TABLE "DAT_PHONG" ADD COLUMN "PhuongThucThanhToan" VARCHAR(50),
ADD COLUMN "NgayThanhToan" TIMESTAMP(0);

-- CreateTable
CREATE TABLE "GIAO_DICH" (
    "MaGiaoDich" VARCHAR(100) NOT NULL,
    "MaDatPhong" INTEGER NOT NULL,
    "SoTien" DECIMAL(12, 2) NOT NULL,
    "PhuongThuc" VARCHAR(50) NOT NULL,
    "TrangThai" VARCHAR(50) NOT NULL,
    "NguoiThaoTac" VARCHAR(100),
    "MaNguoiThaoTac" INTEGER,
    "VaiTroNguoiThaoTac" VARCHAR(50),
    "GhiChu" TEXT,
    "NgayThanhToan" TIMESTAMP(0),
    "created_at" TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GIAO_DICH_pkey" PRIMARY KEY ("MaGiaoDich")
);

-- CreateIndex
CREATE INDEX "GIAO_DICH_MaDatPhong_idx" ON "GIAO_DICH"("MaDatPhong");

-- AddForeignKey
ALTER TABLE "GIAO_DICH" ADD CONSTRAINT "GIAO_DICH_MaDatPhong_fkey" FOREIGN KEY ("MaDatPhong") REFERENCES "DAT_PHONG"("MaDatPhong") ON DELETE CASCADE ON UPDATE CASCADE;

