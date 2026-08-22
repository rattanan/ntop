import { NextResponse } from "next/server";
import { z } from "zod";

import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { prisma } from "@/lib/prisma";
import { requireProspectPermission } from "@/lib/prospect/prospect-authorization";
import { ProspectCompanyResearchService } from "@/lib/prospect/prospect-company-research-service";
import { createProspectAuditWriter } from "@/lib/prospect/prospect-runtime";
import { prospectActor, prospectApiError } from "../prospect-api";

const requestSchema = z.strictObject({
  companyName: z.string().trim().min(2).max(255),
});

async function auditResearch(input: {
  actorId: string;
  correlationId: string;
  companyName: string;
  outcome: "SUCCESS" | "FAILURE";
  data: Record<string, string | number | string[] | null>;
}) {
  await prisma.$transaction(async (transaction) => {
    await createProspectAuditWriter().append(
      {
        actorId: input.actorId,
        action: "prospect.company-research.search",
        targetType: "ProspectCompanyResearch",
        targetId: input.correlationId,
        outcome: input.outcome,
        correlationId: input.correlationId,
        data: { companyName: input.companyName, ...input.data },
      },
      { transaction },
    );
  });
}

export async function POST(request: Request) {
  const auth = await prospectActor(request);
  if ("response" in auth) return auth.response;
  let companyName = "";
  try {
    requireProspectPermission(auth.actor.permissions, PERMISSIONS.prospectCreate);
    const input = requestSchema.parse(await request.json());
    companyName = input.companyName;
    const data = await new ProspectCompanyResearchService().research(companyName);
    const populatedFields = Object.entries(data.fields)
      .filter(([, value]) => value !== null)
      .map(([field]) => field);
    await auditResearch({
      actorId: auth.actor.id,
      correlationId: auth.correlationId,
      companyName,
      outcome: "SUCCESS",
      data: {
        matchedCompanyName: data.matchedCompanyName,
        matchConfidence: data.matchConfidence,
        populatedFields,
        sourceUrls: data.sources.map((source) => source.url),
        providerVersionId: data.provenance.providerVersionId,
        model: data.provenance.model,
      },
    });
    return NextResponse.json({
      data: { ...data, aiGenerated: true, requiresConfirmation: true },
      meta: { correlationId: auth.correlationId },
    });
  } catch (error) {
    if (companyName) {
      try {
        await auditResearch({
          actorId: auth.actor.id,
          correlationId: auth.correlationId,
          companyName,
          outcome: "FAILURE",
          data: { errorType: error instanceof Error ? error.name : "UnknownError" },
        });
      } catch (auditError) {
        return prospectApiError(auditError, auth.correlationId);
      }
    }
    return prospectApiError(error, auth.correlationId);
  }
}
