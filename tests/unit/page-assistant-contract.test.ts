import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("AI page assistant integration contract", () => {
  it("mounts the global balloon and captures only visible main content", () => {
    const shell = fs.readFileSync(path.join(root, "components/app-shell.tsx"), "utf8");
    const component = fs.readFileSync(path.join(root, "components/ai-chat-balloon.tsx"), "utf8");
    expect(shell).toContain("<AiChatBalloon key={pathname} pageLabel={currentLabel}/>");
    expect(component).toContain('querySelector<HTMLElement>("#main-content")');
    expect(component).not.toContain("document.body.innerText");
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain('event.key === "Escape"');
  });

  it("enforces session, active AI Settings, provider provenance and metadata-only audit on the server", () => {
    const route = fs.readFileSync(path.join(root, "app/api/v1/ai/page-assistant/route.ts"), "utf8");
    const runtime = fs.readFileSync(path.join(root, "lib/ai/page-assistant-runtime.ts"), "utf8");
    const providerRuntime = fs.readFileSync(path.join(root, "lib/ai/provider-configuration-runtime.ts"), "utf8");
    const environmentExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    expect(route).toContain("const session = await getSession()");
    expect(route).toContain("createActiveProviderClient()");
    expect(route).not.toContain("pageAssistantEnabled");
    expect(route).not.toContain("AI_PAGE_ASSISTANT_ENABLED");
    expect(runtime).not.toContain("AI_PAGE_ASSISTANT_ENABLED");
    expect(environmentExample).not.toContain("AI_PAGE_ASSISTANT_ENABLED");
    expect(providerRuntime).toContain("getActiveSecretConfiguration()");
    expect(providerRuntime).toContain("!configuration?.enabled");
    for (const setting of ["configuration.apiUrl", "configuration.model", "configuration.requestTimeoutMs"]) expect(providerRuntime).toContain(setting);
    expect(route).toContain("appendPageAssistantAudit(");
    expect(route).toContain("providerConfigurationVersionId");
    expect(runtime).not.toContain("question: input.question");
    expect(runtime).not.toContain("pageContent: input.pageContent");
    expect(runtime).toContain('action: "ai.page-assistant.ask"');
  });
});
