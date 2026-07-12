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
