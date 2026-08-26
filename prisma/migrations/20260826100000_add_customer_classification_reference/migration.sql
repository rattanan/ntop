CREATE TABLE `CustomerSegment` (
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`code`),
  INDEX `CustomerSegment_active_displayOrder_idx` (`active`, `displayOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubIndustryReference` (
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `segmentCode` VARCHAR(20) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`code`),
  INDEX `SubIndustryReference_segmentCode_active_displayOrder_idx` (`segmentCode`, `active`, `displayOrder`),
  CONSTRAINT `SubIndustryReference_segmentCode_fkey` FOREIGN KEY (`segmentCode`) REFERENCES `CustomerSegment` (`code`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Customer`
  ADD COLUMN `subIndustry` VARCHAR(50) NULL,
  ADD COLUMN `companySize` VARCHAR(20) NULL;

INSERT INTO `CustomerSegment` (`code`, `name`, `active`, `displayOrder`, `updatedAt`) VALUES
  ('G1', 'รัฐบาลส่วนกลางและหน่วยงานกำกับ', true, 10, CURRENT_TIMESTAMP(3)),
  ('G2', 'รัฐวิสาหกิจ', true, 20, CURRENT_TIMESTAMP(3)),
  ('G3', 'องค์กรปกครองส่วนท้องถิ่น', true, 30, CURRENT_TIMESTAMP(3)),
  ('G4', 'การศึกษาและสาธารณสุขภาครัฐ', true, 40, CURRENT_TIMESTAMP(3)),
  ('G5', 'ความมั่นคงและโครงสร้างพื้นฐานสำคัญ', true, 50, CURRENT_TIMESTAMP(3)),
  ('B1', 'องค์กรธุรกิจขนาดใหญ่', true, 60, CURRENT_TIMESTAMP(3)),
  ('B2', 'องค์กรธุรกิจขนาดกลาง', true, 70, CURRENT_TIMESTAMP(3)),
  ('B3', 'ธุรกิจขนาดเล็กและ SME', true, 80, CURRENT_TIMESTAMP(3)),
  ('B4', 'ผู้ให้บริการ พันธมิตร และธุรกิจดิจิทัล', true, 90, CURRENT_TIMESTAMP(3));

INSERT INTO `SubIndustryReference` (`code`, `name`, `segmentCode`, `active`, `displayOrder`, `updatedAt`) VALUES
  ('G1-ADMIN', 'ส่วนราชการและหน่วยงานบริหาร', 'G1', true, 10, CURRENT_TIMESTAMP(3)),
  ('G1-REG', 'หน่วยงานกำกับดูแล', 'G1', true, 20, CURRENT_TIMESTAMP(3)),
  ('G2-ENERGY', 'พลังงานและสาธารณูปโภค', 'G2', true, 10, CURRENT_TIMESTAMP(3)),
  ('G2-TELCO', 'โทรคมนาคมภาครัฐ', 'G2', true, 20, CURRENT_TIMESTAMP(3)),
  ('G2-TRANS', 'ขนส่งและโลจิสติกส์ภาครัฐ', 'G2', true, 30, CURRENT_TIMESTAMP(3)),
  ('G3-LOCAL', 'องค์การบริหารส่วนจังหวัด เทศบาล และ อบต.', 'G3', true, 10, CURRENT_TIMESTAMP(3)),
  ('G3-SMART', 'เมืองอัจฉริยะและบริการประชาชน', 'G3', true, 20, CURRENT_TIMESTAMP(3)),
  ('G4-EDU', 'สถานศึกษาและมหาวิทยาลัยภาครัฐ', 'G4', true, 10, CURRENT_TIMESTAMP(3)),
  ('G4-HEALTH', 'โรงพยาบาลและสาธารณสุขภาครัฐ', 'G4', true, 20, CURRENT_TIMESTAMP(3)),
  ('G5-DEF', 'ความมั่นคงและการป้องกันประเทศ', 'G5', true, 10, CURRENT_TIMESTAMP(3)),
  ('G5-INFRA', 'โครงสร้างพื้นฐานสำคัญ', 'G5', true, 20, CURRENT_TIMESTAMP(3)),
  ('B1-BANK', 'ธนาคารและบริการทางการเงิน', 'B1', true, 10, CURRENT_TIMESTAMP(3)),
  ('B1-ENERGY', 'พลังงานและปิโตรเคมี', 'B1', true, 20, CURRENT_TIMESTAMP(3)),
  ('B1-MFG', 'การผลิตอุตสาหกรรม', 'B1', true, 30, CURRENT_TIMESTAMP(3)),
  ('B1-RETAIL', 'ค้าปลีกและธุรกิจขนาดใหญ่', 'B1', true, 40, CURRENT_TIMESTAMP(3)),
  ('B2-CONST', 'ก่อสร้างและอสังหาริมทรัพย์', 'B2', true, 10, CURRENT_TIMESTAMP(3)),
  ('B2-HOSP', 'โรงแรมและการท่องเที่ยว', 'B2', true, 20, CURRENT_TIMESTAMP(3)),
  ('B2-LOGI', 'โลจิสติกส์และขนส่ง', 'B2', true, 30, CURRENT_TIMESTAMP(3)),
  ('B2-SVC', 'บริการวิชาชีพ', 'B2', true, 40, CURRENT_TIMESTAMP(3)),
  ('B3-MFG', 'การผลิต SME', 'B3', true, 10, CURRENT_TIMESTAMP(3)),
  ('B3-RETAIL', 'ค้าปลีก SME', 'B3', true, 20, CURRENT_TIMESTAMP(3)),
  ('B3-SVC', 'บริการ SME', 'B3', true, 30, CURRENT_TIMESTAMP(3)),
  ('B4-CLOUD', 'Cloud และธุรกิจดิจิทัล', 'B4', true, 10, CURRENT_TIMESTAMP(3)),
  ('B4-SI', 'System Integrator', 'B4', true, 20, CURRENT_TIMESTAMP(3)),
  ('B4-TELCO', 'ผู้ให้บริการโทรคมนาคม', 'B4', true, 30, CURRENT_TIMESTAMP(3)),
  ('B4-PARTNER', 'ตัวแทนจำหน่ายและพันธมิตร', 'B4', true, 40, CURRENT_TIMESTAMP(3));
