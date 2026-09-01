-- Публічне посилання на бібліотеку фільмів: випадковий токен на користувача.
-- NULL = посилання не створене (або відкликане).
ALTER TABLE "User" ADD COLUMN     "shareToken" TEXT;

CREATE UNIQUE INDEX "User_shareToken_key" ON "User"("shareToken");
