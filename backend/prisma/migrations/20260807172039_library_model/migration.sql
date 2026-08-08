/*
  Warnings:

  - You are about to drop the column `posterPath` on the `Movie` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `Movie` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `Movie` table. All the data in the column will be lost.
  - You are about to drop the column `wheelId` on the `Movie` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Movie` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Movie` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Movie" DROP CONSTRAINT "Movie_wheelId_fkey";

-- DropIndex
DROP INDEX "Movie_wheelId_idx";

-- AlterTable
ALTER TABLE "Movie" DROP COLUMN "posterPath",
DROP COLUMN "rating",
DROP COLUMN "weight",
DROP COLUMN "wheelId",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "imdbRating" DOUBLE PRECISION,
ADD COLUMN     "posterUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "WheelItem" (
    "id" TEXT NOT NULL,
    "wheelId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WheelItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WheelItem_wheelId_idx" ON "WheelItem"("wheelId");

-- CreateIndex
CREATE UNIQUE INDEX "WheelItem_wheelId_movieId_key" ON "WheelItem"("wheelId", "movieId");

-- CreateIndex
CREATE INDEX "Movie_userId_idx" ON "Movie"("userId");

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WheelItem" ADD CONSTRAINT "WheelItem_wheelId_fkey" FOREIGN KEY ("wheelId") REFERENCES "Wheel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WheelItem" ADD CONSTRAINT "WheelItem_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
