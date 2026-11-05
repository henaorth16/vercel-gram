-- CreateTable
CREATE TABLE "TelegramUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "updateId" BIGINT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramUpdate_updateId_key" ON "TelegramUpdate"("updateId");

-- CreateIndex
CREATE INDEX "TelegramUpdate_status_createdAt_idx" ON "TelegramUpdate"("status", "createdAt");
