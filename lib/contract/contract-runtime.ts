import { Prisma } from "@prisma/client";
import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { PrismaContractRepository } from "./prisma-contract-repository";
import { ContractService } from "./contract-service";
import { ContractDocumentService } from "./contract-document-service";
import { S3ProspectDocumentStorage } from "../prospect/prospect-document-storage";
export function createContractRuntime(){const repository=new PrismaContractRepository(prisma);const audit=new AppendOnlyAuditWriter<Prisma.TransactionClient>({store:new HashChainedAuditStore({repository:new PrismaAuditLedgerRepository(),maxAttempts:3})});return{repository,audit,service:new ContractService(repository,audit),documents:new ContractDocumentService(repository,audit,new S3ProspectDocumentStorage())};}
