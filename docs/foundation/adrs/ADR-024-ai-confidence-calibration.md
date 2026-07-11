# ADR-024: AI Confidence Must Be Calibrated Before Showing Numeric Probability

---
status: accepted
date: 2026-07-11
---

AI capability ที่ยังไม่ผ่าน representative backtesting/calibration แสดง confidence ได้เฉพาะ Low, Medium หรือ High พร้อมปัจจัยและข้อมูลที่ขาด ห้ามแสดง probability ละเอียด เช่น 84% Opportunity probability ทางการยังเป็นค่าที่ KAM/Manager ยืนยัน AI probability เก็บแยกเป็น recommendation และห้าม overwrite Rule-based Signal ต้องถูก label แยกจาก model prediction เมื่อ confidence ต่ำ source conflict สูงหรือข้อมูลไม่ครบ AI ต้อง abstain/escalate

## Considered Options

- แสดง raw model score ถูกปฏิเสธเพราะผู้ใช้อาจตีความเป็น calibrated probability
- ไม่แสดง confidence เลยถูกปฏิเสธเพราะผู้ใช้ประเมินความเสี่ยงของคำแนะนำไม่ได้

## Consequences

แต่ละ capability ต้องมี versioned evaluation dataset, metrics, acceptance threshold, calibration report และ expiry/re-evaluation trigger ก่อนเปิด numeric prediction ต้องติดตาม calibration error, false positive/negative, abstention และ performance แยกตาม segment/role ที่เกี่ยวข้อง
