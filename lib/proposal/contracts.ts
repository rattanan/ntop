import { z } from "zod";

export const PROPOSAL_AI_CAPABILITY = "proposal-generation";
export const PROPOSAL_AI_SCHEMA_VERSION = "proposal.v1";
export const PROPOSAL_AI_PROMPT_VERSION = "proposal-generation.prompt.v1";

export const DEFAULT_PROPOSAL_SECTION_DEFINITIONS = [
  ["EXECUTIVE_SUMMARY", "Executive Summary"],
  ["CUSTOMER_CHALLENGES", "Customer Challenges"],
  ["BUSINESS_OBJECTIVES", "Business Objectives"],
  ["PROPOSED_SOLUTION", "Proposed Solution"],
  ["SOLUTION_BENEFITS", "Solution Benefits"],
  ["IMPLEMENTATION_PLAN", "Implementation Plan"],
  ["TIMELINE", "Timeline"],
  ["PROJECT_SCOPE", "Project Scope"],
  ["DELIVERABLES", "Deliverables"],
  ["ASSUMPTIONS", "Assumptions"],
  ["SUPPORT", "Support"],
  ["PRICING_SUMMARY", "Pricing Summary"],
  ["TERMS_AND_CONDITIONS", "Terms & Conditions"],
  ["NEXT_STEPS", "Next Steps"],
] as const;

export const proposalSectionSchema = z.strictObject({
  sectionCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,99}$/),
  title: z.string().trim().min(1).max(255),
  sortOrder: z.number().int().min(0).max(1000),
  contentType: z.enum(["RICH_TEXT", "TABLE", "IMAGE_REFERENCE"]).default("RICH_TEXT"),
  content: z.string().max(100_000),
  structuredData: z.record(z.string(), z.unknown()).nullable().optional(),
});

const tagsSchema = z.array(z.string().trim().min(1).max(50)).max(20).default([]);

export const proposalCreateSchema = z.strictObject({
  opportunityId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(255),
  description: z.string().max(10_000).nullable().optional(),
  expireDate: z.string().datetime({ offset: true }).nullable().optional(),
  tags: tagsSchema,
  templateId: z.string().trim().min(1).nullable().optional(),
  sections: z.array(proposalSectionSchema).min(1).max(50).optional(),
});

export const proposalEditSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(1).max(255),
  description: z.string().max(10_000).nullable().optional(),
  expireDate: z.string().datetime({ offset: true }).nullable().optional(),
  tags: tagsSchema,
  sections: z.array(proposalSectionSchema).min(1).max(50),
});

export const proposalRestoreSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  sourceVersionNumber: z.number().int().positive(),
});

export const proposalTransitionSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  toStatusCode: z.string().trim().min(1).max(32),
  comment: z.string().trim().min(1).max(1000),
});

export const proposalAiOutputSchema = z.strictObject({
  schemaVersion: z.literal(PROPOSAL_AI_SCHEMA_VERSION),
  sections: z.array(proposalSectionSchema).length(DEFAULT_PROPOSAL_SECTION_DEFINITIONS.length),
});

export type ProposalSectionInput = z.infer<typeof proposalSectionSchema>;
export type ProposalCreateInput = z.infer<typeof proposalCreateSchema>;
export type ProposalEditInput = z.infer<typeof proposalEditSchema>;

export function defaultProposalSections(): ProposalSectionInput[] {
  return DEFAULT_PROPOSAL_SECTION_DEFINITIONS.map(([sectionCode, title], sortOrder) => ({
    sectionCode,
    title,
    sortOrder,
    contentType: "RICH_TEXT",
    content: "",
    structuredData: null,
  }));
}

export function parseProposalAiOutput(value: unknown) {
  const parsed = proposalAiOutputSchema.parse(value);
  const expected = new Set(DEFAULT_PROPOSAL_SECTION_DEFINITIONS.map(([code]) => code));
  const actual = new Set(parsed.sections.map((section) => section.sectionCode));
  if (actual.size !== expected.size || [...expected].some((code) => !actual.has(code))) {
    throw new z.ZodError([]);
  }
  return parsed;
}
