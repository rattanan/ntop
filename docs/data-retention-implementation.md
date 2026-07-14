# Deletion and Data Retention Policy

## Acceptance criteria

- Prospect uses recoverable soft delete with an approved reason, actor, timestamp and audit event.
- Normal Prospect queries exclude deleted records; Admin can search and restore them.
- Permanent deletion requires the dedicated System Administrator permission and is rejected when Activity, Document, converted Lead/Opportunity, workflow history, command receipt, merge history or Audit reference exists.
- Lead has no delete command. Invalid and Archive are status transitions; existing Activities remain linked and visible in history.
- Opportunity has no delete command. Lost, Cancelled and Expired use governed transitions and remain available for historical reporting.
- Customer has no delete command. Inactive, Blacklisted and Closed are audited lifecycle states; Merge remains recoverable through alias/history records.

## API additions

- `DELETE /api/v1/prospects/{id}` — soft delete only.
- `POST /api/v1/admin/deleted-records/prospects/{id}/restore` — restore.
- `DELETE /api/v1/admin/deleted-records/prospects/{id}` — guarded permanent delete.
- `POST /api/v1/customers/{id}/lifecycle` — Inactive, Blacklisted or Closed.

All lifecycle writes use optimistic versions, server authorization, a database transaction and append-only audit evidence. The migration is additive and keeps existing identifiers and API read models backward compatible.
