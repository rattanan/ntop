import { describe, expect, it } from "vitest";

import { DEFAULT_PROPOSAL_SECTION_DEFINITIONS, PROPOSAL_AI_SCHEMA_VERSION, defaultProposalSections, parseProposalAiOutput, proposalCreateSchema, proposalEditSchema } from "../../lib/proposal/contracts";

describe("Proposal contracts", () => {
  it("provides every required editable section exactly once", () => {
    const sections = defaultProposalSections();
    expect(sections).toHaveLength(DEFAULT_PROPOSAL_SECTION_DEFINITIONS.length);
    expect(new Set(sections.map((section) => section.sectionCode)).size).toBe(sections.length);
    expect(parseProposalAiOutput({ schemaVersion: PROPOSAL_AI_SCHEMA_VERSION, sections })).toEqual({ schemaVersion: PROPOSAL_AI_SCHEMA_VERSION, sections });
  });

  it("rejects incomplete AI output and timezone-less expiry", () => {
    expect(() => parseProposalAiOutput({ schemaVersion: PROPOSAL_AI_SCHEMA_VERSION, sections: defaultProposalSections().slice(1) })).toThrow();
    expect(() => proposalCreateSchema.parse({ opportunityId: "opp", name: "Proposal", tags: [], expireDate: "2026-08-01T12:00:00", sections: defaultProposalSections() })).toThrow();
  });

  it("accepts an optional configured Status in backward-compatible edits", () => {
    const base = { expectedVersion: 1, name: "Proposal", tags: [], sections: defaultProposalSections() };
    expect(proposalEditSchema.parse(base).statusCode).toBeUndefined();
    expect(proposalEditSchema.parse({ ...base, statusCode: "ACCEPTED" }).statusCode).toBe("ACCEPTED");
  });
});
