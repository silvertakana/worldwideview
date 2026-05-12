-- CreateTable
CREATE TABLE "waypoints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#38bdf8',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waypoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waypoint_posts" (
    "id" TEXT NOT NULL,
    "waypointId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waypoint_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waypoints_userId_idx" ON "waypoints"("userId");

-- CreateIndex
CREATE INDEX "waypoints_tenantId_idx" ON "waypoints"("tenantId");

-- CreateIndex
CREATE INDEX "waypoint_posts_waypointId_idx" ON "waypoint_posts"("waypointId");

-- AddForeignKey
ALTER TABLE "waypoints" ADD CONSTRAINT "waypoints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waypoint_posts" ADD CONSTRAINT "waypoint_posts_waypointId_fkey" FOREIGN KEY ("waypointId") REFERENCES "waypoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
