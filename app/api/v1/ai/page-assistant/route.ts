import { NextResponse } from "next/server";
import { z } from "zod";

import { workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../workflow-api-response";
import { getSession } from "@/lib/auth";
import { safeErrorIdentity } from "@/lib/api/safe-error-identity";
import { createActiveProviderClient } from "@/lib/ai/provider-configuration-runtime";
import { PAGE_ASSISTANT_PROMPT_VERSION, PageAssistantService } from "@/lib/ai/page-assistant-service";
import { appendPageAssistantAudit } from "@/lib/ai/page-assistant-runtime";

const inputSchema = z.strictObject({
  question: z.string().trim().min(1).max(1_000),
  pathname: z.string().trim().min(1).max(500).refine((value) => value.startsWith("/") && !value.startsWith("//")),
  pageTitle: z.string().trim().min(1).max(300),
  pageContent: z.string().trim().min(1).max(16_000),
  conversation: z.array(z.strictObject({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(3_000),
  })).max(8).default([]),
});

export async function POST(request: Request) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  let input: z.infer<typeof inputSchema> | undefined;
  try {
    input = inputSchema.parse(await request.json());
    const provider = await createActiveProviderClient();
    const result = await new PageAssistantService(provider.client).answer(input);
    const providerModel = result.providerModel ?? provider.model;
    await appendPageAssistantAudit({
      actorId: session.id,
      correlationId,
      pathname: input.pathname,
      questionCharacters: input.question.length,
      pageContextCharacters: input.pageContent.length,
      conversationTurns: input.conversation.length,
      outcome: "SUCCESS",
      providerConfigurationVersionId: provider.configurationVersionId,
      providerModel,
      usage: result.usage,
    });
    return NextResponse.json({
      data: { answer: result.answer, sources: result.sources },
      meta: {
        correlationId,
        provenance: {
          providerConfigurationVersionId: provider.configurationVersionId,
          model: providerModel,
          promptTemplateVersion: PAGE_ASSISTANT_PROMPT_VERSION,
          inputSourceReferences: [{ type: "VISIBLE_PAGE", id: input.pathname }, ...result.sources.map((source) => ({ type: "HELP_ARTICLE", id: source.slug }))],
        },
      },
    });
  } catch (error) {
    try {
      await appendPageAssistantAudit({
        actorId: session.id,
        correlationId,
        pathname: input?.pathname ?? "/unknown",
        questionCharacters: input?.question.length ?? 0,
        pageContextCharacters: input?.pageContent.length ?? 0,
        conversationTurns: input?.conversation.length ?? 0,
        outcome: "FAILURE",
        error: safeErrorIdentity(error),
      });
    } catch {
      // The original sanitized API failure remains the response when failure-audit persistence is unavailable.
    }
    return workflowApiError(error, correlationId);
  }
}
