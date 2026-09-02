-- CreateTable
CREATE TABLE "SuggestionSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wheelId" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "guestName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuggestionSession_userId_idx" ON "SuggestionSession"("userId");

-- CreateIndex
CREATE INDEX "Suggestion_sessionId_idx" ON "Suggestion"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Suggestion_sessionId_movieId_key" ON "Suggestion"("sessionId", "movieId");

-- AddForeignKey
ALTER TABLE "SuggestionSession" ADD CONSTRAINT "SuggestionSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionSession" ADD CONSTRAINT "SuggestionSession_wheelId_fkey" FOREIGN KEY ("wheelId") REFERENCES "Wheel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SuggestionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
