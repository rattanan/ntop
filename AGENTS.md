# AGENTS.md — NTOP Developer Guide

เอกสารนี้เป็นจุดเริ่มต้นสำหรับ developer หรือ coding agent ที่เข้ามาทำงานต่อใน repository นี้ ให้รักษา requirement, architecture, security และพฤติกรรมเดิมของระบบเป็นหลักเสมอ

## 1. เริ่มต้นที่นี่

ก่อนแก้โค้ดทุกครั้ง:

1. อ่านคำขอของงานและระบุ scope ให้ชัดเจน
2. อ่านเอกสาร baseline อย่างน้อย:
   - `docs/product-requirements.md`
   - `docs/system-architecture.md`
   - `docs/testing-strategy.md`
3. อ่านเอกสาร domain ที่เกี่ยวข้องกับงาน เช่น workflow, permissions, API, database หรือ implementation note ใน `docs/`
4. ตรวจ `git status` และรักษาการแก้ไขเดิมของผู้อื่น ห้าม overwrite หรือย้อนการเปลี่ยนแปลงที่ไม่เกี่ยวข้อง
5. ระบุ acceptance criteria และรายชื่อไฟล์ที่คาดว่าจะเปลี่ยนก่อนเริ่มแก้ไข

ถ้า requirement ขัดกัน ให้ใช้ลำดับความสำคัญนี้:

1. คำสั่งล่าสุดที่ได้รับจากผู้ใช้/เจ้าของงาน
2. Approved baseline ใน `docs/product-requirements.md` และ `docs/system-architecture.md`
3. ADR ที่ accepted แล้วใน `docs/foundation/adrs/` และ `docs/foundation/adr-register.md`
4. เอกสาร domain/implementation ที่เกี่ยวข้อง
5. พฤติกรรมปัจจุบันของโค้ดและ test

หากยังมีความขัดแย้งที่อาจเปลี่ยน business behavior, security, data model หรือ API contract ให้หยุดและถามก่อน ห้ามเดาเอง

## 2. ภาพรวมระบบ

- NTOP เป็น Enterprise Sales Platform ครอบคลุม Customer, Lead/Activity, Opportunity/Forecast, Presales, Proposal, Quote/Approval, Contract, Order Handoff, Administration, Audit และ AI assistance ที่อนุมัติแล้ว
- โค้ดปัจจุบันเป็น Next.js 16, React 19, TypeScript, Prisma และ Vitest โดยใช้แนวทาง modular monolith
- Transactional source of truth เป้าหมาย production คือ MySQL 8 InnoDB Cluster; MariaDB 5.5 เป็น legacy environment และไม่ใช่ production architecture baseline
- Authorization และ workflow invariants ต้องบังคับใช้ฝั่ง server เสมอ
- งานระยะยาวตาม target architecture ต้องผ่าน worker/queue; ห้าม block web request ด้วย bulk processing
- MySQL เป็น source of truth ส่วน search projection ต้อง rebuild ได้และห้ามเป็นเจ้าของข้อมูลหลัก

โครงสร้างสำคัญ:

| Path | หน้าที่ |
|---|---|
| `app/(portal)/` | หน้าและ flow ฝั่ง portal แยกตาม business area |
| `app/actions/` | Server actions; ต้องตรวจ authentication, authorization และ input ทุกครั้ง |
| `app/api/v1/` | Versioned REST API; ต้องรักษา backward compatibility |
| `lib/<module>/` | Domain/application logic แยกตาม module |
| `lib/authorization/` | Policy และ server-side authorization |
| `lib/audit/` | Audit evidence ซึ่งต้องเป็น append-only |
| `prisma/schema.prisma` | Prisma data model |
| `prisma/migrations/` | Forward database migrations |
| `tests/unit/` | Unit/domain tests |
| `tests/integration/` | Integration และ real-database tests |
| `tests/e2e/` | Playwright end-to-end tests |
| `docs/` | Requirement, architecture, workflow, implementation และ operational decisions |

Module หนึ่งห้ามเขียนตารางที่อีก module เป็นเจ้าของโดยตรง ใช้ public application interface, orchestration หรือ domain event ตาม `docs/foundation/module-boundaries.md` และห้ามสร้าง circular dependency

## 3. กฎการเปลี่ยนแปลง

- ห้ามลบ feature หรือเปลี่ยนพฤติกรรมเดิมโดยไม่ได้รับคำสั่ง หากจำเป็นต้องลบหรือเกิด breaking change ต้องขออนุมัติก่อน
- ห้ามทำ feature นอก scope หรือแก้หลาย module ที่ไม่เกี่ยวข้องใน task เดียว
- ทำการเปลี่ยนแปลงให้น้อยที่สุดเท่าที่ทำให้งานและ acceptance criteria สำเร็จ
- ทุก feature และ bug fix ต้องมี acceptance criteria ที่ตรวจสอบได้
- ทุกการแก้ไขต้องมี unit test หรือ integration test ที่เหมาะสม; เพิ่ม E2E เมื่อเป็น critical workflow หรือพฤติกรรมข้าม module
- ห้ามใช้ mock data ใน production path และห้ามนำ production secret/PII มาใส่ fixture, log หรือ repository
- ห้าม hard-code role, permission, workflow status, product, approval level หรือ business threshold ให้ใช้ policy/configuration/reference data ที่ระบบกำหนด
- รักษา backward compatibility ของ `/api/v1`; หากจำเป็นต้องเปลี่ยน contract ให้มี versioning, migration/deprecation plan และ approval
- อย่าแก้ generated file หรือ historical migration เพื่อหลบการเปลี่ยน source of truth

## 4. Security, workflow และ audit

- ตรวจ authentication และ authorization ฝั่ง server สำหรับทุก read/write ที่มี scope; การซ่อนปุ่มใน UI ไม่ถือว่าเป็น security control
- Authorization ต้องพิจารณา role, organization, ownership และ workflow responsibility ตาม `docs/roles-and-permissions.md`; foreign ID ไม่ใช่หลักฐานว่าผู้ใช้มีสิทธิ์
- Validate input ที่ trust boundary และใช้ deny-by-default สำหรับ action ที่มี privilege
- ทุก privileged action, workflow transition, commercial approval และสถานะสำคัญต้องเขียน audit log ที่มี actor, action, target, timestamp, reason/context และ correlation ที่จำเป็น
- ห้ามบันทึก password, token, secret หรือ PII ที่ไม่จำเป็นลง log/audit
- Workflow transition ต้องตรวจ allowed state, required fields, authority, segregation of duties และ stale/concurrent update ฝั่ง server
- AI ต้องเสนอผลให้มนุษย์ยืนยันก่อนสร้างหรือแก้ business record และ core workflow ต้องยังทำงานได้เมื่อ AI ปิดหรือ provider ใช้งานไม่ได้

## 5. Database และความถูกต้องของข้อมูล

- ห้ามเปลี่ยน database schema โดยไม่มี forward migration ใหม่ใน `prisma/migrations/`
- ห้ามรัน migration หรือ seed กับ production database จาก local workflow; ตรวจ connection ให้เป็น test database ก่อนเสมอ
- การแก้หลายตารางที่เป็น business operation เดียวกันต้องใช้ transaction รวม aggregate, audit record และ outbox event เมื่อเกี่ยวข้อง
- ใช้ idempotency สำหรับ command/retry ที่อาจถูกเรียกซ้ำ และ optimistic concurrency/HTTP 409 สำหรับ stale update ตาม contract
- เงิน, ราคา, discount, margin และยอดรวมต้องใช้ database decimal/Prisma Decimal ห้ามใช้ floating point สำหรับ business calculation
- เก็บและแปลงวันเวลาโดยคง timezone/offset อย่างถูกต้อง; ห้ามอาศัย timezone ของเครื่องโดยไม่ระบุ
- ห้ามใช้ unbounded query หรือ client-side filtering กับ dataset หลัก; ใช้ index, bounded filters และ cursor pagination
- การเปลี่ยน retention, deletion, external identifier, ownership history หรือ immutable snapshot ต้องอ้างอิง data-governance requirement ที่เกี่ยวข้อง

## 6. Definition of Done

งานถือว่าเสร็จเมื่อครบทุกข้อที่เกี่ยวข้อง:

- Acceptance criteria ผ่านและไม่มี behavior นอก scope เปลี่ยนโดยไม่ตั้งใจ
- เพิ่มหรือปรับ test ครอบคลุม happy path, validation/failure path และ authorization negative case ตามความเสี่ยง
- Schema change มี migration และมีวิธีตรวจสอบ/rollback ที่เหมาะสม
- API change ยังคง backward compatible หรือได้รับอนุมัติพร้อม transition plan
- Security, transaction, audit, idempotency, decimal และ timezone ได้รับการตรวจแล้ว
- เอกสารที่เป็น source of truth ได้รับการอัปเดตเมื่อ behavior หรือ contract เปลี่ยน
- รัน quality gate จาก repository root สำเร็จ:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

เลือก suite เพิ่มเติมตามงาน:

```bash
npm run test:db   # ต้องใช้ test database และ RUN_DB_INTEGRATION เท่านั้น
npm run test:e2e
```

ถ้าไม่สามารถรันคำสั่งใดได้ ต้องระบุคำสั่งที่ไม่ได้รัน เหตุผล และความเสี่ยงที่เหลือ ห้ามรายงานว่า test ผ่านหากไม่ได้รันจริง

## 7. Database setup สำหรับ local/test

1. คัดลอก `.env.example` เป็น `.env` และตั้งค่า test MySQL พร้อม `AUTH_SECRET` อย่างน้อย 32 ตัวอักษร
2. รัน `npm run db:generate`
3. รัน `npm run db:migrate` เฉพาะ test database
4. ตั้ง `SEED_ADMIN_EMAIL` และ `SEED_ADMIN_PASSWORD` แล้วรัน `npm run db:seed` เมื่อจำเป็น

MariaDB 5.5 legacy server ใช้ `prisma/legacy-mariadb-5.5.sql` ผ่าน MySQL CLI และใช้ Prisma เป็น application client เท่านั้น ห้ามใช้ Prisma Migrate จัดการ server ดังกล่าว ดูรายละเอียดใน `README.md`

## 8. การส่งต่องาน

เมื่อสรุปงาน ให้แจ้งอย่างน้อย:

- สิ่งที่เปลี่ยนและเหตุผล
- รายชื่อไฟล์ที่แก้
- Acceptance criteria ที่ตรวจแล้ว
- คำสั่ง lint/typecheck/test/build ที่รันและผลลัพธ์
- Migration, configuration หรือ deployment step ที่ developer คนถัดไปต้องทำ
- ความเสี่ยง, assumption, limitation และงานที่ยังค้าง

ห้าม deploy, รัน production migration, ลบข้อมูล, เปลี่ยน secret หรือทำ external side effect เว้นแต่ได้รับคำสั่งและยืนยัน target ชัดเจน
 
