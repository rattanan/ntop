ALTER TABLE `MeetingDraftConfirmation`
  ADD COLUMN `nextActionActivityId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `MeetingDraftConfirmation_nextActionActivityId_key`
  ON `MeetingDraftConfirmation`(`nextActionActivityId`);

ALTER TABLE `MeetingDraftConfirmation`
  ADD CONSTRAINT `MeetingDraftConfirmation_nextActionActivityId_fkey`
  FOREIGN KEY (`nextActionActivityId`) REFERENCES `Activity`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
