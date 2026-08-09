-- Additive idempotency guard for Contract -> Service Order handoff.
-- Existing rows remain valid with NULL keys; all new application writes populate the key.
ALTER TABLE `ContractServiceOrder`
  ADD COLUMN `businessKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `ContractServiceOrder_businessKey_key`
  ON `ContractServiceOrder`(`businessKey`);
