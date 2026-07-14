-- Additive MySQL 8 forward migration. Floor price is nullable so existing
-- products remain readable until Commercial Owner supplies an approved value.
ALTER TABLE `Product` ADD COLUMN `floorPrice` DECIMAL(19,4) NULL;
