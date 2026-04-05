/*
  Warnings:

  - You are about to drop the `aviation_history` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `installed_plugins` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "aviation_history_timestamp_icao24_key";

-- DropIndex
DROP INDEX "aviation_history_timestamp_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "aviation_history";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pluginName" TEXT NOT NULL,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_installed_plugins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pluginId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_installed_plugins" ("config", "id", "installedAt", "pluginId", "version") SELECT "config", "id", "installedAt", "pluginId", "version" FROM "installed_plugins";
DROP TABLE "installed_plugins";
ALTER TABLE "new_installed_plugins" RENAME TO "installed_plugins";
CREATE UNIQUE INDEX "installed_plugins_pluginId_key" ON "installed_plugins"("pluginId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_entityId_key" ON "favorites"("userId", "entityId");
