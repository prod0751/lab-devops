-- Prisma migration seed for initial schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT');

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE "Product" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "sku" TEXT NOT NULL UNIQUE,
  "category" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "minQuantity" INTEGER NOT NULL DEFAULT 0,
  "unitPrice" NUMERIC(12,2) NOT NULL,
  "location" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE "StockMovement" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" "MovementType" NOT NULL,
  "qty" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "userId" UUID REFERENCES "User"("id")
);

CREATE INDEX "idx_product_low_stock" ON "Product" ("quantity", "minQuantity");
CREATE INDEX "idx_movement_product" ON "StockMovement" ("productId");
