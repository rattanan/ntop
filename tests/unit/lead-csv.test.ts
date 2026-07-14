import { describe,expect,it } from "vitest";
import { LeadCsvError,parseLeadCsv } from "../../lib/lead/csv";
describe("Lead CSV import",()=>{it("parses quoted commas and CRLF",()=>{expect(parseLeadCsv('company,contactName,source,recommendedProducts\r\n"บริษัท, ตัวอย่าง",สมชาย,WEBSITE,Cloud\r\n')).toEqual([{company:"บริษัท, ตัวอย่าง",contactName:"สมชาย",source:"WEBSITE",recommendedProducts:"Cloud"}]);});it("reports the invalid row",()=>{expect(()=>parseLeadCsv("company,contactName,source\nAcme,,WEBSITE")).toThrow(LeadCsvError);});});
