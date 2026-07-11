# Transactional Outbox/Inbox Spike Plan

| Metadata | Value |
|---|---|
| Status | Discovery Ready |
| Backlog | FND-020 / ADR-005 |
| Owner | Integration and Application Architecture |
| Requirements | INT-003, OPS-002, NFR-004 |

## Hypothesis

Business aggregate, audit reference and outbox event can commit atomically in MySQL; at-least-once worker delivery plus inbox/business idempotency prevents duplicate effects across crash/retry boundaries

## Scenarios

1. crash after business commit before publish
2. crash after broker publish before outbox acknowledgement
3. duplicate and out-of-order delivery
4. consumer business commit before inbox acknowledgement
5. poison message/DLQ/replay
6. lease expiry and competing workers
7. queue outage/backlog recovery

## Measurements and acceptance

- zero lost committed events and zero duplicate business effects
- explicit ordering semantics per aggregate; no global-order claim
- replay preserves event/correlation IDs and audit trail
- bounded claim/cleanup and outbox lag observable
- document transaction isolation, indexes, lease/retry/DLQ and retention
- output: spike report, schema/interface proposal, failure evidence and ADR-005 recommendation No production messaging code or schema migration is authorized

