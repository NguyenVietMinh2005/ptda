-- CreateTable
CREATE TABLE IF NOT EXISTS "STORAGE_CLEANUP_QUEUE" (
    "id" SERIAL NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "bucketName" VARCHAR(100) NOT NULL DEFAULT 'homestays',
    "reason" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(0),
    "lockToken" VARCHAR(64),
    "nextRetryAt" TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "STORAGE_CLEANUP_QUEUE_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "STORAGE_CLEANUP_QUEUE_status_retryCount_idx" ON "STORAGE_CLEANUP_QUEUE"("status", "retryCount");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "STORAGE_CLEANUP_QUEUE_status_nextRetryAt_idx" ON "STORAGE_CLEANUP_QUEUE"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "STORAGE_CLEANUP_QUEUE_filePath_idx" ON "STORAGE_CLEANUP_QUEUE"("filePath");

-- Partial Unique Index to ensure only ONE active job (PENDING or PROCESSING) per file
CREATE UNIQUE INDEX IF NOT EXISTS "idx_active_storage_cleanup" ON "STORAGE_CLEANUP_QUEUE"("filePath", "bucketName") WHERE status IN ('PENDING', 'PROCESSING');

