import { describe, expect, it, vi } from "vitest";

import {
  OpenAiCompatibleClient,
  OpenAiCompatibleProviderError,
} from "../../lib/ai/openai-compatible-client";

const configuration = {
  apiUrl: "http://provider.internal/v1/",
  apiKey: "provider-key-must-not-leak",
  model: "configured-model",
  timeoutMs: 1_000,
};

describe("OpenAiCompatibleClient", () => {
  it("calls only the configured Chat Completions endpoint", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: "request-1",
        model: "configured-model",
        choices: [{ message: { content: "OK" } }],
        usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
      }),
    );
    const client = new OpenAiCompatibleClient(configuration, transport);

    const result = await client.createChatCompletion([
      { role: "user", content: "test" },
    ]);

    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0][0]).toBe(
      "http://provider.internal/v1/chat/completions",
    );
    expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toEqual({
      model: "configured-model",
      messages: [{ role: "user", content: "test" }],
      stream: false,
    });
    expect(result).toEqual({
      content: "OK",
      providerRequestId: "request-1",
      providerModel: "configured-model",
      usage: { inputTokens: 4, outputTokens: 1, totalTokens: 5 },
    });
  });

  it("sends the key only in Bearer authorization", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ choices: [{ message: { content: "OK" } }] }),
    );
    const client = new OpenAiCompatibleClient(configuration, transport);

    await client.testConnection();

    const request = transport.mock.calls[0];
    expect(request[1]?.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer provider-key-must-not-leak",
      }),
    );
    expect(String(request[1]?.body)).not.toContain(
      "provider-key-must-not-leak",
    );
  });

  it("uses the Responses API with required web search and returns cited sources", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: "response-1",
        model: "configured-model",
        status: "completed",
        output: [
          {
            type: "web_search_call",
            action: {
              sources: [
                { title: "Official registry", url: "https://registry.example/company" },
              ],
            },
          },
          {
            type: "message",
            content: [{ type: "output_text", text: '{"ok":true}', annotations: [] }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      }),
    );
    const client = new OpenAiCompatibleClient(configuration, transport);

    const result = await client.createWebSearchResponse({
      instructions: "Use public facts only.",
      query: "Example Company",
      outputName: "company",
      outputSchema: { type: "object" },
    });

    expect(transport.mock.calls[0][0]).toBe("http://provider.internal/v1/responses");
    const body = JSON.parse(String(transport.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      model: "configured-model",
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "company",
          strict: true,
          schema: { type: "object" },
        },
      },
    });
    expect(result).toEqual({
      content: '{"ok":true}',
      sources: [
        { title: "Official registry", url: "https://registry.example/company" },
      ],
      providerRequestId: "response-1",
      providerModel: "configured-model",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
  });

  it.each([
    [401, "AUTHENTICATION", "AI provider authentication failed."],
    [403, "AUTHENTICATION", "AI provider authentication failed."],
    [429, "UNAVAILABLE", "AI provider is unavailable."],
    [500, "UNAVAILABLE", "AI provider is unavailable."],
  ] as const)(
    "sanitizes HTTP %s without reading the provider error body",
    async (status, code, message) => {
      const response = new Response("raw provider secret diagnostics", {
        status,
      });
      const text = vi.spyOn(response, "text");
      const transport = vi.fn<typeof fetch>().mockResolvedValue(response);
      const client = new OpenAiCompatibleClient(configuration, transport);

      await expect(client.testConnection()).resolves.toEqual({
        ok: false,
        code,
        message,
      });
      expect(text).not.toHaveBeenCalled();
    },
  );

  it("returns a bounded timeout result", async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("secret timeout details", "TimeoutError"));
          });
        }),
    );
    const client = new OpenAiCompatibleClient(
      { ...configuration, timeoutMs: 5 },
      transport,
    );

    await expect(client.testConnection()).resolves.toEqual({
      ok: false,
      code: "TIMEOUT",
      message: "AI provider request timed out.",
    });
  });

  it("rejects malformed success responses without returning raw content", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ private_debug: "must-not-leak" }));
    const client = new OpenAiCompatibleClient(configuration, transport);

    await expect(
      client.createChatCompletion([{ role: "user", content: "test" }]),
    ).rejects.toEqual(
      new OpenAiCompatibleProviderError("INVALID_RESPONSE"),
    );
  });
});
