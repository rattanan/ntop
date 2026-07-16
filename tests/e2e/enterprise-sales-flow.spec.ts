import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const password = process.env.E2E_PASSWORD;
const prisma = new PrismaClient();
test.afterAll(async () => prisma.$disconnect());

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(password ?? "");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function selectOptionContaining(select: ReturnType<Page["locator"]>, text: string) {
  const option = select.locator("option").filter({ hasText: text }).first();
  const optionValue = await option.getAttribute("value");
  expect(optionValue).toBeTruthy();
  await select.selectOption(optionValue!);
}

async function transitionContract(page: Page, target: string, reason: string) {
  const form = page.locator("form").filter({ hasText: "Contract Workflow" });
  await form.locator('[data-testid="contract-next-status"]').selectOption(target);
  await form.getByText("Comment / reason").locator("..").locator("textarea").fill(reason);
  page.once("dialog", (dialog) => dialog.accept());
  await form.locator('[data-testid="contract-transition-submit"]').click();
  const labels: Record<string, string> = { CUSTOMER_SIGN_PENDING: "Customer Signature Pending", NT_SIGN_PENDING: "NT Signature Pending" };
  const label = labels[target] ?? target.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
  await expect(page.getByText(label, { exact: true })).toBeVisible();
}

test.describe("Enterprise Sales authenticated workflow", () => {
  test.skip(!password, "Set E2E_PASSWORD to the local seeded test-account password.");

  test("Enterprise Sales completes Prospect through Contract and Customer Activity", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const suffix = Date.now().toString();
    const company = `E2E Broadband Enterprise ${suffix}`;
    const opportunity = `${company} — Managed Broadband`;
    page.on("dialog", (dialog) => dialog.accept());

    await login(page, "sales1@example.test");
    await page.goto("/prospects/new");
    await page.getByLabel("ชื่อบริษัท/หน่วยงาน").fill(company);
    await page.getByLabel("จังหวัด").fill("กรุงเทพมหานคร");
    await page.getByLabel("ชื่อผู้ติดต่อ").fill("คุณสมชาย ทดสอบระบบ");
    await page.getByLabel("อีเมล").fill(`somchai.${suffix}@example.test`);
    await page.getByLabel("มือถือ").fill(`08${suffix.slice(-8)}`);
    await page.getByLabel("Expected Budget").fill("1500000");
    await page.getByLabel("Estimated Opportunity Value").fill("1800000");
    await page.getByLabel("Business Pain Points").fill("ต้องการวงจร Broadband สำรองพร้อม SLA สำหรับสำนักงานใหญ่");
    await page.getByLabel("Recommended Products").fill("Managed Broadband");
    await page.getByLabel("Status").selectOption("QUALIFIED");
    await page.getByRole("button", { name: "สร้าง Prospect" }).click();
    await expect(page).toHaveURL(/\/prospects\/[^/]+$/);
    await expect(page.getByRole("heading", { name: company })).toBeVisible();
    await expect(page.getByText("QUALIFIED", { exact: true })).toBeVisible();
    const prospectId = page.url().split("/").pop()!;

    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByLabel("ชื่อผู้ติดต่อ")).toHaveValue("คุณสมชาย ทดสอบระบบ");
    await page.getByLabel("ตำแหน่ง").fill("Enterprise IT Manager");
    await page.getByLabel("Notes").fill("E2E draft edited and persisted before conversion");
    const updateResponse = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().endsWith(`/api/v1/prospects/${prospectId}`));
    await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
    expect((await updateResponse).ok()).toBe(true);
    await expect(page).toHaveURL(new RegExp(`/prospects/${prospectId}$`));
    const savedProspect = await page.request.get(`/api/v1/prospects/${prospectId}`);
    expect(savedProspect.ok()).toBe(true);
    const savedProspectBody = await savedProspect.json();
    expect(savedProspectBody.data.notes).toBe("E2E draft edited and persisted before conversion");
    expect(savedProspectBody.data.contacts[0].position).toBe("Enterprise IT Manager");

    const prospectForm = page.locator("form").filter({ hasText: "Convert to Lead" });
    await prospectForm.getByPlaceholder("Qualification note").fill("ผ่านการคัดกรองและยืนยันความต้องการแล้ว");
    await prospectForm.getByRole("button", { name: "Convert to Lead" }).click();
    await expect(page).toHaveURL(/\/leads\/[^/]+$/);
    await expect(page.getByRole("heading", { name: company })).toBeVisible();

    await expect(page.locator("#main-content").getByText("พนักงานขายทดสอบ 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assign / Reassign Lead" })).toHaveCount(0);

    const activityForm = page.locator("form").filter({ hasText: "บันทึกกิจกรรมและ Follow-up" });
    await activityForm.getByLabel("หัวข้อ").fill("Discovery call with enterprise customer");
    await activityForm.getByLabel("ประเภท").selectOption("CALL");
    await activityForm.getByLabel("วันเวลากิจกรรม").fill("2026-07-17T10:00");
    await activityForm.getByLabel("ติดตามครั้งถัดไป").fill("2026-07-20T10:00");
    await activityForm.getByLabel("รายละเอียด / Outcome / Next action").fill("Customer confirmed budget, authority and implementation timeline.");
    await activityForm.getByRole("button", { name: "บันทึกกิจกรรม" }).click();
    await expect(page.getByText("Discovery call with enterprise customer")).toBeVisible();

    const qualificationForm = page.locator("form").filter({ hasText: "Qualification Checklist" });
    for (const checkbox of await qualificationForm.locator('input[type="checkbox"]').all()) await checkbox.check();
    await qualificationForm.getByLabel("สรุปความต้องการ").fill("Managed Broadband พร้อมวงจรสำรองและ SLA");
    await qualificationForm.getByLabel("มูลค่าประมาณการ (บาท)").fill("1800000");
    await qualificationForm.getByRole("button", { name: "ยืนยัน Qualification" }).click();
    await expect(page.locator("span.badge").getByText("ผ่านการคัดกรอง", { exact: true })).toBeVisible();

    const convertForm = page.locator("section.card").filter({ hasText: "Convert เป็น Customer" });
    await convertForm.getByRole("button", { name: "สร้าง Customer ใหม่" }).click();
    await convertForm.getByLabel("เลขนิติบุคคล").fill(suffix.slice(-13).padStart(13, "9"));
    await convertForm.getByLabel("Segment").selectOption({ index: 1 });
    await convertForm.getByLabel("จังหวัด").fill("กรุงเทพมหานคร");
    await convertForm.getByLabel("ชื่อ Opportunity").fill(opportunity);
    await convertForm.getByLabel("Sales Flow").selectOption({ index: 1 });
    await convertForm.getByLabel("มูลค่าประมาณการ (บาท)").fill("1800000");
    await convertForm.getByLabel("วันที่คาดว่าจะปิด").fill("2026-12-15");
    await convertForm.getByLabel("สินค้า/บริการที่สนใจ").fill("Managed Broadband");
    await convertForm.getByRole("button", { name: "สร้าง Customer, Contact และ Opportunity" }).click();
    await expect(page).toHaveURL(/\/opportunities\/[^/]+$/);
    await expect(page.getByRole("heading", { name: opportunity })).toBeVisible();

    const requirementDetails = page.locator("details").filter({ hasText: "Requirement" });
    await requirementDetails.locator("summary").click();
    await requirementDetails.getByLabel("Requirement No.").fill(`REQ-${suffix.slice(-6)}`);
    await requirementDetails.getByLabel("หัวข้อ").fill("Broadband resilience and SLA");
    await requirementDetails.getByLabel("รายละเอียด").fill("Provide primary and backup enterprise broadband circuits.");
    await requirementDetails.getByLabel("Acceptance criteria").fill("Failover tested and SLA documented.");
    await requirementDetails.getByLabel("Feasibility").selectOption("FEASIBLE");
    await requirementDetails.getByRole("button", { name: "เพิ่ม Requirement" }).click();
    await expect(page.getByText("Broadband resilience and SLA")).toBeVisible();

    const opportunityId = page.url().split("/").pop()!;
    await page.goto("/solution-designs");
    const solutionForm = page.locator("form").filter({ hasText: "สร้าง Solution Design" });
    await solutionForm.getByLabel("Opportunity").selectOption(opportunityId);
    await solutionForm.getByLabel("ชื่อ Solution").fill(`Solution ${suffix}`);
    await solutionForm.getByLabel("Pre-Sales owner").selectOption({ label: "Pre-Sales Engineer ทดสอบ" });
    await solutionForm.getByLabel("Target date").fill("2026-08-15");
    await solutionForm.getByLabel("Solution category").fill("BROADBAND");
    await solutionForm.getByLabel("Objective").fill("Design resilient enterprise broadband connectivity.");
    await solutionForm.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText(`Solution ${suffix}`)).toBeVisible();

    const presalesContext = await browser.newContext();
    const presalesPage = await presalesContext.newPage();
    await login(presalesPage, "presales@example.test");
    await presalesPage.goto("/solution-designs");
    await presalesPage.getByRole("link", { name: `Solution ${suffix}` }).click();
    await expect(presalesPage.getByRole("heading", { name: `Solution ${suffix}` })).toBeVisible();
    const designId = presalesPage.url().split("/").pop()!;

    const serviceForm = presalesPage.locator("form").filter({ hasText: "เพิ่ม Product / Service" });
    await selectOptionContaining(serviceForm.getByLabel("Service category"), "Broadband Internet");
    await selectOptionContaining(serviceForm.getByLabel("Catalog item"), "NT-BB-1000");
    await serviceForm.getByLabel("Quantity").fill("1");
    await serviceForm.getByLabel("Bandwidth").fill("1000 Mbps");
    await serviceForm.getByLabel("Access technology").fill("FIBER");
    await serviceForm.getByLabel("Contract months").fill("36");
    await serviceForm.getByRole("button", { name: "บันทึก" }).click();
    await expect(presalesPage.getByText("Service 1 · 1000 Mbps")).toBeVisible();

    const siteForm = presalesPage.locator("form").filter({ hasText: "เพิ่ม Installation Site" });
    await siteForm.getByLabel("Site code").fill(`HQ-${suffix.slice(-6)}`);
    await siteForm.getByLabel("Site name").fill("Enterprise Headquarters");
    await siteForm.getByLabel("Building").fill("E2E Tower");
    await siteForm.getByLabel("Floor").fill("18");
    await siteForm.getByLabel("Address").fill("99 ถนนทดสอบระบบ");
    await siteForm.getByLabel("District", { exact: true }).fill("หลักสี่");
    await siteForm.getByLabel("Province").fill("กรุงเทพมหานคร");
    await siteForm.getByLabel("Postal code").fill("10210");
    await siteForm.getByLabel("Latitude").fill("13.8830");
    await siteForm.getByLabel("Longitude").fill("100.5680");
    await siteForm.getByLabel("Access instructions").fill("Contact security before entering the MDF room.");
    await siteForm.getByRole("button", { name: "บันทึก" }).click();
    await expect(presalesPage.locator("#sites article strong").getByText("Enterprise Headquarters")).toBeVisible();

    const componentForm = presalesPage.locator("form").filter({ hasText: "เพิ่ม Solution Component" });
    await componentForm.getByLabel("Component number").fill(`CMP-${suffix.slice(-6)}`);
    await componentForm.getByLabel("Component name").fill("Primary Enterprise Fiber Circuit");
    await componentForm.getByLabel("Component type").fill("ACCESS_CIRCUIT");
    await componentForm.getByLabel("Source site").selectOption({ label: "Enterprise Headquarters" });
    await componentForm.getByLabel("Bandwidth").fill("1000 Mbps");
    await componentForm.getByLabel("Access technology").fill("FIBER");
    await componentForm.getByLabel("Quantity").fill("1");
    await componentForm.getByLabel("Unit").fill("CIRCUIT");
    await componentForm.getByLabel("Survey required").check();
    await componentForm.getByLabel("BOQ required").check();
    await componentForm.getByRole("button", { name: "บันทึก" }).click();
    await expect(presalesPage.locator("#components article strong").getByText("Primary Enterprise Fiber Circuit")).toBeVisible();

    const mappingForm = presalesPage.locator("form").filter({ hasText: "Map Customer Requirement" });
    await selectOptionContaining(mappingForm.getByLabel("Requirement"), "Broadband resilience and SLA");
    await selectOptionContaining(mappingForm.getByLabel("Solution component"), "Primary Enterprise Fiber Circuit");
    await mappingForm.getByLabel("Coverage").selectOption("FULLY_COVERED");
    await mappingForm.getByLabel("Solution response").fill("Primary fiber circuit with documented resilience and SLA.");
    await mappingForm.getByRole("button", { name: "บันทึก" }).click();
    await expect(presalesPage.getByText("1 mappings")).toBeVisible();

    const advanceSolution = () => presalesPage.locator("form").filter({ hasText: "Advance Solution Design" });
    await advanceSolution().getByLabel("Next status").selectOption("REQUIREMENTS_REVIEW");
    await advanceSolution().getByLabel("Reason").fill("Requirements, services and traceability are complete.");
    await advanceSolution().getByRole("button", { name: "บันทึก" }).click();
    await expect(presalesPage.locator("span.badge").getByText("REQUIREMENTS_REVIEW")).toBeVisible();
    await advanceSolution().getByLabel("Next status").selectOption("SITE_SURVEY_REQUIRED");
    await advanceSolution().getByLabel("Reason").fill("Physical installation requires an on-site feasibility survey.");
    await advanceSolution().getByRole("button", { name: "บันทึก" }).click();
    await expect(presalesPage.locator("span.badge").getByText("SITE_SURVEY_REQUIRED")).toBeVisible();

    const surveyForm = presalesPage.locator("form").filter({ hasText: "สร้าง Site Survey Request" });
    await surveyForm.getByLabel("Site").selectOption({ label: "Enterprise Headquarters" });
    await surveyForm.getByLabel("Service").selectOption({ index: 1 });
    await surveyForm.getByLabel("Survey reason").fill("Validate fiber route, MDF access and installation readiness.");
    await surveyForm.getByLabel("Priority").selectOption("HIGH");
    await surveyForm.getByLabel("Bandwidth").fill("1000 Mbps");
    await surveyForm.getByLabel("Preferred from").fill("2026-07-21T09:00");
    await surveyForm.getByLabel("Preferred to").fill("2026-07-24T16:00");
    await surveyForm.getByLabel("Contact name").fill("คุณสมชาย ทดสอบระบบ");
    await surveyForm.getByLabel("Contact phone").fill("0812345678");
    await surveyForm.getByLabel("Contact email").fill(`somchai.${suffix}@example.test`);
    await surveyForm.getByRole("button", { name: "บันทึก" }).click();
    const surveyLink = presalesPage.locator("#surveys").getByRole("link").first();
    await expect(surveyLink).toBeVisible();
    const surveyHref = await surveyLink.getAttribute("href");
    expect(surveyHref).toMatch(/^\/site-surveys\//);

    await advanceSolution().getByLabel("Next status").selectOption("SITE_SURVEY_REQUESTED");
    await advanceSolution().getByLabel("Reason").fill("Manual site survey request has been created.");
    await advanceSolution().getByRole("button", { name: "บันทึก" }).click();
    await expect(presalesPage.locator("span.badge").getByText("SITE_SURVEY_REQUESTED")).toBeVisible();

    await presalesPage.goto(surveyHref!);
    const submitSurvey = presalesPage.locator("form").filter({ hasText: "Submit internally" });
    await submitSurvey.getByRole("button", { name: "บันทึก" }).click();
    await expect(presalesPage.locator("span.badge").getByText("SUBMITTED")).toBeVisible();
    await presalesContext.close();

    const architectContext = await browser.newContext();
    const architectPage = await architectContext.newPage();
    await login(architectPage, "architect@example.test");
    await architectPage.goto(surveyHref!);
    const assignForm = architectPage.locator("form").filter({ hasText: "Assign survey" });
    await selectOptionContaining(assignForm.getByLabel("Survey team"), "DEMO-ENTERPRISE-SALES");
    await assignForm.getByLabel("Survey engineer").selectOption({ label: "Survey Engineer ทดสอบ" });
    await assignForm.getByLabel("Priority").fill("HIGH");
    await assignForm.getByRole("button", { name: "บันทึก" }).click();
    await expect(architectPage.locator("span.badge").getByText("ASSIGNED")).toBeVisible();
    await architectContext.close();

    const surveyContext = await browser.newContext();
    const surveyPage = await surveyContext.newPage();
    await login(surveyPage, "survey@example.test");
    await surveyPage.goto(surveyHref!);
    const scheduleForm = surveyPage.locator("form").filter({ hasText: "Schedule survey" });
    await scheduleForm.getByLabel("Scheduled date").fill("2026-07-22T10:00");
    await scheduleForm.getByRole("button", { name: "บันทึก" }).click();
    await expect(surveyPage.locator("span.badge").getByText("SCHEDULED")).toBeVisible();
    const startForm = surveyPage.locator("form").filter({ hasText: "Start survey" });
    await startForm.getByRole("button", { name: "บันทึก" }).click();
    await expect(surveyPage.locator("span.badge").getByText("IN_PROGRESS")).toBeVisible();

    const resultForm = surveyPage.locator("form").filter({ hasText: "Manual Survey Result" });
    await resultForm.getByLabel("Survey date").fill("2026-07-22T10:30");
    await resultForm.getByLabel("Feasibility").selectOption("FEASIBLE");
    await resultForm.getByLabel("Recommended technology").fill("Metro Ethernet over fiber");
    await resultForm.getByLabel("Available bandwidth").fill("1000 Mbps");
    await resultForm.getByLabel("Nearest network node").fill("NT-LAKSI-01");
    await resultForm.getByLabel("Distance (m)").fill("350");
    await resultForm.getByLabel("Lead time (days)").fill("30");
    await resultForm.getByLabel("Technical summary").fill("Fiber route and MDF space are feasible with standard installation work.");
    await resultForm.getByLabel("Estimated item").fill("Single-mode fiber installation");
    await resultForm.getByLabel("Item type").fill("MATERIAL");
    await resultForm.getByLabel("Quantity").fill("350");
    await resultForm.getByLabel("Unit", { exact: true }).fill("METER");
    await resultForm.getByLabel("Estimated unit cost").fill("45.50");
    await resultForm.getByRole("button", { name: "บันทึก" }).click();
    await expect(surveyPage.getByText("Fiber route and MDF space are feasible with standard installation work.")).toBeVisible();

    const submitResult = surveyPage.locator("form").filter({ hasText: "Submit result for review" });
    await submitResult.getByRole("button", { name: "บันทึก" }).click();
    await expect(surveyPage.locator("span.badge").getByText("RESULT_SUBMITTED")).toBeVisible();
    await surveyContext.close();

    const reviewContext = await browser.newContext();
    const reviewPage = await reviewContext.newPage();
    await login(reviewPage, "architect@example.test");
    await reviewPage.goto(surveyHref!);
    const reviewForm = reviewPage.locator("form").filter({ hasText: "Review result" });
    await reviewForm.getByLabel("Decision").selectOption("APPROVE");
    await reviewForm.getByLabel("Reason").fill("Survey evidence confirms technical feasibility.");
    await reviewForm.getByRole("button", { name: "บันทึก" }).click();
    await expect(reviewPage.locator("span.badge").getByText("RESULT_APPROVED")).toBeVisible();
    await reviewContext.close();

    const boqContext = await browser.newContext();
    const boqPage = await boqContext.newPage();
    await login(boqPage, "presales@example.test");
    await boqPage.goto(surveyHref!);
    const createBoq = boqPage.locator("form").filter({ hasText: "Create BOQ Draft" });
    await createBoq.getByRole("button", { name: "บันทึก" }).click();
    await expect(createBoq.getByText("บันทึกเรียบร้อย")).toBeVisible();
    await boqPage.goto(`/solution-designs/${designId}`);
    await expect(boqPage.locator("#boqs").getByRole("link").first()).toBeVisible();
    await expect(boqPage.locator("span.badge").getByText("SITE_SURVEY_COMPLETED")).toBeVisible();
    const advanceReviewedSolution = () => boqPage.locator("form").filter({ hasText: "Advance Solution Design" });
    for (const [target, reason] of [["SOLUTION_IN_DESIGN", "Approved survey incorporated into the design."], ["BOQ_PREPARATION", "Components and survey BOQ evidence are ready."], ["TECHNICAL_REVIEW", "Submit complete technical design for architecture review."]] as const) {
      await advanceReviewedSolution().getByLabel("Next status").selectOption(target);
      await advanceReviewedSolution().getByLabel("Reason").fill(reason);
      await advanceReviewedSolution().getByRole("button", { name: "บันทึก" }).click();
      await expect(boqPage.locator("span.badge").getByText(target)).toBeVisible();
    }

    const solutionReviewContext = await browser.newContext();
    const solutionReviewPage = await solutionReviewContext.newPage();
    await login(solutionReviewPage, "architect@example.test");
    await solutionReviewPage.goto(`/solution-designs/${designId}`);
    const technicalReview = solutionReviewPage.locator("form").filter({ hasText: "TECHNICAL Review" });
    await technicalReview.getByLabel("Decision").selectOption("RETURN");
    await technicalReview.getByLabel("Reason").fill("Add explicit failover validation to the technical response.");
    await technicalReview.getByRole("button", { name: "บันทึก" }).click();
    await expect(solutionReviewPage.locator("span.badge").getByText("REVISION_REQUIRED")).toBeVisible();
    await solutionReviewContext.close();

    await boqPage.reload();
    await advanceReviewedSolution().getByLabel("Next status").selectOption("SOLUTION_IN_DESIGN");
    await advanceReviewedSolution().getByLabel("Reason").fill("Failover validation and acceptance evidence added.");
    await advanceReviewedSolution().getByRole("button", { name: "บันทึก" }).click();
    await expect(boqPage.locator("span.badge").getByText("SOLUTION_IN_DESIGN")).toBeVisible();
    for (const target of ["BOQ_PREPARATION", "TECHNICAL_REVIEW"] as const) {
      await advanceReviewedSolution().getByLabel("Next status").selectOption(target);
      await advanceReviewedSolution().getByLabel("Reason").fill(`Resubmit corrected solution to ${target}.`);
      await advanceReviewedSolution().getByRole("button", { name: "บันทึก" }).click();
      await expect(boqPage.locator("span.badge").getByText(target)).toBeVisible();
    }
    await boqContext.close();

    const technicalApprovalContext = await browser.newContext();
    const technicalApprovalPage = await technicalApprovalContext.newPage();
    await login(technicalApprovalPage, "architect@example.test");
    await technicalApprovalPage.goto(`/solution-designs/${designId}`);
    const correctedTechnicalReview = technicalApprovalPage.locator("form").filter({ hasText: "TECHNICAL Review" });
    await correctedTechnicalReview.getByLabel("Decision").selectOption("APPROVE");
    await correctedTechnicalReview.getByLabel("Reason").fill("Corrected design satisfies technical acceptance criteria.");
    await correctedTechnicalReview.getByRole("button", { name: "บันทึก" }).click();
    await expect(technicalApprovalPage.locator("span.badge").getByText("COMMERCIAL_REVIEW")).toBeVisible();
    await technicalApprovalContext.close();

    const commercialApprovalContext = await browser.newContext();
    const commercialApprovalPage = await commercialApprovalContext.newPage();
    await login(commercialApprovalPage, "pricing@example.test");
    await commercialApprovalPage.goto(`/solution-designs/${designId}`);
    const commercialReview = commercialApprovalPage.locator("form").filter({ hasText: "COMMERCIAL Review" });
    await commercialReview.getByLabel("Decision").selectOption("APPROVE");
    await commercialReview.getByLabel("Reason").fill("Commercial assumptions and BOQ evidence are acceptable.");
    await commercialReview.getByRole("button", { name: "บันทึก" }).click();
    await expect(commercialApprovalPage.locator("span.badge").getByText("APPROVED")).toBeVisible();
    await commercialApprovalContext.close();

    await page.goto("/quotes/new");
    const quoteForm = page.locator("form.quote-editor");
    await quoteForm.getByLabel("Opportunity").selectOption(opportunityId);
    await quoteForm.getByLabel("ใช้ได้ถึง").fill("2026-09-30");
    await quoteForm.getByLabel("หมายเหตุ / เงื่อนไขการขาย").fill("36-month enterprise broadband service with documented SLA.");
    const quoteLine = quoteForm.locator("tbody tr").first();
    await selectOptionContaining(quoteLine.locator("select"), "NT-BB-1000");
    await expect(quoteLine.locator("input").nth(1)).toHaveValue("25000.0000");
    await quoteLine.locator("input").nth(0).fill("1");
    await quoteLine.locator("input").nth(2).fill("0");
    await quoteForm.getByRole("button", { name: "สร้าง Draft Version" }).click();
    await expect(page).toHaveURL(/\/quotes$/);
    const quoteRow = page.locator("tbody tr").filter({ hasText: company }).first();
    const quoteLink = quoteRow.getByRole("link");
    await expect(quoteLink).toBeVisible();
    const quoteHref = await quoteLink.getAttribute("href");
    expect(quoteHref).toMatch(/^\/quotes\/[^/]+$/);
    await quoteLink.click();
    await expect(page).toHaveURL(new RegExp(`${quoteHref!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await expect(page.getByText(/Version 1 · DRAFT/)).toBeVisible();
    const quoteId = quoteHref!.split("/").pop()!;

    await page.getByRole("button", { name: "ส่งขออนุมัติ" }).click();
    await expect(page.getByText(/Version 1 · SUBMITTED/)).toBeVisible();
    const approvalLink = page.getByRole("link", { name: /Approval PENDING/ });
    await expect(approvalLink).toBeVisible();
    const approvalHref = await approvalLink.getAttribute("href");
    expect(approvalHref).toMatch(/^\/approvals\//);

    async function decideQuote(href: string, decision: "RETURN" | "REJECT" | "APPROVE", reason: string) {
      const context = await browser.newContext(); const managerPage = await context.newPage();
      await login(managerPage, "manager@example.test"); await managerPage.goto(href);
      const approvalForm = managerPage.locator("form").filter({ hasText: "คำตัดสิน" });
      await approvalForm.getByLabel("คำตัดสิน").selectOption(decision);
      await approvalForm.getByLabel("เหตุผล").fill(reason);
      await approvalForm.getByRole("button", { name: "ยืนยันคำตัดสิน" }).click();
      await expect(managerPage.getByRole("heading", { name: `Approval ${decision === "APPROVE" ? "APPROVED" : decision === "RETURN" ? "RETURNED" : "REJECTED"}` })).toBeVisible();
      await context.close();
    }
    await decideQuote(approvalHref!, "RETURN", "Return version 1 to clarify implementation milestones.");

    await page.goto(`/quotes/${quoteId}`);
    await expect(page.getByText(/Version 1 · RETURNED/)).toBeVisible();
    await page.getByRole("link", { name: "สร้าง Revision และส่งใหม่" }).click();
    await expect(page.getByRole("heading", { name: "สร้าง Quotation Revision" })).toBeVisible();
    await page.getByLabel("หมายเหตุ / เงื่อนไขการขาย").fill("Revision 2 clarifies implementation milestones.");
    await page.getByRole("button", { name: "สร้าง Draft Version" }).click();
    await expect(page).toHaveURL(/\/quotes$/);
    await page.goto(`/quotes/${quoteId}`);
    await expect(page.getByText(/Version 2 · DRAFT/)).toBeVisible();
    await page.getByRole("button", { name: "ส่งขออนุมัติ" }).click();
    const approvalHref2 = await page.getByRole("link", { name: /Approval PENDING/ }).first().getAttribute("href");
    await decideQuote(approvalHref2!, "REJECT", "Reject version 2 because customer acceptance wording is incomplete.");

    await page.goto(`/quotes/${quoteId}`);
    await expect(page.getByText(/Version 2 · REJECTED/)).toBeVisible();
    await page.getByRole("link", { name: "สร้าง Revision และส่งใหม่" }).click();
    await page.getByLabel("หมายเหตุ / เงื่อนไขการขาย").fill("Revision 3 includes complete customer acceptance wording.");
    await page.getByRole("button", { name: "สร้าง Draft Version" }).click();
    await expect(page).toHaveURL(/\/quotes$/);
    await page.goto(`/quotes/${quoteId}`);
    await expect(page.getByText(/Version 3 · DRAFT/)).toBeVisible();
    await page.getByRole("button", { name: "ส่งขออนุมัติ" }).click();
    const approvalHref3 = await page.getByRole("link", { name: /Approval PENDING/ }).first().getAttribute("href");
    await decideQuote(approvalHref3!, "APPROVE", "Commercial terms, milestones and acceptance wording are complete.");

    await page.goto(`/quotes/${quoteId}`);
    await expect(page.getByText(/Version 3 · APPROVED/)).toBeVisible();
    await page.getByRole("button", { name: "ยืนยันการส่งให้ลูกค้า" }).click();
    await expect(page.getByText(/Version 3 · SENT/)).toBeVisible();
    await page.getByRole("button", { name: "บันทึกลูกค้ายอมรับ" }).click();
    await expect(page.getByText(/Version 3 · ACCEPTED/)).toBeVisible();
    const contractHref = await page.getByRole("link", { name: "สร้าง Contract" }).getAttribute("href");
    expect(contractHref).toMatch(/^\/contracts\/new/);

    const contractContext = await browser.newContext();
    const contractPage = await contractContext.newPage();
    await login(contractPage, "contract@example.test");
    await contractPage.goto(contractHref!);
    await expect(contractPage.getByRole("heading", { name: "Contract details" })).toBeVisible();
    await contractPage.getByLabel("Contract name").fill(`Enterprise Broadband Contract ${suffix}`);
    await contractPage.getByLabel("Start date").fill("2026-08-01");
    await contractPage.getByLabel("End date").fill("2029-07-31");
    await contractPage.getByLabel("Payment term").fill("NET 30");
    await contractPage.getByLabel("Billing cycle").fill("MONTHLY");
    await contractPage.getByLabel("Terms").fill("Service activation is subject to the approved survey and SLA.");
    await contractPage.getByLabel("Remarks").fill("Created from the accepted governed quote.");
    await contractPage.getByRole("button", { name: "Create immutable v1" }).click();
    await expect(contractPage).toHaveURL(/\/contracts\/[^/]+$/);
    await expect(contractPage.getByRole("heading", { name: `Enterprise Broadband Contract ${suffix}` })).toBeVisible();
    await expect(contractPage.getByText("Draft", { exact: true })).toBeVisible();
    const contractDetailHref = new URL(contractPage.url()).pathname;
    await transitionContract(contractPage, "INTERNAL_REVIEW", "Contract draft is complete for manager review.");
    await contractContext.close();

    async function contractRoleTransition(email: string, target: string, reason: string) {
      const context = await browser.newContext(); const rolePage = await context.newPage();
      await login(rolePage, email); await rolePage.goto(contractDetailHref); await transitionContract(rolePage, target, reason); await context.close();
    }
    await contractRoleTransition("manager@example.test", "LEGAL_REVIEW", "Manager review confirms commercial completeness.");
    await contractRoleTransition("legal@example.test", "CUSTOMER_REVIEW", "Legal review confirms approved clauses.");
    await contractRoleTransition("contract@example.test", "REVISION_REQUIRED", "Customer requested clarification to the service activation clause.");
    await contractRoleTransition("contract@example.test", "INTERNAL_REVIEW", "Customer clarification incorporated into immutable revision.");
    await contractRoleTransition("manager@example.test", "LEGAL_REVIEW", "Manager re-review completed.");
    await contractRoleTransition("legal@example.test", "CUSTOMER_REVIEW", "Legal re-review completed.");
    await contractRoleTransition("manager@example.test", "PENDING_APPROVAL", "Customer review is complete and ready for director approval.");
    await contractRoleTransition("director@example.test", "CUSTOMER_SIGN_PENDING", "Director approves the final contract version.");

    const contractId = contractDetailHref.split("/").pop()!;
    const contractOfficer = await prisma.user.findUniqueOrThrow({ where: { email: "contract@example.test" }, select: { id: true } });
    const cleanFixtureHash = createHash("sha256").update(`contract-evidence-${suffix}`).digest("hex");
    await prisma.contractDocument.create({ data: { contractId, category: "CONTRACT", currentVersion: 1, versions: { create: { versionNumber: 1, fileName: `signed-contract-${suffix}.pdf`, mimeType: "application/pdf", sizeBytes: BigInt(48), objectKey: `e2e/contracts/${contractId}/${cleanFixtureHash}.pdf`, objectKeyHash: cleanFixtureHash, sha256: cleanFixtureHash, malwareScanStatus: "CLEAN", uploadedById: contractOfficer.id } } } });

    const signatureContext = await browser.newContext();
    const signaturePage = await signatureContext.newPage();
    await login(signaturePage, "contract@example.test");
    await signaturePage.goto(contractDetailHref);
    const signForm = signaturePage.locator("form").filter({ hasText: "Verified Signature Evidence" });
    await signForm.getByText("Signing party").locator("..").locator("select").selectOption("CUSTOMER");
    await signForm.getByText("Signed by").locator("..").locator("input").fill("Customer Authorized Signatory");
    await signForm.getByText("Signed at").locator("..").locator("input").fill("2026-08-02T10:00");
    await signForm.locator('[data-testid="contract-signature-submit"]').click();
    await expect(signaturePage.getByText("บันทึกหลักฐานลายเซ็นเรียบร้อย")).toBeVisible();
    await transitionContract(signaturePage, "NT_SIGN_PENDING", "Verified customer signature is attached.");
    const ntSignForm = signaturePage.locator("form").filter({ hasText: "Verified Signature Evidence" });
    await ntSignForm.getByText("Signing party").locator("..").locator("select").selectOption("NT");
    await ntSignForm.getByText("Signed by").locator("..").locator("input").fill("NT Authorized Signatory");
    await ntSignForm.getByText("Signed at").locator("..").locator("input").fill("2026-08-02T11:00");
    await ntSignForm.locator('[data-testid="contract-signature-submit"]').click();
    await expect(signaturePage.getByText("บันทึกหลักฐานลายเซ็นเรียบร้อย")).toBeVisible();
    await signatureContext.close();
    await contractRoleTransition("contract2@example.test", "EFFECTIVE", "Both clean verified signatures are present; activate contract.");

    await page.goto("/activities/new");
    const activityFormPage = page.locator("form").filter({ hasText: "บันทึกกิจกรรม / การประชุม" });
    await activityFormPage.getByLabel("หัวข้อ").fill(`Contract kickoff follow-up ${suffix}`);
    await activityFormPage.getByLabel("ประเภท").selectOption("FOLLOW_UP");
    await activityFormPage.getByLabel("กำหนดเวลา").fill("2026-08-03T10:00");
    await selectOptionContaining(activityFormPage.getByLabel("ลูกค้า"), company);
    await activityFormPage.getByLabel("โอกาสขาย").selectOption(opportunityId);
    await activityFormPage.getByLabel("รายละเอียด / บันทึกการประชุม").fill("Confirm kickoff participants, activation plan and customer communication cadence.");
    await activityFormPage.getByRole("button", { name: "บันทึกกิจกรรม" }).click();
    await expect(page).toHaveURL(/\/activities$/);
    const createdActivity = page.locator("tbody tr").filter({ hasText: `Contract kickoff follow-up ${suffix}` });
    await expect(createdActivity).toContainText(company);
    await expect(createdActivity).toContainText(opportunity);
    const activityHref = await createdActivity.getByRole("link", { name: /ดูรายละเอียด/ }).getAttribute("href");
    const activityManagerContext = await browser.newContext();
    const activityManagerPage = await activityManagerContext.newPage();
    await login(activityManagerPage, "manager@example.test");
    await activityManagerPage.goto(activityHref!);
    const assignActivity = activityManagerPage.locator("form").filter({ hasText: "Activity Assignment" });
    await assignActivity.getByText("Assignee").locator("..").locator("select").selectOption({ label: "พนักงานขายทดสอบ 2" });
    await assignActivity.getByText("Assignment reason").locator("..").locator("textarea").fill("Sales 2 will coordinate contract kickoff.");
    await assignActivity.getByRole("button", { name: "ยืนยันการมอบหมาย" }).click();
    await expect(activityManagerPage.getByText("มอบหมาย Activity เรียบร้อย")).toBeVisible();
    await activityManagerContext.close();

    const assigneeContext = await browser.newContext();
    const assigneePage = await assigneeContext.newPage();
    await login(assigneePage, "sales2@example.test");
    await assigneePage.goto(activityHref!);
    const completeActivity = assigneePage.locator("form").filter({ hasText: "Activity Completion" });
    await completeActivity.locator('[data-testid="activity-next-status"]').selectOption("COMPLETED");
    await completeActivity.getByText("Reason").locator("..").locator("textarea").fill("Kickoff coordination completed.");
    await completeActivity.getByText("Completion outcome").locator("..").locator("textarea").fill("Kickoff date, participants and activation plan confirmed.");
    await completeActivity.locator('[data-testid="activity-status-submit"]').click();
    await expect(assigneePage.getByText("Completed", { exact: true })).toBeVisible();
    await assigneeContext.close();
  });
});
