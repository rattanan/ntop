import {
  buildIsolatedPrompt,
  validateAiInput,
  type AiCapabilityInputPolicy,
} from "./safety-policy";
import {
  meetingDraftSystemInstruction,
  parseMeetingDraftOutput,
} from "./meeting-draft-schema";
import type { OpenAiCompatibleClient } from "./openai-compatible-client";
import type { AiOperationsGate } from "./operations-gate";
import type { AiGovernanceService } from "./governance-service";

export type MeetingDraftInputMode = "TYPED" | "PASTED_TRANSCRIPT";

export class MeetingDraftInputError extends Error {
  constructor() {
    super("Meeting Draft input is not permitted.");
    this.name = "MeetingDraftInputError";
  }
}

type MeetingDraftInput = {
  actorId: string;
  jobId: string;
  providerConfigurationVersionId: string;
  providerModel: string;
  correlationId: string;
  inputMode: MeetingDraftInputMode;
  transcriptAttested?: boolean;
  meetingText: string;
  customerName?: string;
  opportunityName?: string;
  sourceReferences: Array<{ type: string; id: string }>;
};

type MeetingDraftServiceDependencies<TTransaction> = {
  client: OpenAiCompatibleClient;
  operationsGate: AiOperationsGate;
  governance: AiGovernanceService<TTransaction>;
  inputPolicy: AiCapabilityInputPolicy;
};

export class MeetingDraftService<TTransaction> {
  private readonly client: OpenAiCompatibleClient;
  private readonly operationsGate: AiOperationsGate;
  private readonly governance: AiGovernanceService<TTransaction>;
  private readonly inputPolicy: AiCapabilityInputPolicy;

  constructor({
    client,
    operationsGate,
    governance,
    inputPolicy,
  }: MeetingDraftServiceDependencies<TTransaction>) {
    this.client = client;
    this.operationsGate = operationsGate;
    this.governance = governance;
    this.inputPolicy = inputPolicy;
  }

  async generate(input: MeetingDraftInput) {
    if (
      input.inputMode === "PASTED_TRANSCRIPT" &&
      input.transcriptAttested !== true
    ) {
      throw new MeetingDraftInputError();
    }

    const validatedInput = validateAiInput({
      capability: this.inputPolicy.capability,
      policy: this.inputPolicy,
      input: {
        meetingText: input.meetingText,
        ...(input.customerName ? { customerName: input.customerName } : {}),
        ...(input.opportunityName
          ? { opportunityName: input.opportunityName }
          : {}),
        sourceReferences: input.sourceReferences,
      },
      authorizedFields: new Set(this.inputPolicy.allowedFields),
    });
    const messages = buildIsolatedPrompt({
      systemInstruction: meetingDraftSystemInstruction(),
      validatedInput,
    });

    return this.operationsGate.execute({
      capability: this.inputPolicy.capability,
      run: async () => {
        const completion = await this.client.createChatCompletion(messages);
        let payload: unknown;
        try {
          payload = JSON.parse(completion.content);
        } catch {
          throw new MeetingDraftInputError();
        }
        const draft = parseMeetingDraftOutput(payload);
        const output = await this.governance.createDraft(
          input.actorId,
          {
            jobId: input.jobId,
            providerConfigurationVersionId: input.providerConfigurationVersionId,
            capability: this.inputPolicy.capability,
            outputSchemaVersion: draft.schemaVersion,
            providerModel: input.providerModel,
            promptTemplateVersion: "meeting-draft.prompt.v1",
            inputSourceReferences: input.sourceReferences,
            validatedOutput: draft,
            safetyResult: "PASSED",
            confidenceBand: "UNKNOWN",
            latencyMs: undefined,
            inputTokens: completion.usage?.inputTokens,
            outputTokens: completion.usage?.outputTokens,
            totalTokens: completion.usage?.totalTokens,
          },
          input.correlationId,
        );
        return {
          value: { draft, outputId: output.id },
          usage: completion.usage,
        };
      },
    });
  }
}
