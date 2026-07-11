# ADR-036: Phase 1 Deal Risk Uses Configurable Deterministic Rules

---
status: accepted
date: 2026-07-11
---

Phase 1 Deal Risk/Pipeline Health ใช้ deterministic Risk Rules ที่ Admin ตั้ง threshold ตาม risk type, Opportunity stage และ segment ได้ เช่น no follow-up, overdue close date และ missing next action AI ไม่เป็นผู้ตัดสิน trigger แต่ช่วยอธิบายเหตุผลและแนะนำ action ทุก Deal Risk Signal ระบุ rule/version, threshold และ facts ที่ทำให้ trigger

## Considered Options

- Hard-coded thresholds ถูกปฏิเสธเพราะแต่ละ segment/stage มี behavior ต่างกันและขัดกับ configuration governance
- AI-only risk classification ถูกเลื่อนไปจนมี evaluation/calibration data เพียงพอ

## Consequences

Rule changes มีผลต่อการประเมินใหม่และ snapshot ถัดไป ไม่แก้ historical snapshot Configuration change ตรวจ authorization ฝั่ง serverและ audit ห้าม hard-code status/segment/risk threshold ใน application logic

Acceptance criteria: Admin configure/activate/version rules ได้; non-Admin ถูก deny; same facts/rule version ให้ผล deterministic; signal แสดง evidence; threshold change ไม่แก้ history; AI unavailable ยังแสดง rule-based signal; invalid config ถูก reject
