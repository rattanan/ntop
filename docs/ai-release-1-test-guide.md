# AI Release 1 — Test and UAT Guide

| Metadata | Value |
|---|---|
| Status | Draft for Review |
| Version | 0.1 |
| Owner | QA / AI Foundation Delivery Lead |
| Last Updated | 2026-07-11 |
| Related | [AI Design](ai-design.md), [Testing Strategy](testing-strategy.md), [AI Backlog](foundation/ai-release-1-backlog.md) |

## 1. Preconditions

- Use a disposable MySQL 8 test database for production-target migration rehearsal. The development MariaDB 5.5 database uses only the explicitly named compatibility migrations.
- Copy `.env.example` to `.env.local`; do not commit it.
- Configure `DATABASE_URL`, `AUTH_SECRET`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD`.
- Generate a 32-byte master key with an approved secret-management process, Base64-encode it, and set `AI_CONFIG_MASTER_KEY`. Never reuse the AI provider API key for this value.
- For local development only, `npm run ai:key:ensure` creates a random key in the ignored `.env` file without printing it. Production must inject the key from the approved secret store.
- Store the OpenAI-compatible endpoint and provider key only through the Admin UI after migration; do not paste them into source, tests, logs, or documentation.

## 2. Local quality gate

```bash
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
```

Expected result: every command exits with code `0`.

## 3. MySQL 8 migration rehearsal

1. Back up the disposable database and record its schema version.
2. Apply migrations using the approved MySQL 8 deployment procedure.
3. Verify these tables exist: `AiProviderConfiguration`, `AiProviderConfigurationVersion`, `AiJob`, `AiOutput`, `AiFeedback`, `DealRiskRule`, `DealRiskRuleVersion`, `DealRiskSignal`, `AuditLedger`, and `AuditEvent`.
4. Confirm `AuditLedger` has exactly one `default` row with sequence `0` before the first audit event.
5. Confirm the runtime database account has only `SELECT`/`INSERT` privileges on `AuditEvent`; administration accounts follow the DBA-controlled procedure.
6. Exercise restore on the disposable database before any production approval.

For the legacy development runtime, apply `prisma/legacy-mariadb-5.5-ai-provider-configuration.sql`; it is the additive compatibility counterpart of `20260711160000_add_ai_provider_configuration` and does not authorize applying the MySQL 8 migration.

## 4. Provider administration UAT

1. Sign in as an `ADMIN` account and open `/admin/ai-settings`.
2. Verify a `SALES` or `VIEWER` account cannot access the route or call its server action.
3. Enter API URL, model, request timeout, optional API key, and enabled state. Save.
4. Verify the page reports only whether a key is configured; it must never display the key.
5. Use **Test Connection**. Expected results are a success message or a sanitized error only.
6. Change the API key, save, and confirm a new configuration version is created. The prior version remains historical.
7. Inspect `AuditEvent`: it must contain actor/action/correlation/result and no API key, raw provider response, or plaintext secret.

## 5. Safety and fallback checks

- Disable the Meeting Draft capability. Core Activity creation must still work manually.
- Simulate provider timeout or a 5xx response. Expected result: AI is unavailable; no core sales workflow fails.
- Submit text containing `api key: ...`, `Bearer ...`, or a private-key marker. Expected result: input is rejected before provider transport is invoked.
- Submit unknown output fields or a timezone-less suggested due date. Expected result: strict schema validation rejects the output.
- Verify no browser search, URL fetch, audio/video upload, transcription, proposal/TOR analysis, pricing recommendation, Opportunity creation, Quote creation, approval, order, or stage transition is exposed through AI Release 1.

## 6. Meeting Draft UAT (when its review UI is enabled)

Prerequisite: apply migrations `20260711210000_add_meeting_draft_confirmation` and `20260712090000_add_meeting_next_action_confirmation` in the target test environment. The confirmation backend is fail-closed until the AI governance, audit-ledger and meeting-confirmation migrations all exist.

1. เปิด `/activities/ai-drafts/{outputId}` ด้วยผู้สร้าง AI job และยืนยันว่ามีป้าย `AI Draft — ต้องตรวจสอบ`
2. แก้ Meeting Summary, ยกเลิกเลือกอย่างน้อยหนึ่งกลุ่ม และยืนยัน ตรวจว่า Activity เก็บเฉพาะกลุ่มที่เลือกและมี audit event `ai.meeting-draft.confirm`
3. ส่ง confirmation ซ้ำด้วย idempotency key เดิม ตรวจว่าไม่สร้าง Activity ซ้ำ
4. ทดลองเปิด Draft ของผู้ใช้อื่นและส่ง `customerId`/`opportunityId` นอก ownership scope ต้องถูกปฏิเสธโดย server
5. ตรวจว่า `/activities/new` ยังสร้าง Activity แบบ manual ได้เมื่อ AI ปิดหรือใช้งานไม่ได้
6. เลือก `สร้าง Task จาก Next Action` แล้วยืนยัน ตรวจว่าได้ Task หนึ่งรายการ ใช้ owner/customer/opportunity scope เดียวกัน และวันเวลาถูกเก็บเป็น UTC
7. ส่ง confirmation เดิมซ้ำ ตรวจว่าไม่สร้างทั้ง Meeting Activity และ Next Action Task เพิ่ม

1. Use typed meeting notes. Verify output is clearly labelled Draft.
2. Use pasted transcript text without attestation. Expected result: reject.
3. Repeat with attestation. Expected result: draft can be generated.
4. Verify only the approved groups appear: summary, requirements, agreements, action items, risks, suggested next action, and suggested activity.
5. Verify a user can edit/select fields and no downstream record is created before confirmation.
6. Verify AI unavailable still permits manual Activity creation.

## 7. Deal Risk UAT (when Risk UI is enabled)

1. Create/activate a rule version as `ADMIN`; attempt the same as `SALES` and expect denial.
2. Evaluate no-follow-up, overdue-close-date, and missing-next-action cases using controlled timestamps.
3. Verify each signal shows rule version, threshold snapshot, severity snapshot, and triggering facts.
4. Change a rule threshold and re-evaluate. Historical signals must not change.
5. Disable AI provider. Deterministic risk signals must remain visible.

## 8. Release evidence

Attach command output, migration/restore evidence, role-negative tests, secret-redaction evidence, provider outage fallback evidence, audit-chain verification, UAT sign-off, and unresolved-risk disposition to the release record.
