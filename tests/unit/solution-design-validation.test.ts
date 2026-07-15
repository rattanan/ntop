import { describe,expect,it } from "vitest";
import { contactSchema,gpsSchema,surveyRequestSchema,surveyResultSchema } from "../../lib/solution-design/validation";

describe("Solution Design survey validation",()=>{
  it("accepts boundary GPS values and rejects out-of-range coordinates",()=>{
    expect(gpsSchema.safeParse({latitude:"-90",longitude:"180"}).success).toBe(true);
    expect(gpsSchema.safeParse({latitude:"90.0000001",longitude:"0"}).success).toBe(false);
    expect(gpsSchema.safeParse({latitude:"0",longitude:"-180.0000001"}).success).toBe(false);
  });
  it("requires a usable phone and validates optional email",()=>{
    expect(contactSchema.safeParse({fullName:"Synthetic Contact",phone:"081-234-5678",primaryContact:true}).success).toBe(true);
    expect(contactSchema.safeParse({fullName:"Synthetic Contact",phone:"123",email:"bad"}).success).toBe(false);
  });
  it("blocks an incomplete survey request and inverted preferred period",()=>{
    const base={solutionDesignId:"s",installationSiteId:"site",requestedServiceId:"service",surveyReason:"new last-mile installation",priority:"NORMAL",preferredSurveyDateFrom:"2026-07-20T00:00:00Z",preferredSurveyDateTo:"2026-07-19T00:00:00Z",contacts:[]};
    const parsed=surveyRequestSchema.safeParse(base);
    expect(parsed.success).toBe(false);
    if(!parsed.success)expect(parsed.error.issues.map(i=>i.path.join("."))).toEqual(expect.arrayContaining(["contacts","preferredSurveyDateTo"]));
  });
  it("supports optional structured findings while requiring feasibility and summary",()=>{
    const parsed=surveyResultSchema.parse({surveyDate:"2026-07-20T01:00:00Z",feasibilityStatus:"FEASIBLE_WITH_CONDITIONS",technicalSummary:"Feasible after customer provides rack power"});
    expect(parsed.measurements).toEqual([]);expect(parsed.customerActions).toEqual([]);expect(parsed.estimatedItems).toEqual([]);
  });
});
