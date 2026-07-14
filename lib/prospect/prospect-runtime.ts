import { Prisma } from "@prisma/client";
import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { PrismaProspectRepository } from "./prospect-repository";
import { ProspectService } from "./prospect-service";
import { ProspectDocumentService } from "./prospect-document-service";
import { S3ProspectDocumentStorage } from "./prospect-document-storage";
export function createProspectAuditWriter(){return new AppendOnlyAuditWriter<Prisma.TransactionClient>({store:new HashChainedAuditStore({repository:new PrismaAuditLedgerRepository(),maxAttempts:3})});}
export function createProspectRuntime(){return new ProspectService(new PrismaProspectRepository(prisma),createProspectAuditWriter());}
export function createProspectDocumentRuntime(){return new ProspectDocumentService(new PrismaProspectRepository(prisma),createProspectAuditWriter(),new S3ProspectDocumentStorage());}
