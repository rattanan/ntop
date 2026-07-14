-- MariaDB 5.5 compatibility counterpart for Product floor price.
ALTER TABLE `Product` ADD COLUMN `floorPrice` DECIMAL(19,4) NULL AFTER `listPrice`;
INSERT INTO `LegacySchemaMigration` (`id`,`appliedAt`) VALUES ('20260714100000_add_product_floor_price',UTC_TIMESTAMP());
