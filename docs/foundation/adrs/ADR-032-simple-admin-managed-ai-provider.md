# ADR-032: AI Provider Configuration Is Simple and Admin-Managed

---
status: accepted
date: 2026-07-11
---

NTOP ใช้ OpenAI-compatible provider configuration แบบ simple Admin จัดการ AI Enabled, API URL, Model, write-only API Key และ Request Timeout พร้อม Test Connection ได้ หาก endpoint ใช้งานไม่ได้ timeout หรือเปลี่ยน behavior ระบบแจ้ง AI unavailable และให้ผู้ใช้ทำงาน/กรอกข้อมูลเอง ห้าม block core workflow และห้าม fallback ไป public provider อัตโนมัติ ไม่บังคับ shadow/canary หรือ evaluation gate ทุกครั้งที่เปลี่ยน endpoint/model

## Considered Options

- Controlled model release pipeline เต็มรูปแบบถูกปฏิเสธสำหรับระยะนี้เพราะซับซ้อนเกินความต้องการ
- Hard-coded endpoint/model ถูกปฏิเสธเพราะดูแลและเปลี่ยน provider ยาก

## Consequences

Admin change ต้อง audit และมี connection test ขั้นพื้นฐาน Endpoint/model แสดงให้ Admin เห็นได้ แต่ API key เป็น write-only secret ที่แสดงเพียงสถานะ configured/not configured และเก็บใน secret storage ห้าม commit/log ค่า secret การเปลี่ยน model อาจทำให้คุณภาพเปลี่ยนได้และถือเป็น trade-off ที่ยอมรับ

Acceptance criteria: authorized Admin เปลี่ยน enabled/API URL/model/API key/timeout ได้; timeout มี safe min/max validation; non-Admin ถูก deny ฝั่ง server; API key ไม่ถูกอ่านกลับ; Test Connection แสดงเพียงสำเร็จหรือ sanitized error; connection failure ไม่บันทึก secret และไม่ block manual workflow; old/new non-secret configuration change และ key-rotation event ถูก audit; ไม่มี automatic provider fallback
