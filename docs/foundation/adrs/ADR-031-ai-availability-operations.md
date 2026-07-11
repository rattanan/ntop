# ADR-031: AI Failure Never Blocks Core Sales Workflows

---
status: accepted
date: 2026-07-11
---

AI เป็น optional capability และห้ามเป็น synchronous prerequisite ของ core create, update หรือ workflow transition งานสั้นใช้ bounded timeout และ fallback เป็น AI unavailable งานยาวใช้ asynchronous AI Job ที่ cancel/retry ได้ จำกัด concurrency/quota ต่อ user/team/capability Retry เฉพาะ transient error แบบ idempotent ใช้ circuit breaker, feature flag และ telemetry ห้าม fallback ไป public AI provider อัตโนมัติ

## Considered Options

- Block workflow จน AI สำเร็จถูกปฏิเสธเพราะ AI endpoint availability ไม่ใช่ business transaction SLO
- Automatic public-provider fallback ถูกปฏิเสธเพราะ data-boundary และ contract risk

## Consequences

ผู้ใช้ต้องกรอก/ทำงานต่อแบบ manual ได้เสมอ เก็บ latency, error, queue age, token/cost usage โดยไม่เก็บ prompt content Quota/capacity เป็น configuration ไม่ hard-code role/capability

Acceptance criteria: AI outage/timeout/circuit-open tests ไม่ทำให้ core workflow fail; async duplicate/retry สร้างผลครั้งเดียว; non-retryable safety/validation error ไม่ถูก retry; feature flag ปิด capability ได้; ไม่มี traffic ไป provider ที่ไม่ได้อนุมัติ
