# Google Cloud Run deployment

## Production target

- Project: `ntop-502523`
- Service: `ntop`
- Region: `asia-southeast1`
- Custom domain: `ntop.rattanan.dev`
- Ready revision: `ntop-00003-xxv`
- Image digest: `sha256:80c0483d830d3a653e6cd5353d5936aa33636c8e2aaedec0548756bfb1501a25`
- Cloud Run URL: `https://ntop-22285593146.asia-southeast1.run.app`
- Runtime secrets: `ntop-database-url`, `ntop-auth-secret`,
  `ntop-ai-config-master-key`

The container listens on Cloud Run's `PORT=8080`. Runtime secrets are mounted as
environment variables from Secret Manager; `.env` is excluded from the build
context and image.

## Acceptance criteria

1. The latest Cloud Run revision reports Ready and receives 100% traffic.
2. The service runs as a dedicated, non-owner service account with only Secret
   Manager accessor permission for the three runtime secrets.
3. The public `run.app` URL redirects unauthenticated users to `/login` and never
   exposes runtime secret values.
4. `ntop.rattanan.dev` maps to the service and receives a Google-managed TLS
   certificate. DNS records must match the mapping's `resourceRecords`.
5. Prisma migration status is up to date before traffic is directed to the new
   revision. Database migrations are not run during container startup.

## Release procedure

Run local lint, typecheck, tests and production build. Create a new immutable
container revision from the repository, bind Secret Manager versions, deploy with
bounded instances, then verify both the generated URL and custom domain. Rollback
uses Cloud Run traffic assignment to the previous ready revision; database changes
must remain backward compatible and are never rolled back destructively.

Cloud Run domain mapping is a preview feature. For a later hardened production
topology, place a global external Application Load Balancer and Cloud Armor in front
of the service while preserving the same Cloud Run service and DNS name.

## DNS record

The managed domain mapping requires this authoritative DNS record:

```text
ntop.rattanan.dev.  CNAME  ghs.googlehosted.com.
```

The `rattanan.dev` authoritative zone is not hosted in project `ntop-502523`.
Add the CNAME in the project/account that owns the existing Google Cloud DNS zone.
Certificate provisioning begins after the record is publicly visible.
