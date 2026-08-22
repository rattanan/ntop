import { describe, expect, it, vi } from "vitest";

import { OpenAiCompatibleProviderError } from "../../lib/ai/openai-compatible-client";
import {
  ProspectCompanyResearchService,
  type ProspectCompanyResearchProvider,
} from "../../lib/prospect/prospect-company-research-service";

const fields = {
  companyNameEnglish: "Example Public Company Limited",
  taxId: "0105555000001",
  branchNumber: null,
  customerType: "นิติบุคคล",
  organizationType: "บริษัทมหาชนจำกัด",
  subIndustry: "โทรคมนาคม",
  companySize: "ขนาดใหญ่",
  numberOfEmployees: 1000,
  website: "https://example.com/",
  address: "กรุงเทพมหานคร",
  subDistrict: null,
  district: null,
  province: "กรุงเทพมหานคร",
  postalCode: "10110",
  region: "ภาคกลาง",
  currentTelecomProvider: null,
  currentInternetProvider: null,
  currentCloudProvider: null,
  currentSecurityProvider: null,
};

function provider(overrides: Partial<Awaited<ReturnType<ProspectCompanyResearchProvider["research"]>>> = {}) {
  return {
    research: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        matchedCompanyName: "บริษัท ตัวอย่าง จำกัด (มหาชน)",
        matchConfidence: 92,
        fields,
        warnings: [],
      }),
      sources: [
        { title: "ทะเบียน", url: "https://registry.example/company" },
        { title: "Duplicate", url: "https://registry.example/company" },
        { title: "Unsafe", url: "javascript:alert(1)" },
      ],
      providerVersionId: "provider-v1",
      model: "configured-model",
      providerRequestId: "response-1",
      ...overrides,
    }),
  } satisfies ProspectCompanyResearchProvider;
}

describe("ProspectCompanyResearchService", () => {
  it("strictly parses public company fields and filters source URLs", async () => {
    const dependency = provider();
    const result = await new ProspectCompanyResearchService(dependency).research(
      "  บริษัท ตัวอย่าง  ",
    );

    expect(dependency.research).toHaveBeenCalledWith("บริษัท ตัวอย่าง");
    expect(result.fields.taxId).toBe("0105555000001");
    expect(result.sources).toEqual([
      { title: "ทะเบียน", url: "https://registry.example/company" },
    ]);
    expect(result.provenance).toMatchObject({
      providerVersionId: "provider-v1",
      model: "configured-model",
      providerRequestId: "response-1",
    });
  });

  it("rejects output without a valid web source", async () => {
    const dependency = provider({ sources: [{ title: "Unsafe", url: "file:///secret" }] });
    await expect(
      new ProspectCompanyResearchService(dependency).research("บริษัท ตัวอย่าง"),
    ).rejects.toEqual(new OpenAiCompatibleProviderError("INVALID_RESPONSE"));
  });

  it("rejects malformed or extra AI fields", async () => {
    const dependency = provider({
      content: JSON.stringify({
        matchedCompanyName: "บริษัท ตัวอย่าง จำกัด",
        matchConfidence: 90,
        fields: { ...fields, inventedBudget: "1000000" },
        warnings: [],
      }),
    });
    await expect(
      new ProspectCompanyResearchService(dependency).research("บริษัท ตัวอย่าง"),
    ).rejects.toEqual(new OpenAiCompatibleProviderError("INVALID_RESPONSE"));
  });
});
