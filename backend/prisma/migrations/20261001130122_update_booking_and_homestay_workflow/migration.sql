-- CreateEnum
CREATE TYPE "DAT_PHONG_TrangThaiThanhToan" AS ENUM ('ChuaThanhToan', 'DaThanhToan');

-- CreateEnum
CREATE TYPE "HOMESTAY_TrangThaiDuyet" AS ENUM ('ChoDuyet', 'DaDuyet', 'TuChoi');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DAT_PHONG_TrangThai" ADD VALUE 'DangLuuTru';
ALTER TYPE "DAT_PHONG_TrangThai" ADD VALUE 'DaHoanThanh';

-- AlterTable
ALTER TABLE "DAT_PHONG" ADD COLUMN     "TrangThaiThanhToan" "DAT_PHONG_TrangThaiThanhToan" DEFAULT 'ChuaThanhToan';

-- AlterTable
ALTER TABLE "HOMESTAY" ADD COLUMN     "TrangThaiDuyet" "HOMESTAY_TrangThaiDuyet" DEFAULT 'ChoDuyet',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
