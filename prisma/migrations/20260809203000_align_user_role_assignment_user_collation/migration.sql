-- Repair schema drift where the assignment-side user foreign key retained the
-- database's legacy utf8mb4_general_ci collation while User.id was normalized
-- to utf8mb4_unicode_ci. The mismatched columns fail on relational filters.
ALTER TABLE `UserRoleAssignment`
  DROP FOREIGN KEY `UserRoleAssignment_userId_fkey`;

ALTER TABLE `UserRoleAssignment`
  MODIFY `userId` VARCHAR(191)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

ALTER TABLE `UserRoleAssignment`
  ADD CONSTRAINT `UserRoleAssignment_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
