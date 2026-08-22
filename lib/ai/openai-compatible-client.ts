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

const webSearchResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  status: z.string().optional(),
  output: z.array(z.unknown()),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative().optional(),
      output_tokens: z.number().int().nonnegative().optional(),
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

export type WebSearchResponseResult = ChatCompletionResult & {
  sources: Array<{ title: string; url: string }>;
};

type FetchTransport = typeof fetch;

function completionUrl(apiUrl: string) {
  return `${apiUrl.replace(/\/+$/, "")}/chat/completions`;
}

function responsesUrl(apiUrl: string) {
  return `${apiUrl.replace(/\/+$/, "")}/responses`;
}

function collectWebSearchOutput(output: unknown[]) {
  let content = "";
  const sources = new Map<string, string>();
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type === "message" && Array.isArray(record.content)) {
      for (const part of record.content) {
        if (!part || typeof part !== "object") continue;
        const value = part as Record<string, unknown>;
        if (value.type === "output_text" && typeof value.text === "string") {
          content += value.text;
        }
        if (Array.isArray(value.annotations)) {
          for (const annotation of value.annotations) {
            if (!annotation || typeof annotation !== "object") continue;
            const citation = annotation as Record<string, unknown>;
            if (citation.type === "url_citation" && typeof citation.url === "string") {
              sources.set(
                citation.url,
                typeof citation.title === "string" ? citation.title : citation.url,
              );
            }
          }
        }
      }
    }
    if (record.type === "web_search_call" && record.action && typeof record.action === "object") {
      const action = record.action as Record<string, unknown>;
      if (!Array.isArray(action.sources)) continue;
      for (const source of action.sources) {
        if (!source || typeof source !== "object") continue;
        const value = source as Record<string, unknown>;
        if (typeof value.url !== "string") continue;
        sources.set(value.url, typeof value.title === "string" ? value.title : value.url);
      }
    }
  }
  return { content, sources: [...sources].map(([url, title]) => ({ title, url })) };
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

  async createWebSearchResponse(input: {
    instructions: string;
    query: string;
    outputName: string;
    outputSchema: Record<string, unknown>;
  }): Promise<WebSearchResponseResult> {
    let response: Response;
    try {
      response = await this.transport(responsesUrl(this.configuration.apiUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.configuration.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.configuration.model,
          instructions: input.instructions,
          input: input.query,
          tools: [{ type: "web_search" }],
          tool_choice: "required",
          include: ["web_search_call.action.sources"],
          max_tool_calls: 4,
          text: {
            format: {
              type: "json_schema",
              name: input.outputName,
              strict: true,
              schema: input.outputSchema,
            },
          },
          store: false,
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
    if (!response.ok) throw new OpenAiCompatibleProviderError("UNAVAILABLE");

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OpenAiCompatibleProviderError("INVALID_RESPONSE");
    }
    const parsed = webSearchResponseSchema.safeParse(payload);
    if (!parsed.success || parsed.data.status === "failed") {
      throw new OpenAiCompatibleProviderError("INVALID_RESPONSE");
    }
    const output = collectWebSearchOutput(parsed.data.output);
    if (!output.content) throw new OpenAiCompatibleProviderError("INVALID_RESPONSE");
    return {
      ...output,
      providerRequestId: parsed.data.id,
      providerModel: parsed.data.model,
      usage: parsed.data.usage
        ? {
            inputTokens: parsed.data.usage.input_tokens,
            outputTokens: parsed.data.usage.output_tokens,
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
