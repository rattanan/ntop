import { ActivityType, LeadSource, LeadStatus, LeadTemperature, PrismaClient, ProspectHeatLevel, ProspectSource, ProspectStatus, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const demoMode = process.env.SEED_DEMO_DATA === "1";
  let admin;
  if (email && password) {
    admin = await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN },
      create: { email, name: "ผู้ดูแลระบบ NTOP", passwordHash: await hash(password, 12), role: Role.ADMIN },
    });
  } else if (demoMode) {
    admin = await prisma.user.findFirst({ where: { role: Role.ADMIN, active: true }, orderBy: { createdAt: "asc" } });
    if (!admin) throw new Error("No active ADMIN exists; set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.");
  } else {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding.");
  }
  if (!demoMode) return;
  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) throw new Error("Set SEED_DEMO_PASSWORD to 12+ characters when SEED_DEMO_DATA=1.");
  const passwordHash = await hash(demoPassword, 12);
  const unit = await prisma.organizationUnit.upsert({ where: { code: "DEMO-ENTERPRISE-SALES" }, update: { active: true }, create: { code: "DEMO-ENTERPRISE-SALES", name: "ทีมขายองค์กร (ข้อมูลทดสอบ)" } });
  const people = [
    ["sales1@example.test", "พนักงานขายทดสอบ 1", "KAM", "SELF"],
    ["sales2@example.test", "พนักงานขายทดสอบ 2", "KAM", "SELF"],
    ["sales3@example.test", "พนักงานขายทดสอบ 3", "KAM", "SELF"],
    ["manager@example.test", "ผู้จัดการฝ่ายขายทดสอบ", "TEAM_MANAGER", "TEAM"],
    ["marketing@example.test", "การตลาดทดสอบ", "MARKETING", "ORG_UNIT"],
    ["architect@example.test", "Solution Architect ทดสอบ", "SOLUTION_ARCHITECT", "ORG_UNIT"],
  ] as const;
  const users = [];
  for (const [userEmail, name, roleCode, scopeCode] of people) {
    const user = await prisma.user.upsert({ where: { email: userEmail }, update: { name, active: true }, create: { email: userEmail, name, passwordHash, role: Role.SALES } });
    users.push(user);
    const existing = await prisma.userRoleAssignment.findFirst({ where: { userId: user.id, roleCode, scopeCode, organizationUnitId: unit.id, active: true } });
    if (!existing) await prisma.userRoleAssignment.create({ data: { userId: user.id, roleCode, scopeCode, organizationUnitId: unit.id, effectiveFrom: new Date("2026-01-01T00:00:00Z") } });
  }
  const adminAssignment = await prisma.userRoleAssignment.findFirst({ where: { userId: admin.id, roleCode: "ADMIN", scopeCode: "ENTERPRISE", active: true } });
  if (!adminAssignment) await prisma.userRoleAssignment.create({ data: { userId: admin.id, roleCode: "ADMIN", scopeCode: "ENTERPRISE", effectiveFrom: new Date("2026-01-01T00:00:00Z") } });
  const prospectPermissions = ["prospect.view","prospect.create","prospect.update","prospect.assign","prospect.convert","prospect.merge","prospect.archive","prospect.import","prospect.export","prospect.view_all"];
  const permissionMatrix:Record<string,string[]>={ADMIN:[...prospectPermissions,"prospect.soft_delete","prospect.view_deleted","prospect.restore","lead.archive","customer.lifecycle.manage"],SYSTEM_ADMIN:["prospect.view_deleted","prospect.restore","prospect.permanent_delete"],SALES_DIRECTOR:prospectPermissions,TEAM_MANAGER:[...prospectPermissions.filter(code=>code!=="prospect.view_all"),"prospect.soft_delete"],KAM:["prospect.view","prospect.create","prospect.update","prospect.convert","prospect.export"],MARKETING:["prospect.view","prospect.create","prospect.import","prospect.export"]};
  permissionMatrix.ADMIN.push("opportunity.probability.override");
  permissionMatrix.ADMIN.push("forecast.target.manage", "forecast.calendar.manage", "forecast.snapshot.create");
  permissionMatrix.SALES_DIRECTOR.push("opportunity.probability.override");
  permissionMatrix.SALES_DIRECTOR.push("forecast.target.manage", "forecast.snapshot.create");
  permissionMatrix.TEAM_MANAGER.push("opportunity.probability.override");
  permissionMatrix.TEAM_MANAGER.push("forecast.target.manage", "forecast.snapshot.create");
  for(const [roleCode,codes] of Object.entries(permissionMatrix))for(const permissionCode of codes)await prisma.rolePermissionGrant.upsert({where:{roleCode_permissionCode:{roleCode,permissionCode}},update:{},create:{roleCode,permissionCode}});
  const industries=await Promise.all([["GOV","ภาครัฐ"],["FIN","การเงินและธนาคาร"],["MFG","การผลิต"],["RET","ค้าปลีก"],["HEALTH","สาธารณสุข"]].map(([code,name])=>prisma.industry.upsert({where:{code},update:{active:true},create:{code,name}})));
  const territories=await Promise.all([["BKK","กรุงเทพมหานคร","CENTRAL"],["NORTH","ภาคเหนือ","NORTH"],["NE","ภาคตะวันออกเฉียงเหนือ","NORTHEAST"],["SOUTH","ภาคใต้","SOUTH"]].map(([code,name,region])=>prisma.salesTerritory.upsert({where:{code},update:{active:true},create:{code,name,region}})));
  await prisma.prospectScoringRuleVersion.upsert({where:{version:1},update:{active:true},create:{version:1,active:true,createdById:admin.id,hotThreshold:75,warmThreshold:40,weights:{estimatedValue:15,companySize:8,branches:7,industryFit:8,contractTiming:8,contactFrequency:8,interest:10,budget:8,purchasePeriod:7,sourceQuality:6,aiScore:8,recency:4,completeness:3}}});
  const campaigns = await Promise.all([
    prisma.campaign.upsert({ where: { code: "DEMO-CLOUD-2026" }, update: { active: true }, create: { code: "DEMO-CLOUD-2026", name: "Cloud Enterprise Demo 2026", source: "MARKETING" } }),
    prisma.campaign.upsert({ where: { code: "DEMO-GOV-2026" }, update: { active: true }, create: { code: "DEMO-GOV-2026", name: "Government Digital Demo 2026", source: "EVENT" } }),
  ]);
  const statuses = [LeadStatus.NEW, LeadStatus.ASSIGNED, LeadStatus.CONTACTED, LeadStatus.NURTURING, LeadStatus.QUALIFIED, LeadStatus.DISQUALIFIED, LeadStatus.CONVERTED, LeadStatus.ARCHIVED];
  const temperatures = [LeadTemperature.HOT, LeadTemperature.WARM, LeadTemperature.COLD];
  for (let index = 0; index < 20; index += 1) {
    const owner = users[index % 3]; const status = statuses[index % statuses.length]; const temperature = temperatures[index % temperatures.length];
    await prisma.lead.upsert({
      where: { leadNumber: `DEMO-L-${String(index + 1).padStart(4, "0")}` },
      update: {},
      create: { leadNumber: `DEMO-L-${String(index + 1).padStart(4, "0")}`, company: index >= 18 ? "บริษัทตัวอย่างซ้ำ จำกัด" : `บริษัทตัวอย่าง ${index + 1} จำกัด`, contactName: `ผู้ติดต่อทดสอบ ${index + 1}`, contactEmail: `lead${index + 1}@example.test`, contactPhone: `080000${String(index + 1).padStart(4, "0")}`, source: index % 2 ? LeadSource.MARKETING_CAMPAIGN : LeadSource.WEBSITE, campaignId: campaigns[index % campaigns.length].id, status, temperature, score: temperature === LeadTemperature.HOT ? 80 : temperature === LeadTemperature.WARM ? 55 : 25, ownerId: owner.id, organizationUnitId: unit.id, recommendedProducts: "บริการทดสอบ NT", requirementSummary: status === LeadStatus.QUALIFIED ? "ความต้องการสมมติสำหรับทดสอบ conversion" : null, estimatedBudget: status === LeadStatus.QUALIFIED ? "1000000.0000" : null, nextFollowUpAt: index === 17 ? new Date("2026-01-01T02:00:00Z") : null },
    });
  }
  const prospectStatuses=[ProspectStatus.NEW,ProspectStatus.ASSIGNED,ProspectStatus.CONTACTED,ProspectStatus.INTERESTED,ProspectStatus.QUALIFYING,ProspectStatus.QUALIFIED,ProspectStatus.NOT_INTERESTED,ProspectStatus.UNREACHABLE,ProspectStatus.LOST,ProspectStatus.CONVERTED,ProspectStatus.ARCHIVED];
  const prospectSources=[ProspectSource.MANUAL,ProspectSource.WEBSITE,ProspectSource.LINE_OA,ProspectSource.CALL_CENTER,ProspectSource.EVENT,ProspectSource.PARTNER,ProspectSource.REFERRAL,ProspectSource.TENDER,ProspectSource.GOVERNMENT_PROJECT,ProspectSource.COMPANY_REGISTRY,ProspectSource.IMPORT];
  const provinces=["กรุงเทพมหานคร","เชียงใหม่","ขอนแก่น","สงขลา","ชลบุรี"],regions=["CENTRAL","NORTH","NORTHEAST","SOUTH","EAST"];
  for(let index=0;index<20;index+=1){const owner=users[index%3],status=prospectStatuses[index%prospectStatuses.length],heat=[ProspectHeatLevel.HOT,ProspectHeatLevel.WARM,ProspectHeatLevel.COLD][index%3],prospect=await prisma.prospect.upsert({where:{prospectCode:`DEMO-P-${String(index+1).padStart(4,"0")}`},update:{},create:{prospectCode:`DEMO-P-${String(index+1).padStart(4,"0")}`,companyName:`องค์กรเป้าหมายทดสอบ ${index+1}`,companyNameEnglish:`Demo Prospect ${index+1}`,normalizedCompanyName:`องค์กรเป้าหมายทดสอบ${index+1}`,normalizedCompanyEnglish:`demoprospect${index+1}`,taxId:`99999${String(index+1).padStart(8,"0")}`,industryId:industries[index%industries.length].id,province:provinces[index%provinces.length],region:regions[index%regions.length],salesTerritoryId:territories[index%territories.length].id,responsibleBusinessUnitId:unit.id,salesTeamId:unit.id,ownerId:owner.id,status,source:prospectSources[index%prospectSources.length],heatLevel:heat,calculatedScore:heat==="HOT"?82:heat==="WARM"?55:25,aiOpportunityScore:70+(index%25),aiConfidenceScore:65+(index%20),aiRiskScore:15+(index%40),estimatedOpportunityValue:`${(index+1)*250000}.0000`,expectedBudget:`${(index+1)*200000}.0000`,numberOfBranches:(index%8)+1,numberOfEmployees:(index+1)*40,businessPainPoints:"ข้อมูล pain point สังเคราะห์สำหรับทดสอบ",recommendedProducts:"NT Cloud, Cybersecurity, Managed Service",nextFollowUpAt:index%4===0?new Date("2026-07-01T02:00:00Z"):new Date("2026-08-01T02:00:00Z"),createdById:admin.id,updatedById:admin.id,contacts:{create:{name:`ผู้ติดต่อ Prospect ${index+1}`,position:"ผู้จัดการ",mobile:`081111${String(index+1).padStart(4,"0")}`,email:`prospect${index+1}@example.test`,preferredContactChannel:"MOBILE",isPrimary:true,createdById:admin.id,updatedById:admin.id}}}});if(!(await prisma.activity.count({where:{prospectId:prospect.id}})))await prisma.activity.create({data:{prospectId:prospect.id,ownerId:owner.id,type:index%2?ActivityType.PHONE_CALL:ActivityType.MEETING,subject:"กิจกรรมตัวอย่าง Prospect",description:"กิจกรรมสังเคราะห์สำหรับ Dashboard และ Timeline",activityAt:new Date("2026-07-10T03:00:00Z"),nextFollowUpAt:prospect.nextFollowUpAt}});}
}

main().finally(() => prisma.$disconnect());
