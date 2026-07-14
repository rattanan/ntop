# Customer Foundation — Development Implementation

| Metadata | Value |
|---|---|
| Status | Implemented — migration application and UAT deferred |
| Requirements | BR-001, FR-001, FR-010, DATA-001, SEC-002, COMP-001 |
| Scope | Customer identity, Customer 360, hierarchy, ownership history, duplicate candidates, merge aliases, REST v1 |

## Acceptance criteria

- Customer 360 แบ่งเป็นแท็บ Overview, Contacts, Hierarchy & Duplicate และ Sales & Activity แบบ server-rendered; Hierarchy, unresolved duplicate candidates และ authorized merge workflow อยู่ใน governance tab เดียวกันโดยไม่ลด server authorization
- Customer 360 สร้างและแก้ไข Contact ได้หลายรายการ พร้อมชื่อ ตำแหน่ง โทรศัพท์ อีเมล ความสัมพันธ์ วัตถุประสงค์ และ Primary flag
- Contact mutation ตรวจ Customer authorization scope ฝั่ง server, ใช้ optimistic Customer version, idempotency receipt และเขียน hash-chained audit ใน transaction เดียวกัน
- การตั้ง Contact เป็น Primary จะยกเลิก Primary ของ Contact รายอื่นใน Customer เดียวกันโดยไม่ลบประวัติ Contact

- Customer create/update is server-authorized, version checked and audited in the same transaction.
- External identifiers are unique per source; duplicate candidates retain deterministic evidence.
- Active hierarchy rejects self-links and cycles.
- Ownership changes retain effective-dated history.
- Merge marks the source as an alias, preserves source records and writes immutable merge history; it does not rewrite tables owned by other modules.
- Customer list/search is scoped and cursor bounded; merged aliases are excluded from the active list.
- REST mutations require correlation/idempotency inputs; updates require If-Match.
- Existing UI routes and legacy Customer fields remain available.

## REST surface

- GET/POST /api/v1/customers
- GET/PATCH/PUT /api/v1/customers/{id}
- POST /api/v1/customers/{id}/relationships
- POST /api/v1/customers/{id}/merge

## Deferred gates

- MariaDB 5.5 development compatibility migration ถูก apply แล้ว; MySQL 8 forward migration ยังไม่ deploy ตาม development policy
- MySQL 8 rehearsal, restore, 2.5M dataset, 100-user capacity and business UAT remain Customer release gates.
