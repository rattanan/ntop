CREATE TABLE `ApprovalSystemConfiguration` (
  `id` VARCHAR(64) NOT NULL,
  `mode` VARCHAR(16) NOT NULL DEFAULT 'DISABLED',
  `version` INTEGER NOT NULL DEFAULT 1,
  `reason` VARCHAR(1000) NULL,
  `updatedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ApprovalWorkflowConfiguration` (
  `id` VARCHAR(64) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `moduleCode` VARCHAR(64) NOT NULL,
  `amountSource` VARCHAR(191) NULL,
  `mode` VARCHAR(16) NOT NULL DEFAULT 'DISABLED',
  `policyId` VARCHAR(191) NOT NULL,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `version` INTEGER NOT NULL DEFAULT 1,
  `reason` VARCHAR(1000) NULL,
  `updatedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ApprovalWorkflowConfiguration_code_key` (`code`),
  UNIQUE INDEX `ApprovalWorkflowConfiguration_policyId_key` (`policyId`),
  INDEX `ApprovalWorkflowConfiguration_mode_displayOrder_idx` (`mode`, `displayOrder`),
  INDEX `ApprovalWorkflowConfiguration_moduleCode_displayOrder_idx` (`moduleCode`, `displayOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ApprovalWorkflowConfiguration_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `ApprovalPolicy` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ApprovalSystemConfiguration` (`id`,`mode`,`version`,`reason`,`createdAt`,`updatedAt`)
VALUES ('approval_system','DISABLED',1,'Approval conditions are not yet approved; draft creation remains available.',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));

INSERT INTO `ApprovalPolicy` (`id`,`code`,`createdAt`,`updatedAt`) VALUES
  ('approval_quote','QUOTE_APPROVAL',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_proposal','PROPOSAL_APPROVAL',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_solution_technical','SOLUTION_TECHNICAL_REVIEW',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_solution_commercial','SOLUTION_COMMERCIAL_APPROVAL',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_site_survey','SITE_SURVEY_RESULT_APPROVAL',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_boq','BOQ_APPROVAL',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_contract','CONTRACT_APPROVAL',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));

INSERT INTO `ApprovalWorkflowConfiguration` (`id`,`code`,`name`,`moduleCode`,`amountSource`,`mode`,`policyId`,`displayOrder`,`version`,`reason`,`createdAt`,`updatedAt`) VALUES
  ('approval_workflow_quote','QUOTE_APPROVAL','Quotation Approval','COMMERCIAL','QuoteVersion.total','DISABLED','approval_quote',10,1,'Temporarily disabled pending approved conditions.',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_workflow_proposal','PROPOSAL_APPROVAL','Proposal Approval','PROPOSAL',NULL,'DISABLED','approval_proposal',20,1,'Temporarily disabled pending approved conditions.',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_workflow_solution_technical','SOLUTION_TECHNICAL_REVIEW','Solution Technical Review','PRESALES',NULL,'DISABLED','approval_solution_technical',30,1,'Temporarily disabled pending approved conditions.',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_workflow_solution_commercial','SOLUTION_COMMERCIAL_APPROVAL','Solution Commercial Approval','PRESALES','SolutionDesign.estimatedPrice','DISABLED','approval_solution_commercial',40,1,'Temporarily disabled pending approved conditions.',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_workflow_site_survey','SITE_SURVEY_RESULT_APPROVAL','Site Survey Result Approval','PRESALES',NULL,'DISABLED','approval_site_survey',50,1,'Temporarily disabled pending approved conditions.',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_workflow_boq','BOQ_APPROVAL','BOQ Approval','PRESALES','BoqHeader.totalContractValue','DISABLED','approval_boq',60,1,'Temporarily disabled pending approved conditions.',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
  ('approval_workflow_contract','CONTRACT_APPROVAL','Contract Approval','CONTRACT','Contract.totalContractValue','DISABLED','approval_contract',70,1,'Temporarily disabled pending approved conditions.',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));
