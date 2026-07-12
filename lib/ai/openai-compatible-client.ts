import { z } from "zod";

const chatCompletionResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export type OpenAiCompatibleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenAiCompatibleClientConfiguration = {
  apiUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export type ProviderErrorCode =
  | "AUTHENTICATION"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE";

const PROVIDER_ERROR_MESSAGES: Record<ProviderErrorCode, string> = {
  AUTHENTICATION: "AI provider authentication failed.",
  TIMEOUT: "AI provider request timed out.",
  UNAVAILABLE: "AI provider is unavailable.",
  INVALID_RESPONSE: "AI provider returned an invalid response.",
};

export class OpenAiCompatibleProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super(PROVIDER_ERROR_MESSAGES[code]);
    this.name = "OpenAiCompatibleProviderError";
    this.code = code;
  }
}

export type ChatCompletionResult = {
  content: string;
  providerRequestId?: string;
  providerModel?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

type FetchTransport = typeof fetch;

function completionUrl(apiUrl: string) {
  return `${apiUrl.replace(/\/+$/, "")}/chat/completions`;
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException
      ? error.name === "AbortError" || error.name === "TimeoutError"
      : error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export class OpenAiCompatibleClient {
  private readonly configuration: OpenAiCompatibleClientConfiguration;
  private readonly transport: FetchTransport;

  constructor(
    configuration: OpenAiCompatibleClientConfiguration,
    transport: FetchTransport = fetch,
  ) {
    this.configuration = configuration;
    this.transport = transport;
  }

  async createChatCompletion(
    messages: OpenAiCompatibleMessage[],
  ): Promise<ChatCompletionResult> {
    let response: Response;
    try {
      response = await this.transport(completionUrl(this.configuration.apiUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.configuration.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.configuration.model,
          messages,
          stream: false,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(this.configuration.timeoutMs),
      });
    } catch (error) {
      throw new OpenAiCompatibleProviderError(
        isAbortError(error) ? "TIMEOUT" : "UNAVAILABLE",
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new OpenAiCompatibleProviderError("AUTHENTICATION");
    }
    if (!response.ok) {
      throw new OpenAiCompatibleProviderError("UNAVAILABLE");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OpenAiCompatibleProviderError("INVALID_RESPONSE");
    }
    const parsed = chatCompletionResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new OpenAiCompatibleProviderError("INVALID_RESPONSE");
    }

    return {
      content: parsed.data.choices[0].message.content,
      providerRequestId: parsed.data.id,
      providerModel: parsed.data.model,
      usage: parsed.data.usage
        ? {
            inputTokens: parsed.data.usage.prompt_tokens,
            outputTokens: parsed.data.usage.completion_tokens,
            totalTokens: parsed.data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async testConnection(): Promise<
    | { ok: true; message: string }
    | { ok: false; code: ProviderErrorCode; message: string }
  > {
    try {
      await this.createChatCompletion([
        {
          role: "user",
          content: "Reply with exactly OK.",
        },
      ]);
      return { ok: true, message: "AI provider connection succeeded." };
    } catch (error) {
      const providerError =
        error instanceof OpenAiCompatibleProviderError
          ? error
          : new OpenAiCompatibleProviderError("UNAVAILABLE");
      return {
        ok: false,
        code: providerError.code,
        message: providerError.message,
      };
    }
  }
}
