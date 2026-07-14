import { describe, expect, it, vi } from "vitest";

import {
  DEAL_RISK_EXPLANATION_CAPABILITY,
  DealRiskExplanationInputError,
  DealRiskExplanationService,
} from "../../lib/ai/deal-risk-explanation-service";
import { MEETING_DRAFT_SCHEMA_VERSION } from "../../lib/ai/meeting-draft-schema";

const output = {
  schemaVersion: MEETING_DRAFT_SCHEMA_VERSION,
  meetingSummary: "The configured follow-up threshold was exceeded.",
  keyRequirements: [],
  decisionsAndAgreements: [],
  actionItems: [],
  risksAndConcerns: ["The opportunity may stall."],
  suggestedNextAction: {
    description: "Contact the customer and confirm the next milestone.",
    suggestedDueAt: "2026-07-14T10:00:00+07:00",
  },
  suggestedActivity: null,
};

const input = {
  riskType: "FOLLOW_UP_AGE",
  ruleCode: "follow-up-age",
  ruleVersion: 2,
  thresholdSnapshot: { metric: "LAST_ACTIVITY_AGE_DAYS", threshold: 7 },
  triggeringFacts: { observedValue: 11 },
  severitySnapshot: { band: "HIGH" },
};

function setup({ available = true } = {}) {
  const client = {
    createChatCompletion: vi.fn().mockResolvedValue({
      content: JSON.stringify(output),
    }),
  };
  const gate = {
    execute: vi.fn(async ({ capability, run }) => {
      expect(capability).toBe(DEAL_RISK_EXPLANATION_CAPABILITY);
      return available
        ? { available: true, value: (await run()).value }
        : { available: false, reason: "DISABLED" };
    }),
  };
  return {
    service: new DealRiskExplanationService(client as never, gate as never),
    client,
  };
}

describe("DealRiskExplanationService", () => {
  it("grounds an optional explanation in deterministic snapshots", async () => {
    const { service, client } = setup();

    await expect(service.generate(input)).resolves.toEqual({
      available: true,
      value: output,
    });
    const messages = client.createChatCompletion.mock.calls[0][0];
    expect(messages[0].content).toContain("rule remains the source of truth");
    expect(messages[1].content).toContain("follow-up-age");
    expect(messages[1].content).toContain("observedValue");
  });

  it("does not call the provider when the capability is disabled", async () => {
    const { service, client } = setup({ available: false });

    await expect(service.generate(input)).resolves.toEqual({
      available: false,
      reason: "DISABLED",
    });
    expect(client.createChatCompletion).not.toHaveBeenCalled();
  });

  it("rejects extra autonomous fields from provider output", async () => {
    const { service, client } = setup();
    client.createChatCompletion.mockResolvedValueOnce({
      content: JSON.stringify({ ...output, opportunityStage: "WON" }),
    });

    await expect(service.generate(input)).rejects.toBeInstanceOf(
      DealRiskExplanationInputError,
    );
  });

  it("rejects malformed deterministic input before provider access", async () => {
    const { service, client } = setup();

    await expect(
      service.generate({ ...input, ruleVersion: 0 }),
    ).rejects.toBeInstanceOf(DealRiskExplanationInputError);
    expect(client.createChatCompletion).not.toHaveBeenCalled();
  });
});
