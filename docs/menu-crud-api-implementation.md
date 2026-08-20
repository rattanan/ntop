# Menu CRUD API completion

## Scope and acceptance criteria

This change completes only the missing REST surface for the functions visible in the supplied navigation image. Existing APIs and workflow behavior remain backward compatible.

- Collection reads are authenticated, scoped server-side and bounded to 1–200 records.
- Detail reads return `404` when a record is absent or outside the actor's scope.
- Create commands require `Idempotency-Key`; reuse with a different payload returns `409`.
- Updates and deletes require `expectedVersion`; stale mutations return `409`.
- Product and Coverage deletes are recoverable soft deletes. No referenced business record is physically removed.
- Mutations and append-only audit evidence are committed in the same database transaction.
- Money inputs are decimal strings and persist in Prisma `Decimal` columns; JSON floating point inputs are rejected.
- Product floor/standard cost and Coverage confirmed cost are omitted for read-only actors.
- Permission decisions use capability codes and effective role grants, not UI visibility or hard-coded enterprise roles.

## API matrix

| Navigation function | REST API | CRUD behavior |
|---|---|---|
| Prospect | `/api/v1/prospects`, `/api/v1/prospects/{id}` | Existing create/read/update/soft-delete and restore |
| Lead | `/api/v1/leads`, `/api/v1/leads/{id}` | Existing create/read/update; archive is lifecycle-safe delete |
| ลูกค้า | `/api/v1/customers`, `/api/v1/customers/{id}`, `/lifecycle` | Existing create/read/update and governed lifecycle |
| โอกาสขาย | `/api/v1/opportunities`, `/api/v1/opportunities/{id}`, `/transitions` | Existing create/read/update and configured terminal transitions |
| กิจกรรม | `/api/v1/activities`, `/api/v1/activities/{id}` | Collection GET/POST completed; existing GET/PATCH/DELETE retained |
| Sales Pipeline | `/api/v1/pipeline` | Read-only projection; CRUD is intentionally not applicable |
| Coverage | `/api/v1/coverage-checks`, `/api/v1/coverage-checks/{id}` | GET/POST and GET/PATCH/soft-DELETE |
| Solution Design | `/api/v1/solution-designs` and child command routes | Existing aggregate create/read plus governed commands/transitions |
| Site Survey | `/api/v1/site-surveys` and child command routes | Existing create/read plus assignment/result/workflow commands |
| BOQ | `/api/v1/boqs` and child command routes | Existing generated/versioned BOQ read plus item/revision/transition commands |
| บริการและราคา | `/api/v1/products`, `/api/v1/products/{id}` | GET/POST and GET/PATCH/soft-DELETE |
| Proposal | `/api/v1/proposals`, `/api/v1/proposals/{id}` | Existing create/read/update/soft-delete and restore |

Generic update/delete endpoints were not added to approval-controlled Solution Design, Site Survey, BOQ, Pipeline, Customer, Lead or Opportunity resources because that would bypass their configured lifecycle and audit semantics.

## Database compatibility

- MySQL 8 forward migration: `20260820213000_add_menu_crud_api_support`
- MariaDB 5.5 compatibility SQL: `legacy-mariadb-5.5-menu-crud-api-support.sql`
- Existing rows receive `version = 1`; soft-delete columns are nullable and therefore additive.
