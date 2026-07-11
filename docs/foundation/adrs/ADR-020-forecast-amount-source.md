# ADR-020: Forecast Amount Follows the Primary Commercial Evidence

---
status: accepted
date: 2026-07-11
---

ก่อนมี Quote Version ที่ submit แล้ว Forecast Amount ใช้ Opportunity Estimated Value เมื่อมี Primary Quote ที่ submit แล้วให้ใช้ยอดของ latest submitted version และเมื่อมี approved หรือ accepted version ให้ใช้ยอดของ version นั้นตามลำดับ หากมีหลาย Quotes ห้ามบวกรวม KAM ต้องระบุ Primary Quote Forecast Snapshot เก็บทั้ง Estimated Value, Forecast Amount และ source Quote/Version เพื่ออธิบายย้อนหลังได้

## Considered Options

- ใช้ Opportunity Estimated Value ตลอดถูกปฏิเสธเพราะไม่สะท้อนข้อเสนอเชิงพาณิชย์ล่าสุด
- รวมยอดทุก Quote ถูกปฏิเสธเพราะ Quotes อาจเป็นทางเลือกและทำให้ pipeline ซ้ำ

## Consequences

Primary Quote change ต้องถูก audit และมีผลต่อ snapshot ถัดไปเท่านั้น Snapshot เดิม immutable การเปลี่ยน Quote Version ต้อง recalculates Forecast Amount ตาม precedence โดยไม่แก้ historical snapshots
