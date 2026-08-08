-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Genre_userId_idx" ON "Genre"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_userId_name_key" ON "Genre"("userId", "name");

-- AddForeignKey
ALTER TABLE "Genre" ADD CONSTRAINT "Genre_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
