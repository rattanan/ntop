-- MariaDB 5.5 exact idempotency uniqueness without exceeding the legacy
-- InnoDB 767-byte composite-index limit.
ALTER TABLE `LeadCommandReceipt`
  ADD COLUMN `receiptHash` CHAR(64) NULL;

UPDATE `LeadCommandReceipt`
SET `receiptHash` = SHA2(CONCAT(
  CHAR_LENGTH(`actorId`), ':', `actorId`, '|',
  CHAR_LENGTH(`idempotencyKey`), ':', `idempotencyKey`, '|',
  `command`
), 256);

ALTER TABLE `LeadCommandReceipt`
  ADD KEY `LeadCommandReceipt_actorId_idx` (`actorId`);

ALTER TABLE `LeadCommandReceipt`
  MODIFY COLUMN `receiptHash` CHAR(64) NOT NULL,
  DROP INDEX `LeadCommandReceipt_actor_key_command_key`,
  ADD UNIQUE KEY `LeadCommandReceipt_receiptHash_key` (`receiptHash`);

CREATE TRIGGER `LeadCommandReceipt_hash_insert`
BEFORE INSERT ON `LeadCommandReceipt` FOR EACH ROW
SET NEW.`receiptHash` = SHA2(CONCAT(
  CHAR_LENGTH(NEW.`actorId`), ':', NEW.`actorId`, '|',
  CHAR_LENGTH(NEW.`idempotencyKey`), ':', NEW.`idempotencyKey`, '|',
  NEW.`command`
), 256);

CREATE TRIGGER `LeadCommandReceipt_hash_update`
BEFORE UPDATE ON `LeadCommandReceipt` FOR EACH ROW
SET NEW.`receiptHash` = SHA2(CONCAT(
  CHAR_LENGTH(NEW.`actorId`), ':', NEW.`actorId`, '|',
  CHAR_LENGTH(NEW.`idempotencyKey`), ':', NEW.`idempotencyKey`, '|',
  NEW.`command`
), 256);

INSERT INTO `LegacySchemaMigration` (`id`, `appliedAt`)
VALUES ('20260714121500_add_lead_receipt_hash_index', UTC_TIMESTAMP());
