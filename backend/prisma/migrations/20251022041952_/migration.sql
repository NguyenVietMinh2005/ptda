/*
  Warnings:

  - You are about to alter the column `HinhAnh` on the `HINH_ANH` table. The data in that column could be lost. The data in that column will be cast from `LongBlob` to `VarChar(255)`.

*/
-- AlterTable
ALTER TABLE `HINH_ANH` MODIFY `HinhAnh` VARCHAR(255) NULL;
