import { describe,expect,it } from "vitest";
import { calculateContractFinancials,ContractFinancialError } from "../../lib/contract/contract-financials";
const item={productId:"p1",productCode:"NET",serviceName:"Internet",description:null,quantity:"2.0000",unit:"circuit",monthlyCharge:"1000.1250",oneTimeCharge:"500.0000",discountAmount:"100.0000",durationMonths:12,installationRequired:true,solutionInstallationSiteId:null,serviceLocation:null,bandwidth:"1 Gbps",sla:"99.9%",supportLevel:"24x7",sortOrder:0};
describe("contract financials",()=>{
  it("calculates recurring, one-time, tax and TCV with Decimal precision",()=>{const result=calculateContractFinancials([item],"7.0000");expect(result.monthlyRecurringRevenue).toBe("2000.2500");expect(result.oneTimeRevenue).toBe("1000.0000");expect(result.totalContractValue).toBe("24903.0000");expect(result.taxAmount).toBe("1743.2100");expect(result.totalWithTax).toBe("26646.2100");expect(result.items[0].lineContractValue).toBe("24903.0000");});
  it("rejects a discount larger than the line value",()=>{expect(()=>calculateContractFinancials([{...item,discountAmount:"999999.0000"}],"7")).toThrow(ContractFinancialError);});
  it("rejects an out-of-range tax rate",()=>{expect(()=>calculateContractFinancials([item],"100.0001")).toThrow(ContractFinancialError);});
});
