-- CreateIndex
CREATE INDEX "Application_userId_createdAt_idx" ON "Application"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationConfig_userId_isActive_idx" ON "AutomationConfig"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Job_userId_createdAt_idx" ON "Job"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_userId_isRelevant_idx" ON "Job"("userId", "isRelevant");
