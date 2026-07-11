-- NTOP initial schema for MariaDB 5.5.
-- Prisma Migrate requires fractional DATETIME support, which MariaDB 5.5 lacks.
CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `role` ENUM('ADMIN','SALES','VIEWER') NOT NULL DEFAULT 'SALES',
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `Customer` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `taxId` VARCHAR(191) NOT NULL,
  `type` ENUM('B2G','B2B') NOT NULL,
  `segment` VARCHAR(191) NOT NULL,
  `province` VARCHAR(191) NOT NULL,
  `address` TEXT NULL,
  `status` ENUM('PROSPECT','ACTIVE','INACTIVE') NOT NULL DEFAULT 'PROSPECT',
  `ownerId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Customer_taxId_key` (`taxId`),
  CONSTRAINT `Customer_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `Contact` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `relationship` VARCHAR(191) NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `Contact_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `Opportunity` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `flow` VARCHAR(191) NOT NULL,
  `stage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST') NOT NULL DEFAULT 'QUALIFY',
  `estimatedValue` DECIMAL(15,2) NOT NULL,
  `probability` INTEGER NOT NULL,
  `expectedCloseAt` DATETIME NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `nextAction` VARCHAR(191) NULL,
  `requirements` TEXT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `Opportunity_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Opportunity_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `VendorAssessment` (
  `id` VARCHAR(191) NOT NULL,
  `opportunityId` VARCHAR(191) NOT NULL,
  `incumbentVendor` VARCHAR(191) NULL,
  `competitors` TEXT NULL,
  `approach` ENUM('DIRECT','PARTNER','DISPLACE') NOT NULL,
  `confidence` INTEGER NOT NULL,
  `rationale` TEXT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `VendorAssessment_opportunityId_key` (`opportunityId`),
  CONSTRAINT `VendorAssessment_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
