import { describe, expect, it, vi } from "vitest";

import { MeetingDraftInputError, MeetingDraftService } from "../../lib/ai/meeting-draft-service";
import { MEETING_DRAFT_SCHEMA_VERSION } from "../../lib/ai/meeting-draft-schema";

const validDraft = {
  schemaVersion: MEETING_DRAFT_SCHEMA_VERSION,
  meetingSummary: "Customer requested backup connectivity.",
  keyRequirements: [],
  decisionsAndAgreements: [],
  actionItems: [],
  risksAndConcerns: [],
  suggestedNextAction: null,
  suggestedActivity: null,
};

function setup({ available = true } = {}) {
  const client = {
    createChatCompletion: vi.fn().mockResolvedValue({
      content: JSON.stringify(validDraft),
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    }),
  };
  const operationsGate = {
    execute: vi.fn(async ({ run }) =>
      available ? { available: true, value: (await run()).value } : { available: false, reason: "DISABLED" },
    ),
  };
  const governance = {
    createDraft: vi.fn().mockResolvedValue({ id: "output-1", status: "DRAFT" }),
  };
  const service = new MeetingDraftService({
    client: client as never,
    operationsGate: operationsGate as never,
    governance: governance as never,
    inputPolicy: {
      capability: "meeting-draft",
      allowedFields: [
        "meetingText",
        "customerName",
        "opportunityName",
        "sourceReferences",
      ],
      requiredFields: ["meetingText", "sourceReferences"],
      maxCharacters: 10_000,
    },
  });
  return { service, client, operationsGate, governance };
}

const input = {
  actorId: "user-1",
  jobId: "job-1",
  providerConfigurationVersionId: "provider-version-1",
  providerModel: "configured-model",
  correlationId: "request-1",
  inputMode: "TYPED" as const,
  meetingText: "Customer requested backup connectivity.",
  sourceReferences: [{ type: "Activity", id: "activity-1" }],
};

describe("MeetingDraftService", () => {
  it("generates a bounded text-only draft and records provenance", async () => {
    const { service, client, governance } = setup();

    await expect(service.generate(input)).resolves.toEqual({
      available: true,
      value: { draft: validDraft, outputId: "output-1" },
    });
    const messages = client.createChatCompletion.mock.calls[0][0];
    expect(messages[0].content).toContain("This is a Draft");
    expect(messages[1].content).toContain("Customer requested backup connectivity.");
    expect(governance.createDraft).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        jobId: "job-1",
        providerConfigurationVersionId: "provider-version-1",
        outputSchemaVersion: "meeting-draft.v1",
        inputSourceReferences: [{ type: "Activity", id: "activity-1" }],
      }),
      "request-1",
    );
  });

  it("requires user attestation for a pasted transcript", async () => {
    const { service, client } = setup();

    await expect(
      service.generate({ ...input, inputMode: "PASTED_TRANSCRIPT" }),
    ).rejects.toBeInstanceOf(MeetingDraftInputError);
    expect(client.createChatCompletion).not.toHaveBeenCalled();
  });

  it("allows an attested pasted transcript", async () => {
    const { service } = setup();

    await expect(
      service.generate({
        ...input,
        inputMode: "PASTED_TRANSCRIPT",
        transcriptAttested: true,
      }),
    ).resolves.toMatchObject({ available: true });
  });

  it("preserves manual fallback when the capability is unavailable", async () => {
    const { service, client, governance } = setup({ available: false });

    await expect(service.generate(input)).resolves.toEqual({
      available: false,
      reason: "DISABLED",
    });
    expect(client.createChatCompletion).not.toHaveBeenCalled();
    expect(governance.createDraft).not.toHaveBeenCalled();
  });

  it("rejects malformed provider output without persistence", async () => {
    const { service, client, governance } = setup();
    client.createChatCompletion.mockResolvedValueOnce({ content: "not json" });

    await expect(service.generate(input)).rejects.toBeInstanceOf(
      MeetingDraftInputError,
    );
    expect(governance.createDraft).not.toHaveBeenCalled();
  });
});
