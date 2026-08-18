# Self-hosted NTOP server deployment

## Decision status

- Status: Active development deployment target
- Effective date: 2026-08-18
- Supersedes: Google Cloud Run deployment

NTOP is deployed directly on the NTOP server. Docker, containers and Cloud Run
are not part of the active deployment path.

## Development environment

| Setting | Value |
|---|---|
| Server | NTOP server |
| Application path | `/opt/apps/ntop-dev` |
| Public URL | `https://ntop-dev.rattanan.dev` |
| Runtime | Node.js process running directly on the server |
| Deployment model | Build and run from the server application path without Docker |

The development database, runtime environment variables, credentials and AI
master key must be isolated from every future production environment. Secrets
must not be committed to the repository.

## Production environment

Production deployment is outside the scope of this decision. Do not infer a
production URL, enable production traffic or reuse development secrets until the
production target and readiness approval are confirmed separately.

## Acceptance criteria

1. The checked-out application is located at `/opt/apps/ntop-dev`.
2. The application is built and run as a direct Node.js process; Docker and
   Cloud Run are not used by the deployment procedure.
3. `https://ntop-dev.rattanan.dev` resolves to the NTOP server, has a valid TLS
   certificate and routes requests to the application through the approved
   reverse proxy.
4. Runtime secrets are stored outside Git with server-side file permissions and
   are distinct from production secrets.
5. Database migrations are executed as an explicit release step with
   `npx prisma migrate deploy`; migrations are not run implicitly at process
   startup.
6. `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass for
   the exact revision before it receives development traffic.
7. An unauthenticated request is redirected to `/login`, and no runtime secret
   value is exposed in the response or logs.

## Retained files

The repository may still contain a `Dockerfile` and historical Cloud Run notes.
They are retained for backward compatibility and history but must not be used by
the active server deployment.
