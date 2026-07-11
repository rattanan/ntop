# ADR-034: Phase 1 Meeting AI Produces a Bounded Draft

---
status: accepted
date: 2026-07-11
---

Phase 1 Meeting AI output จำกัดเป็น Meeting Summary, Key Requirements, Decisions/Agreements, Action Items พร้อม suggested owner/due date, Risks/Concerns, Suggested Next Action และ Suggested Activity type/date ผู้ใช้ตรวจแก้และเลือกบันทึกแต่ละส่วนผ่าน Human Confirmation AI ไม่สร้าง Opportunity, Quote, Proposal หรือเปลี่ยน Opportunity Stage ใน capability นี้

## Considered Options

- Free-form summary อย่างเดียวถูกปฏิเสธเพราะนำไปสร้าง Activity/Next Action ยาก
- Auto-create downstream records ถูกปฏิเสธเพราะเกิน AI autonomy boundary และเพิ่มข้อมูลผิด

## Consequences

Output schema ต้อง versioned และ validate แบบ strict ช่องที่ AI ไม่พบข้อมูลคืน empty/unknown แทนการเดา Suggested owner ต้อง resolve เป็นผู้ใช้ที่มีสิทธิ์ก่อนบันทึก Suggested due date เก็บ timezone ชัดเจน

Acceptance criteria: output มีเฉพาะ approved fields; invalid/unknown values ไม่สร้าง record; user แก้/เลือกบันทึกได้; ไม่มี Opportunity/Quote/Stage mutation; confirmation/audit เก็บ selected fields และ actor; AI unavailable ยังสร้าง Activity manual ได้
