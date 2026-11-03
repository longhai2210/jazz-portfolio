# Jazz Portfolio AWS production deployment plan

**Status:** recommended target architecture and operating runbook  
**Reviewed:** 2026-09-03  
**Region assumed:** `ap-southeast-1` (Singapore)  
**Scope:** `apps/web`, `apps/api`, `packages/database`, media, email, CI/CD, security, monitoring, backup, recovery, and cost control

> This document is the production recommendation for the code that exists now. The older
> EC2/Amplify documents in this repository remain useful learning material, but they describe an
> earlier application and should not be treated as the production source of truth.

## 1. Executive decision

For this portfolio/CMS, the best balance of performance, cost, and operational effort is:

- **Next.js web:** AWS Amplify Hosting compute, with its global CDN and Git-based deployments.
- **NestJS API:** Amazon ECS Express Mode on AWS Fargate, behind the managed Application Load
  Balancer (ALB), from an immutable Amazon ECR image.
- **Database:** private Amazon RDS for PostgreSQL 16 using `db.t4g.micro`, Single-AZ at launch,
  `gp3`, encryption, 14-day point-in-time recovery, deletion protection, and a measured path to
  Multi-AZ.
- **Media:** private S3 bucket behind a dedicated CloudFront distribution with Origin Access
  Control (OAC); browsers upload directly with short-lived presigned PUT URLs.
- **Email:** Amazon SES, preferably through the SES v2 API and the ECS task role. The public Fargate
  task can also reach the existing SMTP or Resend integrations without a NAT gateway.
- **Edge protection:** AWS WAF on the public ALB for managed common-exploit rules and rate controls;
  retain application validation and throttling as a second layer.
- **Delivery:** GitHub Actions using AWS OIDC, ECR images tagged with the Git commit, an ephemeral
  one-off Fargate migration task, an ECS Express canary deployment, smoke tests, and rollback to the
  previous image.
- **Operations:** CloudWatch logs/metrics/alarms, Database Insights, an external synthetic check,
  SNS notifications, RDS/S3 recovery controls, AWS Budgets, and Cost Anomaly Detection.
- **Infrastructure:** Terraform, evolving the existing IaC design rather than creating resources by
  hand.

This is intentionally not Kubernetes, not a fleet of EC2 hosts, and not a serverless rewrite. The
workload is a small, mostly read-heavy portfolio with one admin, cached public pages, direct-to-S3
uploads, and a relational CMS. Managed services remove more operational work than their modest
premium costs.

### The one important Amplify compromise

AWS currently supports Next.js 12–15, App Router, SSR, static pages, middleware, image optimization,
and timed ISR on Amplify Hosting. It explicitly does **not** support on-demand ISR or Next.js
streaming. This repository calls `revalidateTag` from `apps/web/src/app/api/revalidate/route.ts`, so
that mechanism must not be treated as reliable on Amplify. See the [Amplify Next.js feature
matrix](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html).

For this project, accept the existing timed refresh windows:

- portfolio data: at most about 60 seconds stale;
- blog list/detail: at most about 300 seconds stale;
- interactive comments: fetched live in the browser and not dependent on the Next data cache.

Leave `WEB_REVALIDATE_URL` and `REVALIDATE_SECRET` unset in the Amplify production topology. If
instant publishing or streaming becomes a firm requirement, move `apps/web` to a container behind
CloudFront; the rest of this architecture can stay unchanged.

## 2. What was assessed in this repository

The recommendation is based on the current code, not only the older deployment notes.

Local inputs reviewed include the [.kiro product/technology/structure
steering](../.kiro/steering/), the [contact/email specification](../.kiro/specs/contact-form-email/),
the [project bible](./PROJECT_BIBLE.md), [database deep dive](./database_design_deepdive.md),
[deployment runbook](./DEPLOYMENT_RUNBOOK.md), [cloud deployment guide](./cloud_deployment_mastery.md),
[IaC guide](./iac_deployment_guide.md), and the optimization, performance, blog, comments, and
contact guides in this directory. The assessment also inspected the actual manifests, Docker and
Compose files, GitHub workflow, Prisma schema/seed, Nest bootstrap/config/health/media/mail code,
and Next cache/revalidation paths. Where prose and executable behavior differ, current code wins.

| Area            | Current reality                                                                                         | Deployment consequence                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Web             | Next.js 15, React 19, App Router, EN/VI/JA routing, SSR/ISR, admin CMS, middleware, image optimization  | Needs a real Next runtime, not a static S3 export                                     |
| API             | NestJS 11 REST service, Prisma, JWT in an httpOnly cookie, Swagger, throttling, presigned S3 uploads    | Long-running managed web service is a natural fit                                     |
| Database        | PostgreSQL 16, JSONB localization, arrays/GIN index, UUIDs, soft deletion, posts/comments/contact inbox | RDS PostgreSQL is the lowest-risk choice; DynamoDB would be a rewrite                 |
| Read pattern    | Public portfolio/blog reads are cached; admin reads use `no-store`                                      | CDN/ISR absorbs most public traffic; DB sizing can start small                        |
| Write pattern   | Admin CRUD, comments, contact messages, counters, moderation                                            | Requires a private durable DB and careful migrations                                  |
| Media           | API signs PUT URLs; browser uploads to S3; CloudFront URL stored in PostgreSQL                          | API does not need to proxy large image/audio bodies                                   |
| Email           | Resend or SMTP selected at API startup; delivery currently runs fire-and-forget                         | SES SMTP works with current code; reliable delivery later needs an outbox/queue       |
| Cache coherence | API calls a Next revalidation route; settings also have a 30-second in-process cache                    | Amplify uses timed ISR; multiple API instances may differ for no more than 30 seconds |
| CI/CD           | GitHub Actions SSHes to EC2, runs Compose down/up, then `prisma db push`                                | Must be replaced before production                                                    |
| Seed            | One script inserts demo content and a known `admin/admin123` account                                    | The current seed must never run against production                                    |

The existing Prisma indexes are sensible starting points for this scale, particularly published
posts, tags, comment moderation, contact inbox, categories, and track ordering. Production query
plans still need to be verified with realistic row counts.

## 3. Target architecture

```text
Visitors / administrator
        |
        +--> www.example.com
        |      Route 53 -> Amplify Hosting / CDN -> Next.js 15
        |                                      |
        |                                      +--> HTTPS public API reads
        |
        +--> api.example.com
        |      Route 53 -> WAF -> public ALB -> ECS Express / Fargate -> NestJS
        |                                                        |
        |                                                        +--> private TLS -> RDS PostgreSQL
        |                                                        +--> presign S3 PUT with task role
        |                                                        +--> HTTPS -> SES / Turnstile
        |
        +--> media.example.com
               Route 53 -> CloudFront + OAC -> private S3 media bucket

GitHub Actions --OIDC--> ECR -> ECS Express canary deployment
          |                 |
          +--> one-off Fargate migration/bootstrap task -> private RDS

CloudWatch + Database Insights + SNS + Budgets observe the entire path.
```

### DNS and cookie topology

Use sibling custom domains under the same registrable domain:

- `www.example.com` — Amplify;
- `api.example.com` — the ALB created for the ECS Express service;
- `media.example.com` — CloudFront;
- apex `example.com` — redirect to `www` or attach it to Amplify.

This keeps the web and API **same-site** even though they are different origins. Configure the API
cookie as `Secure`, `HttpOnly`, and `SameSite=Lax`; allow only the exact web origin in CORS and keep
`credentials: true`. This is more robust than a `SameSite=None` cross-site cookie and reduces CSRF
exposure. Authorization still belongs to Nest, not the non-secret Next session marker.

### Network layout

Create one VPC such as `10.20.0.0/16` across at least two Availability Zones:

| Subnet         | Example                          | Purpose                                                    |
| -------------- | -------------------------------- | ---------------------------------------------------------- |
| public-api-a/b | `10.20.0.0/24`, `10.20.1.0/24`   | internet-facing ALB and ECS Express tasks in value profile |
| private-db-a/b | `10.20.10.0/24`, `10.20.11.0/24` | RDS subnet group only                                      |

Security groups:

The following are logical names. If Express Mode creates the service and load-balancer groups,
reference its managed-resource outputs and enforce these effective rules rather than creating a
second, parallel ingress path.

- `alb-sg`: internet ingress TCP 443 only (and optional TCP 80 redirect); egress only to
  `api-task-sg` on the container port.
- `api-task-sg`: ingress on TCP 3001 only from `alb-sg`; egress TCP 5432 to `rds-sg` and TCP 443 to
  the internet. If the initial SMTP adapter remains, also allow TCP 587 until the SES SDK adapter
  replaces it. Do not allow direct public ingress even though the task receives a public IP.
- `rds-sg`: ingress TCP 5432 only from `api-task-sg` and `release-job-sg`; no public ingress.
- `release-job-sg`: no ingress; egress to RDS and HTTPS. The task exists only during a release and
  uses the same public subnets for image, log, and secret access.

ECS Express Mode deliberately creates an internet-facing ALB and assigns public IPs when public
subnets are selected. That is the lowest-fixed-cost topology here: task egress reaches SES,
Turnstile, Resend, ECR, CloudWatch, and Secrets Manager without an always-on NAT gateway, while the
task security group accepts traffic only from the ALB. The database remains private. AWS documents
these public/private behaviors and the generated ALB, service, scaling, deployment, log, alarm, and
certificate resources in [ECS Express Mode resources and
defaults](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-work.html).

This is a conscious cost/security trade-off, not a claim that public task ENIs are ideal for every
environment. If policy requires private application ENIs, graduate the API to a standard ECS
Fargate service: keep a public ALB in the public subnets, put tasks in new private application
subnets, and add NAT gateways or the necessary VPC endpoints. Do not make RDS public. NAT has a
material fixed hourly and per-GB cost; AWS's public US example is $0.045/hour plus $0.045/GB and a
public IPv4 charge, with regional prices varying. See [VPC
pricing](https://aws.amazon.com/vpc/pricing/).

## 4. Why this option wins

| Option                                 | Good                                                                                            | Problems here                                                                                                    | Decision                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Amplify + ECS Express/Fargate + RDS    | Managed ALB, canary rollout, autoscaling and logs with standard ECS resources; no host patching | ALB and one always-on task create a fixed floor; value network gives tasks public IPs; timed ISR only            | **Recommended**                                     |
| Amplify + standard ECS/Fargate + ALB   | Maximum network, scaling and deployment control; public ALB with private tasks                  | More IaC/networking work and NAT/endpoints add cost; still has Amplify ISR limitation                            | Compliance/control upgrade                          |
| CloudFront + ECS/Fargate for both apps | Full Next features, same-origin routing, independent scaling possible                           | Highest networking/ALB/container complexity and cost for this traffic level                                      | Use when instant invalidation/streaming is required |
| Elastic Beanstalk/EC2                  | Familiar and can be inexpensive; Beanstalk adds managed deployments                             | OS/container runtime patching, instance capacity, single-host failure or ALB cost; current SSH workflow is risky | Budget-only alternative                             |
| Lightsail                              | Predictable low fixed price                                                                     | Less networking/IAM/observability depth and a weaker growth path to private RDS                                  | Acceptable hobby tier, not target production        |
| Lambda + API Gateway                   | Excellent for bursty stateless handlers                                                         | Nest/Prisma/RDS pooling and VPC cold starts create complexity; mail and cache callbacks still need egress        | No                                                  |
| Aurora Serverless v2                   | Fine-grained database scaling and stronger cluster architecture                                 | Minimum capacity and cluster floor cost more than this tiny, steady PostgreSQL workload                          | Revisit only after measured scale/availability need |
| EKS                                    | Flexible                                                                                        | Control-plane and operations are unjustified for two Node applications                                           | No                                                  |

ECS Express Mode creates a production-oriented Fargate service, ALB, HTTPS endpoint, canary
deployment, autoscaling, logs, and health alarm while leaving every resource accessible for later
customization; AWS charges for the underlying resources rather than an Express surcharge. See the
[ECS Express Mode overview](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html).

Do **not** start a new App Runner design. AWS stopped accepting new customers on March 31, 2026 (see
the [App Runner CreateService
notice](https://docs.aws.amazon.com/apprunner/latest/api/API_CreateService.html)), and says existing
customers can continue but should expect no new features. AWS recommends ECS Express Mode for new
deployments. See the [App Runner availability
change](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html).

## 5. Availability profiles and upgrade triggers

There is no honest way to call a Single-AZ database highly available. The recommended **value
profile** accepts that trade-off because the public site is CDN-backed and most public content is
cached.

### Value profile — recommended at launch

- Amplify production branch.
- ECS Express/Fargate: `0.5 vCPU / 1 GB`, desired/minimum 1 task, maximum 3 tasks, CPU target 60%,
  multi-AZ public subnets, internet-facing ALB, and canary deployments.
- RDS: `db.t4g.micro`, Single-AZ, 20 GiB `gp3`, autoscale ceiling 100 GiB.
- 14-day automated backups/PITR and quarterly restore exercise.
- Contact/comment email remains a non-blocking notification; the database write is the source of
  truth and an outbox is the reliability upgrade.
- WAF on the API; no Amplify WAF until evidence warrants its separate fixed charge.

Expected behavior: public cached pages continue to be available during many API/DB incidents, while
admin, live comments, contact writes, and cache refreshes degrade.

### Durable profile — enable when availability has business value

- RDS Multi-AZ with one standby, normally `db.t4g.small` after measurement.
- ECS desired/minimum 2 tasks spread across AZs; maximum raised only after load and connection
  budgeting.
- Standard ECS service with public ALB and private application subnets if private task ENIs are a
  policy requirement.
- Stronger synthetic coverage and automatic restore testing.
- Consider container-hosting the web if immediate content invalidation is part of the publishing
  SLA.

### Scale or upgrade when any trigger persists

| Signal                                                                    | Action                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| API memory is above 75% or restarts/OOMs                                  | Move the task to 1 vCPU / 2 GB                                                  |
| API p95 exceeds 200 ms while CPU is high                                  | Scale tasks or size up; profile the API/queries first                           |
| DB free memory is below 200 MiB or CPU is above 70% for sustained periods | Move to `db.t4g.small`; inspect Database Insights before scaling further        |
| DB connection use exceeds 70% of the configured limit                     | Reduce Prisma pools, cap ECS tasks, then evaluate RDS Proxy                     |
| Public/API availability needs exceed the measured Single-AZ recovery time | Turn on RDS Multi-AZ                                                            |
| CMS publish-to-visible must be under 30 seconds                           | Move the web app from Amplify to container hosting                              |
| Public task ENIs, Express rollout, or service limits block a requirement  | Convert only the API to standard ECS/Fargate; keep RDS/S3/SES                   |
| Stable usage persists for 30–60 days                                      | Evaluate one-year RDS Reserved Instance pricing; do not commit before measuring |

## 6. Required code and configuration work before production

These are deployment blockers or high-value hardening changes. They are not optional polish.

### P0 — must fix

1. **Never run the present seed in production.** It creates `admin/admin123` and overwrites demo
   profile, category, post, and comment content on each run.
2. Replace production `prisma db push` with `prisma migrate deploy`. `db push` does not provide the
   reviewed migration history or production controls required here.
3. Add a database-aware readiness endpoint, for example `GET /api/health/ready`, that executes a
   bounded `SELECT 1`; keep `GET /api/health/live` independent of the database.
4. Enable graceful shutdown (`app.enableShutdownHooks()`), handle `SIGTERM`, stop accepting new
   work, and close Prisma before ECS stops a task.
5. Trust the ALB proxy correctly before using `@Ip()` for comment tokens, IP hashes, or rate
   limits. Validate the forwarded-address behavior in staging; otherwise every visitor can appear
   to have the same proxy address.
6. Disable Swagger in production or protect it behind admin authentication. The current bootstrap
   always exposes `/api/docs`.
7. Build and run the API container as a non-root user, use a current Node 20 image, pin base images
   by digest in controlled updates, add a container `HEALTHCHECK`, and test a read-only root
   filesystem. AWS recommends minimal images, non-root users, read-only filesystems, and immutable
   ECR tags in its [ECS container security guidance](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-tasks-containers.html).
8. Fix the production container so the generated Prisma client and every pnpm workspace runtime
   dependency are actually present. Test the exact image with `docker run` before pushing it.
9. Add explicit origin/CSRF defenses for cookie-authenticated mutations. Exact CORS plus
   `SameSite=Lax` is a strong base; also validate `Origin` on state-changing admin requests and use a
   CSRF token if the topology ever becomes cross-site.

### P1 — complete before enabling public comments/contact at scale

1. **Media finalize flow:** presign for 5–15 minutes, upload, verify object metadata/size/type, then
   create the `Media` row. The current code inserts a row before the browser proves upload success
   and grants a one-hour URL.
2. **Durable email:** the current fire-and-forget promise can be lost when an instance is replaced
   and returns `emailDelivered: true` before delivery. Add an outbox table or SQS job with attempts,
   next-attempt time, terminal failure, and a CloudWatch alarm. Until then, name the result
   `notificationAccepted`, log failures, and treat PostgreSQL as the contact system of record.
3. **Request logs:** emit one JSON object per request with timestamp, request ID, route template,
   status, latency, deployment SHA, and error class. Never log JWTs, passwords, email bodies,
   comment bodies, CAPTCHA tokens, presigned URLs, or database URLs.
4. **Global abuse protection:** the Nest throttler is per process. ECS can scale to multiple tasks,
   so WAF must enforce service-wide rate rules for login, contact, comment token, and
   comment submission paths.
5. **Email provider truth:** `MAIL_PROVIDER` is chosen when `MailModule` starts. Changing the
   database `mailProvider` field does not switch the injected provider. Treat the environment value
   as authoritative or refactor provider selection.

### P2 — performance work before a traffic campaign

1. Remove `viewCount` writes from the cached public post GET. Count views through analytics or a
   separate sampled/deduplicated endpoint.
2. Replace the sitemap's sequential walk of every blog page with one bounded projection of
   published slugs and `updatedAt`; cache for 30–60 minutes.
3. Batch comment moderation in one bounded transaction and emit one invalidation, rather than one
   transaction and callback per ID.
4. Move tag aggregation to a PostgreSQL `unnest`/group query when post volume makes the current
   application-side scan visible.
5. Load-test the exact Fargate/RDS sizes before launch. Targets already documented in this repo
   are sensible: API p95 under 200 ms, Prisma query p95 under 50 ms, mobile LCP under 2.5 seconds,
   INP under 200 ms, and CLS under 0.10.

## 7. Database plan

### Initial RDS configuration

| Setting      | Value                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| Engine       | RDS PostgreSQL 16, latest tested minor                                      |
| Instance     | `db.t4g.micro` launch; `db.t4g.small` if memory/load tests require          |
| Availability | Single-AZ value profile; Multi-AZ durable profile                           |
| Storage      | 20 GiB `gp3`, encrypted, autoscale maximum 100 GiB                          |
| Network      | private DB subnet group across 2 AZs; `publicly_accessible = false`         |
| Security     | SG reference only; no CIDR `0.0.0.0/0`; TLS required                        |
| Backup       | 14 days automated backup/PITR, deletion protection, final snapshot required |
| Maintenance  | explicit low-traffic UTC windows, different backup and maintenance windows  |
| Monitoring   | CloudWatch standard metrics, PostgreSQL logs, Database Insights Standard    |
| Protection   | Terraform `prevent_destroy`, tags copied to snapshots                       |

RDS automated retention can be set from 0–35 days; setting it to 0 disables automated backups.
AWS recommends backups and monitoring memory, CPU, connections, storage, and latency. See [RDS
backup retention](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.BackupRetention.html)
and [RDS best practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html).

RDS PostgreSQL 16 requires SSL by default (`rds.force_ssl` is on by default for PostgreSQL 15+),
but the client should still verify the server CA rather than use an unverified encrypted channel.
Package the current RDS CA bundle and use `sslmode=verify-full` if supported cleanly by the Prisma
driver/runtime. See [RDS PostgreSQL SSL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html).

### Roles and connection strings

Use separate PostgreSQL identities:

- `jazz_app`: runtime CRUD only on the application schema; no schema ownership, `CREATEDB`, or
  superuser-like privileges.
- `jazz_migrator`: schema owner/migration privileges; available only to the release job.
- RDS master: break-glass administration only; never injected into an ECS task.

Store separate runtime and migrator URLs in Secrets Manager. A safe starting runtime URL is
conceptually:

```text
postgresql://jazz_app:...@private-rds:5432/jazz?schema=public&connection_limit=5&pool_timeout=10&connect_timeout=5&sslmode=require
```

Do not copy that literal into source or logs. Validate the exact Prisma 6 query parameters in
staging, and upgrade from `require` to certificate verification before production sign-off.

With ECS maximum tasks set to 3 and a pool limit of 5, normal runtime demand is bounded near 15
application connections plus jobs/administration. Do not buy RDS Proxy initially;
always-on containers already pool connections. Add it only when measured connection churn or a
larger instance count justifies its cost.

### Database observability

Use CloudWatch **Database Insights**, not a new Performance Insights plan. AWS ended the standalone
Performance Insights experience in July 2026 and migrated users to Database Insights. See [Database
Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Database-Insights.html).

Enable and review:

- `pg_stat_statements`;
- slow statement logging starting around 250–500 ms, then tune for log volume;
- CPU, `FreeableMemory`, `FreeStorageSpace`, `DatabaseConnections`, read/write latency, IOPS, queue
  depth, network, transaction/log volume, and T-class `CPUCreditBalance`/surplus credit charges;
- the five query families that matter: published-post pagination, tag filtering, approved comments,
  moderation queue, and dashboard counts;
- `EXPLAIN (ANALYZE, BUFFERS)` against production-like data before adding speculative indexes.

### Migration strategy

Every schema change follows expand/contract:

1. **Expand:** add nullable columns/tables/indexes that old and new code can both tolerate.
2. Deploy code that writes/reads both representations if needed.
3. Backfill in bounded batches, outside the main deployment transaction.
4. Verify counts, nulls, constraints, and query plans.
5. **Contract:** remove old columns/behavior in a later release.

Never combine an immediately destructive migration with code that requires the new schema. An
application rollback cannot undo dropped data.

## 8. Production seeding and bootstrap strategy

### Split the current seed into three explicit modes

| Mode             | Environment                  | Contents                                                       | Repeat behavior                                            |
| ---------------- | ---------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `demo`           | local/temporary staging only | current profile, categories, posts, comments, known demo admin | may reset/overwrite demo records                           |
| `bootstrap`      | production, exactly once     | default settings row and first admin supplied through secrets  | insert missing rows only; never overwrite content/password |
| `content-import` | deliberate operator action   | reviewed portfolio/blog content                                | versioned, checksum-recorded, dry-run first                |

Production safeguards:

- Fail if `NODE_ENV=production` and mode is `demo`.
- Require an explicit `ALLOW_PRODUCTION_BOOTSTRAP=true` and a change-ticket/release input.
- Accept `BOOTSTRAP_ADMIN_USERNAME` and a randomly generated strong password from Secrets Manager;
  never use a compiled default.
- Use a PostgreSQL advisory lock or a `seed_history` table so two jobs cannot bootstrap together.
- Record seed name, checksum, Git SHA, operator/run ID, and timestamp.
- Insert the admin/settings only when absent; a re-run must not reset password, flags, or content.
- Delete or rotate the temporary bootstrap password immediately after the first verified login.
- Do not seed media URLs. Upload real media through the finalized S3 workflow after CloudFront is
  ready.

### First production database runbook

1. Confirm RDS status `available`, backup retention 14 days, deletion protection on, and no public
   access.
2. Start the release job using the **migrator** secret and the same image digest that will be
   deployed.
3. Run `prisma migrate status`; fail on a divergent or failed history.
4. Run `prisma migrate deploy` once.
5. Run a read-only verification: expected tables/indexes exist and the migration table is clean.
6. Run `bootstrap` once with the production guard and generated credentials.
7. Verify exactly one settings row and one intended admin; demo posts/comments must be zero unless a
   reviewed import was requested.
8. Deploy the API, test login, change the temporary password, rotate/delete the bootstrap secret,
   and capture the evidence in the release record.
9. Upload production media and content through the CMS or reviewed `content-import` job.

### Release-job networking

The cost-effective runner is an ephemeral ECS/Fargate task using the release image, a security
group with **no ingress**, and a public subnet/public IP only so it can pull the image and reach AWS
control endpoints without an always-on NAT. It can reach private RDS through the VPC. It runs for a
few minutes and is then gone.

It follows the same conscious public-ENI value trade-off as the service. For a compliance-sensitive
environment, run it in private subnets and pay for the required NAT or
ECR/Logs/Secrets/S3 endpoints. Do not keep a public bastion or a permanent self-hosted runner merely
to run migrations.

## 9. API deployment on ECS Express Mode

### Container and ECR

Create one private ECR repository, immutable tags enabled:

- tag every release `git-<full-sha>`;
- record and deploy the resulting image digest;
- build/test `linux/arm64` and use Fargate Graviton when Prisma, bcrypt, and every native dependency
  pass the exact-image test; retain `linux/amd64` as the safe fallback, not an untested assumption;
- optionally move a `prod-current` alias only for humans, never as the deployment identity;
- scan on push; fail CI on exploitable critical/high findings after documenting allowed exceptions;
- lifecycle policy: keep all protected production digests plus roughly the latest 20 unreferenced
  builds.

ECR supports enhanced continuous scanning through Amazon Inspector and lifecycle policies for
expiring old images. See [ECR scanning](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning-enhanced.html)
and [ECR lifecycle policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html).

### ECS Express service settings

| Setting             | Starting value                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Source              | private ECR image; unique `git-<sha>` tag and recorded digest                            |
| Launch type         | Fargate through ECS Express Mode                                                         |
| CPU / memory        | 0.5 vCPU / 1 GB; confirm with load test                                                  |
| Port                | container TCP 3001 and `PORT=3001`                                                       |
| Health              | ALB HTTP `/api/health/ready`, 15–30 s interval, 5 s timeout, healthy 2, unhealthy 3      |
| Desired/autoscaling | minimum 1, maximum 3 tasks, CPU target 60%; add request-based scaling after measuring    |
| Network             | public subnets in 2 AZs, public IP assigned, task ingress only from `alb-sg`             |
| Roles               | separate execution, infrastructure, and application task roles                           |
| Deployment          | ECS Express canary with alarm rollback; CI controls the release                          |
| Domain/TLS          | `api.example.com`, Route 53 alias, ACM certificate, HTTPS 443; redirect HTTP to HTTPS    |
| WAF                 | regional web ACL associated with the ALB                                                 |
| Logs                | `/ecs/jazz-api` CloudWatch log group, explicit 30-day retention, non-blocking log driver |

ECS Express Mode provisions a Fargate service plus ALB, TLS endpoint, autoscaling, networking,
logging, and canary deployment. Its default task size may be larger than this application's needs,
so explicitly choose 0.5 vCPU/1 GB and validate memory under Prisma, bcrypt, image-metadata, and
concurrent request load. There is no Express Mode surcharge; charges are for Fargate, ALB, public
IPv4, logs, and transfer. See the [ECS Express Mode
overview](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html)
and [Fargate pricing](https://aws.amazon.com/fargate/pricing/).

Express Mode creates a default `*.ecs.<region>.on.aws` URL. Production should use the custom domain
and certificate above. Keep the generated endpoint out of normal client configuration, and verify
that the ALB health check—not a Docker-only health check—reaches the readiness route.

The default Express update sends 5% of traffic to the canary, observes it for three minutes, moves
to 100%, and observes again. Its generated rollback alarm currently uses the combined 4xx + 5xx
percentage; this API legitimately returns 401/403/404 responses, so test that alarm under normal
traffic and use an additional target-5xx alarm where needed. A bad login must not make every release
roll back, but a canary crash must. See [updating an ECS Express
service](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-update-full.html).

Express currently leaves ALB access logs disabled and HTTP desync mitigation off by default. Manage
the generated ALB settings in IaC: enable access logs to a dedicated encrypted log bucket when the
operational evidence is worth the small storage cost, choose the defensive desync mode after
compatibility testing, drop invalid header fields, and keep the WAF association. Direct resource
changes persist, but AWS warns that Express Mode does not validate conflicts with direct ALB/ECS
updates; review drift after each provider or service update.

### IAM separation

- **ECS infrastructure role:** only the permissions Express Mode needs to manage the named service,
  ALB, deployment, scaling, logs, and certificate resources.
- **Task execution role:** pull the named ECR image, receive the named Secrets Manager values, and
  write the named CloudWatch log group.
- **Application task role:** sign `s3:PutObject` only under the application's media prefixes and
  call the approved SES operations; no broad `s3:*` or `secretsmanager:*`.
- **Release job execution role:** pull ECR, receive named secrets, write its log group.
- **Release job task role:** database migration has no AWS permissions unless the bootstrap process
  explicitly reads a named secret through SDK.
- **GitHub deployment role:** push to the named ECR repository, run the named migration task
  definition, update the named ECS Express service, and read deployment status—nothing else.

Inject Secrets Manager values through the task definition's `secrets` field, never plaintext task
environment entries or CI output. Rotated values are not picked up by an already-running task, so
secret rotation must force a new ECS deployment. See [Passing Secrets Manager values to ECS
tasks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html).

## 10. Web deployment on Amplify

### Build configuration

Use Node 20 and pnpm 9.15 exactly as the repository declares. The Amplify monorepo build should:

1. enable Corepack and activate `pnpm@9.15.0`;
2. install from repository root with `pnpm install --frozen-lockfile`;
3. run database client generation if the workspace build graph requires it;
4. run `pnpm --filter @jazz-portfolio/web build`;
5. publish the Next `.next` artifact using Amplify's monorepo/app-root configuration;
6. cache the pnpm store, not a mutable production artifact;
7. fail on lint/type/test/build in GitHub before Amplify deployment starts.

Amplify supports Next.js 15 without an adapter and uses the Node major version used for the build;
current supported Node runtimes include 20, 22, and 24. See [Amplify SSR deployment](https://docs.aws.amazon.com/amplify/latest/userguide/server-side-rendering-amplify.html)
and [SSR runtime support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-supported-features.html).

### Production environment variables

```text
NEXT_PUBLIC_API_URL=https://api.example.com/api
API_INTERNAL_URL=https://api.example.com/api
NEXT_PUBLIC_SITE_URL=https://www.example.com
NEXT_PUBLIC_CDN_URL=https://media.example.com
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

Do not configure `REVALIDATE_SECRET` in the recommended Amplify topology. These web values are
public configuration; there should be no database, JWT, SMTP, or AWS access credentials in Amplify.

### Branches and previews

- `main` is the production branch with manual GitHub Environment approval.
- A persistent `staging` branch uses a separate staging API and database.
- PR previews may consume the staging read-only API, but should not receive production admin
  credentials, production cookie/CORS permission, or production revalidation secrets.
- Automatically delete previews after PR close to control artifact storage and accidental exposure.

Amplify's pay-as-you-go model charges for build minutes, CDN storage/transfer, SSR requests, and SSR
duration, with no monthly hosting minimum. See [Amplify pricing](https://aws.amazon.com/amplify/pricing/).

## 11. S3 and CloudFront media

### S3 bucket controls

- Dedicated production bucket; never reuse the Terraform state or log bucket.
- Block all public access at account and bucket level.
- Object Ownership: bucket-owner-enforced; ACLs disabled.
- Default encryption; SSE-S3 is adequate for public portfolio media unless policy requires a
  customer-managed KMS key.
- Versioning on.
- Deny non-TLS requests.
- CORS allow only `https://www.example.com`, method `PUT`, required headers, and a short cache age.
- Lifecycle: abort incomplete multipart uploads after 7 days; expire noncurrent versions after a
  reviewed 30–90 day recovery window; report/clean orphaned objects rather than blind deletion.
- Event or scheduled reconciliation should identify an S3 object without a finalized DB row and a
  DB media row without an object.

AWS recommends all four S3 Block Public Access controls, and CloudFront recommends OAC rather than
legacy OAI. See [S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)
and [CloudFront OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

### CloudFront media distribution

- S3 REST origin with OAC `always` signing; bucket policy grants `GetObject` only to that
  distribution ARN.
- Viewer protocol HTTPS only; HTTP redirects to HTTPS.
- `GET`/`HEAD` only from viewers.
- Automatic Brotli/gzip compression.
- Long TTL (for example, one year) because keys contain UUIDs and should be immutable.
- A response headers policy with content-type protection, HSTS, `nosniff`, and a conservative CORS
  policy.
- Custom `media.example.com` certificate in `us-east-1`, as CloudFront requires.
- Do not invalidate routine uploads; publish a new UUID key. Invalidate only a mistakenly reused key.

The API's production role signs uploads; do not set `AWS_ACCESS_KEY_ID` or
`AWS_SECRET_ACCESS_KEY`. AWS SDK's default credential chain will use the ECS application task role.

## 12. Email design

### Initial SES path

The code already supports SMTP through Nodemailer:

```text
MAIL_PROVIDER=smtp
SMTP_HOST=<regional SES SMTP endpoint>
SMTP_PORT=587
SMTP_USER=<Secrets Manager reference>
SMTP_PASS=<Secrets Manager reference>
MAIL_FROM=notifications@example.com
MAIL_TO=owner@example.com
```

Verify the sending domain, DKIM, SPF, and DMARC. Request SES production access; new SES accounts are
in a regional sandbox that limits sending to verified recipients, 200 messages/day, and one
message/second. See [SES production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

Prefer a small code follow-up that adds an SES v2 SDK provider using the ECS application task role.
It removes SMTP credentials and keeps authorization in IAM. In the value topology, the task reaches
the regional SES public API over its public egress; no NAT or SES interface endpoint is required.
If the service later moves to private task subnets, add NAT or a supported SES VPC endpoint as part
of that network change.

Monitor sends, rejects, bounces, and complaints. Contact submission storage must succeed or fail
independently from notification delivery. A notification failure should never erase the message.

## 13. CI/CD release pipeline

Replace `.github/workflows/deploy-api.yml`; do not SSH to a mutable server. AWS recommends GitHub
OIDC and short-lived role credentials instead of IAM user access keys. Scope the trust policy to the
exact organization, repository, branch, or protected GitHub Environment. See [AWS's GitHub OIDC
guide](https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/).

### Pull request pipeline

```text
checkout
  -> pnpm install --frozen-lockfile
  -> prisma generate
  -> lint
  -> type-check
  -> unit tests
  -> both production builds
  -> build exact API image
  -> run image as non-root and call liveness locally
  -> scan dependencies/image
  -> inspect migration SQL and fail on unsafe patterns requiring approval
```

Run independent lint/type/test/build jobs concurrently after install/cache restore where the workflow
allows it.

### Production deployment pipeline

```text
protected main + manual production approval
  -> assume narrowly scoped AWS role through OIDC
  -> build API image once
  -> push immutable git-SHA tag to ECR and capture digest
  -> run migration task with that digest and migrator secret
  -> wait for success; stop on any migration failure
  -> update the ECS Express service to that immutable image
  -> watch the canary deployment, target health and 5xx rollback alarm
  -> smoke API live/ready/public read/login-negative path
  -> trigger/allow Amplify production build
  -> smoke EN/VI/JA homepage, blog, static asset and media
  -> record SHA, digest, migration IDs, test URLs and operator
```

Production should be a GitHub Environment with required reviewer(s) and concurrency set to one so
two deployments cannot migrate simultaneously.

### Rollback

- **Application failure, compatible DB:** redeploy the previous known-good ECR digest and retest.
- **Amplify failure:** redeploy the previous successful Amplify build.
- **Migration failure before app deploy:** leave the old app running, investigate the migration
  task, and do not mark failed migrations manually without a reviewed recovery procedure.
- **Destructive/data failure:** stop writes, snapshot, restore to a new RDS instance or execute the
  tested data repair plan. Do not assume `migrate reset` or application rollback recovers data.

All normal migrations must be backward-compatible precisely so the previous container can run
after a rollback.

## 14. Monitoring, SLOs, and alerting

### Service objectives

Measure monthly, excluding declared maintenance only if that policy is written in advance:

| Objective                          | Target                                                        |
| ---------------------------------- | ------------------------------------------------------------- |
| Public site availability           | 99.9%                                                         |
| API availability                   | 99.9% after durable profile; measure value profile separately |
| Public API p95                     | under 200 ms                                                  |
| Warm public TTFB in primary region | under 800 ms                                                  |
| API 5xx rate                       | under 0.1%                                                    |
| Mobile LCP / INP / CLS p75         | <2.5 s / <200 ms / <0.10                                      |
| Contact record durability          | 100% of accepted responses have a DB row                      |
| Backup objective                   | RPO <= 5 minutes target, RTO <= 120 minutes until measured    |

SLOs are not alarm thresholds. Alert only when a human can act; dashboards can be more detailed.

### Logs

| Log                             |                                  Retention | Notes                                                    |
| ------------------------------- | -----------------------------------------: | -------------------------------------------------------- |
| ECS API application             |                                    30 days | JSON, request IDs, redacted                              |
| ECS/ALB deployment and events   |                                    90 days | release investigation                                    |
| Amplify SSR                     |                                    30 days | runtime errors and duration                              |
| RDS PostgreSQL/upgrade          |                                    30 days | slow queries/errors; control volume                      |
| WAF sampled requests            |                                 14–30 days | redact cookies and authorization headers                 |
| ALB access logs                 |                                 30–90 days | encrypted S3 bucket; useful for response/abuse analysis  |
| CloudFront standard access logs | 90 days hot, then lifecycle/archive/delete | optional at very low traffic; useful for abuse/analytics |
| CloudTrail management trail     | policy-dependent, usually >= 90 days in S3 | protect and lifecycle the log bucket                     |

CloudWatch log groups retain indefinitely unless a retention policy is set, so create retention in
Terraform. See [CloudWatch log retention](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html).

### Metrics and initial alarms

| Layer            | Metric/alarm                               | Starting threshold                                             |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------- |
| Synthetic        | homepage or API readiness fails            | 2 consecutive regions/runs or 3 consecutive single-region runs |
| ALB              | `HTTPCode_Target_5XX_Count` / requests     | >=5 in 5 min **and** >1% of requests                           |
| ALB              | `TargetResponseTime` p95                   | >500 ms for 3 of 5 minutes                                     |
| ALB              | `UnHealthyHostCount`                       | >=1 for 2 periods outside an intentional deployment            |
| ECS service      | CPU or memory                              | >80% for 10–15 min                                             |
| ECS/EventBridge  | deployment failed or task repeatedly stops | any; suppress the expected one-off migration completion        |
| RDS              | CPU                                        | >80% for 15 min                                                |
| RDS              | free memory                                | <200 MiB for 15 min; tune after baseline                       |
| RDS              | free storage                               | <20% or projected exhaustion inside 14 days                    |
| RDS              | connections                                | >70% of allowed/application budget                             |
| RDS              | T-class CPU credits                        | low/declining balance or any persistent surplus-charge pattern |
| RDS              | read/write latency                         | above measured baseline for 10 min                             |
| CloudFront media | 5xx rate                                   | >1% with minimum request count                                 |
| SES              | reject/bounce/complaint                    | any abnormal increase; stop sending on reputation risk         |
| WAF              | login/contact/comment block rate           | anomaly over baseline, not every block                         |
| Application      | unhandled exception/mail terminal failure  | >=1 for critical workflow; deduplicate notifications           |
| Backup           | failed backup/restore test                 | any failure                                                    |

ECS publishes service CPU and memory metrics without extra charge, while the ALB publishes target
status, latency, request, and response-code metrics. See [ECS CloudWatch
metrics](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cloudwatch-metrics.html) and
[ALB CloudWatch metrics](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html).

Send actionable alarms to an SNS topic subscribed by an email address independent of the portfolio's
own SES delivery. Use composite alarms or rate math to avoid paging on one harmless 5xx at tiny
traffic volumes. Include service, region, dashboard link, runbook link, last deployment SHA, and a
clear first action in every alarm description.

### Cost-aware observability

- Start with ECS, ALB, and RDS standard metrics plus log metric filters and ECS service events.
- Use Database Insights Standard.
- Add X-Ray/OpenTelemetry with low sampling only after a latency problem or meaningful traffic;
  never sample sensitive bodies.
- Do not enable every high-cardinality custom metric or Container Insights feature reflexively.
- Review CloudWatch ingestion and custom-metric cost monthly. AWS provides specific [CloudWatch cost
  optimization guidance](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_billing.html).
- Use a low-frequency external synthetic for the homepage and `/api/health/ready`. Do not submit the
  real contact form every five minutes.

### Dashboard

One production dashboard should answer, in order:

1. Is the public site/API reachable?
2. Are errors or latency rising?
3. Is ECS capacity constrained or are targets unhealthy?
4. Is RDS constrained or near storage/connection limits?
5. Did the last deployment correlate with the change?
6. Are media, SES, or WAF abnormal?
7. What is current month cost versus budget?

## 15. Security baseline

### Account and operator access

- Hardware/passkey MFA on root, no root access keys, and documented recovery contacts.
- IAM Identity Center or roles with temporary credentials for daily administration.
- GitHub OIDC for CI/CD; no `AWS_ACCESS_KEY_ID` GitHub secrets.
- Separate production and non-production AWS accounts when practical; at minimum, separate roles,
  VPCs, secrets, databases, buckets, domains, and budgets.
- CloudTrail enabled and alarm on root use, console login without MFA, IAM policy/role changes,
  CloudTrail changes, security-group changes, and RDS deletion/protection changes.

AWS strongly recommends temporary role credentials, root MFA, and no root access keys. See [IAM
root-user best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html).

### Application and perimeter

- WAF managed core/common rule group in count mode first, inspect false positives, then block.
- Rate rules scoped to `POST /api/auth/login`, `POST /api/contact`, comment-token and comment-submit
  paths; use lower thresholds on login/contact.
- Keep Nest validation whitelist, sanitization, honeypot, HMAC token, and spam shield.
- Add explicit maximum body sizes at proxy/application level.
- Security headers on both web and API; define a measured CSP rather than relying only on Helmet
  defaults.
- Admin pages `noindex`; never treat obscurity as authorization.
- Store admin JWT only in the API's httpOnly cookie. Shorten the current 24-hour lifetime if the
  admin workflow permits and rotate `JWT_SECRET` through a planned logout event.
- Add account lock/backoff and an audit record for admin login failures/successes without storing
  passwords or tokens.

Associate the regional AWS WAF web ACL with the internet-facing ALB. ALB is a supported WAF
resource, and rate-based rules aggregate across all tasks. See the [AWS WAF service
guide](https://docs.aws.amazon.com/waf/).

### Secrets

Store at least:

- runtime database URL;
- migrator database URL;
- JWT, comment-token, IP-hash, and optional revalidation secrets;
- SES SMTP credentials until the SDK provider replaces them;
- one-time bootstrap admin password.

Generate independent random values; do not reuse one secret for JWT, comments, IP hashing, or cache
control. Grant each role only the secret ARNs it needs. Rotate and force a new ECS deployment,
because running tasks retain their injected value. AWS recommends Secrets Manager, encryption,
least privilege, rotation, monitoring, and private networking in [Secrets Manager best practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html).

## 16. Backup, recovery, and data lifecycle

### RDS

- Automated backups/PITR: 14 days.
- Final snapshot required on deletion; deletion protection on.
- Manual pre-change snapshot only for genuinely risky migrations—not every harmless release.
- Monthly snapshot retained 90 days if the data's value warrants it.
- Quarterly restore into an isolated subnet/database, run schema checks and representative reads,
  record actual RTO, then delete the restore.
- After the procedure is stable, AWS Backup can automate periodic restore testing for RDS. See [AWS
  Backup restore testing](https://docs.aws.amazon.com/aws-backup/latest/devguide/restore-testing.html).

### S3 and configuration

- S3 versioning plus noncurrent-version lifecycle gives operator-error recovery.
- Terraform state bucket: versioning, encryption, public access blocked, tightly scoped role, and
  locking enabled.
- ECR keeps known-good production digests even when unreferenced image cleanup runs.
- Source, migration SQL, IaC, runbooks, and dashboards are version controlled.
- Exporting PostgreSQL dumps to a laptop is not the backup strategy; encrypted off-account/cross-
  Region backup is a later resilience control if the portfolio data becomes irreplaceable.

### Recovery drill acceptance test

1. Restore RDS to a new endpoint from a selected point in time.
2. Run migration status without changing it.
3. Verify admin/profile/settings/post/comment/contact row counts and latest timestamps.
4. Point an isolated staging API at the restored database.
5. Test public reads and an authenticated read; do not send real email or mutate production S3.
6. Record recovery point, latest restorable time, start/end timestamps, failures, and actual RPO/RTO.
7. Destroy the isolated restore only after evidence is captured.

## 17. Cost model and controls

These are planning ranges, not a quote. Singapore pricing, traffic, build frequency, backup size,
tax, logs, WAF rules, and data transfer materially change the result. Create an AWS Pricing
Calculator estimate from Terraform's planned resources before approval.

### Realistic monthly planning ranges at low traffic

| Profile/component               | Planning range (USD/month) | Main driver                                    |
| ------------------------------- | -------------------------: | ---------------------------------------------- |
| Amplify web                     |                      $1–10 | build minutes, transfer, SSR duration          |
| Fargate API task                |                     $18–35 | chosen CPU/memory, architecture and task-hours |
| ALB + public IPv4 + low LCU use |                     $22–40 | ALB hours, LCU hours, addresses                |
| RDS Single-AZ + 20 GiB          |                     $20–45 | regional instance/storage/backup price         |
| S3 + CloudFront media           |                      $1–10 | media bytes and egress                         |
| SES                             |                        <$1 | tiny message volume; attachments/data extra    |
| WAF                             |                      $7–25 | web ACL, rules, requests/CAPTCHA if used       |
| Route 53, secrets, logs, alarms |                      $5–20 | log ingestion/retention and secret count       |
| **Typical value profile**       |        **roughly $70–145** | verify exact Singapore prices in calculator    |

Multi-AZ RDS, private tasks plus NAT, high log volume, Amplify WAF, heavy SSR, or significant media
egress can move the total well above that range. The ALB, one continuously running Fargate task, and
RDS form most of the fixed floor. Use the [Fargate pricing](https://aws.amazon.com/fargate/pricing/)
and [Elastic Load Balancing pricing](https://aws.amazon.com/elasticloadbalancing/pricing/) pages with
the AWS Pricing Calculator; do not copy US example prices into a Singapore approval.

If the hard ceiling is below roughly $60/month, this managed target is unlikely to fit because the
ALB and RDS are fixed costs. A single Graviton EC2 or Lightsail host can be cheaper, but combining API
and database on one host creates one failure domain and returns patching, backups, capacity,
deployment safety, and recovery to the operator. Treat that as an explicitly accepted hobby/budget
profile—not as an equivalent production architecture.

### Cost controls from day one

1. Required tags on supported resources: `Application=jazz-portfolio`, `Environment`, `Owner`,
   `ManagedBy=terraform`, `CostCenter`.
2. Activate cost-allocation tags.
3. Monthly AWS Budget alerts at 50%, 80%, 100%, and forecast >100%; add a small absolute daily
   anomaly threshold.
4. Enable Cost Anomaly Detection for the account/application. AWS recommends combining budgets and
   anomaly detection in the [Well-Architected cost controls](https://docs.aws.amazon.com/wellarchitected/latest/framework/cost_govern_usage_controls.html).
5. Explicit CloudWatch log retention; sample traces; no high-cardinality metric labels such as raw
   user ID, slug, email, or request ID.
6. ECS maximum tasks = 3 initially to cap surprise compute; alarm when at maximum under load.
7. Delete dormant staging Express services and remove closed PR previews; do not leave an ALB and
   task running for an unused environment.
8. Avoid NAT unless an external runtime dependency proves necessary.
9. Keep S3/CloudFront objects immutable and optimized; do not send original oversized images when
   Next/CloudFront can serve smaller forms.
10. Review Cost Explorer monthly; right-size only after CPU, memory, connections, latency, and
    traffic have at least 2–4 weeks of data.
11. Consider RDS Reserved Instances only after the class and availability profile stabilize.

AWS Budgets data updates at least daily, so budgets are not a real-time kill switch. See [AWS
Budgets best practices](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html)
and [Cost Anomaly Detection](https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html).

## 18. Practical implementation sequence

### Phase A — decisions and safety (day 1)

- [ ] Confirm the production domain and expected audience geography.
- [ ] Confirm `ap-southeast-1` by testing latency from the main audience; keep all regional services
      together.
- [ ] Choose value or durable database profile and write the accepted RTO/RPO.
- [ ] Secure root/operator access, enable billing visibility, create budget/anomaly alerts.
- [ ] Protect the GitHub production environment and configure AWS OIDC.

### Phase B — application readiness (days 1–3)

- [ ] Implement P0 code changes and the split seed modes.
- [ ] Add `db:migrate:deploy` to `packages/database/package.json`.
- [ ] Create tested non-root production API image and document its local smoke command.
- [ ] Implement JSON logs, proxy/IP correctness, and sensitive-field redaction.
- [ ] Decide SES SMTP now versus SES SDK follow-up.
- [ ] Run the full repository quality gate and record baseline bundle/load-test results.

### Phase C — Terraform foundation (days 3–5)

Pin and lock a tested HashiCorp AWS provider version containing
`aws_ecs_express_gateway_service`; AWS documents both Terraform and CloudFormation support. Confirm
that the selected provider exposes the generated ALB/listener/log-group identifiers required for
WAF, custom-domain, and logging resources. If not, use the Cloud Control
`awscc_ecs_express_gateway_service` or CloudFormation resource for this one service instead of
discovering resources by fragile generated names. Keep a single IaC owner for each generated
setting.

- [ ] Remote encrypted/versioned Terraform state and locking.
- [ ] VPC, public API subnets, private DB subnets, routes, internet gateway, and security groups.
- [ ] Private RDS with backups/deletion protection and Database Insights.
- [ ] S3 bucket, OAC, CloudFront, certificates, and DNS.
- [ ] ECR, ECS Express roles/service, ALB custom domain/certificate, WAF, secrets/parameters.
- [ ] Release-job task definition and log groups.
- [ ] SNS, alarms, dashboard, backup notifications, tags.

Run `terraform fmt`, `validate`, static security checks, and `plan`; require human review for
production apply. Import or deliberately replace existing hand-created resources—never create
duplicates blindly.

### Phase D — staging rehearsal (days 5–6)

- [ ] Deploy isolated staging infrastructure or at least an isolated staging DB/API.
- [ ] Run migration and bootstrap from a fresh database.
- [ ] Test upload/finalize/read through CloudFront.
- [ ] Test SES delivery and failure behavior.
- [ ] Test login/cookie/CORS/CSRF behavior with real staging domains.
- [ ] Load-test portfolio, blog list/detail, comments, and admin stats.
- [ ] Force an unhealthy canary image and prove ECS deployment rollback.
- [ ] Restore a DB backup and run the recovery acceptance test.

### Phase E — production launch (day 7)

- [ ] Lower DNS TTL one day before any existing-domain cutover.
- [ ] Apply production Terraform and verify guardrails.
- [ ] Migrate and bootstrap once; verify no demo data/default password.
- [ ] Deploy API by digest; readiness and smoke tests green.
- [ ] Deploy Amplify; verify EN/VI/JA, admin, blog, contact, media, sitemap, robots, and RSS.
- [ ] Confirm timed cache behavior after a CMS edit (60–300 seconds).
- [ ] Confirm every alarm and SNS subscription; run one controlled test alarm.
- [ ] Restore normal DNS TTL and record the release.

### Phase F — 24 hours and 30 days after launch

- [ ] Review WAF false positives, 4xx/5xx, latency, memory, DB connections, slow queries, SES
      reputation, cache behavior, and cost.
- [ ] Right-size Fargate/RDS from data, not intuition.
- [ ] Close unused secrets, previews, images, snapshots, public IPs, and log groups.
- [ ] Decide whether Multi-AZ or reserved pricing is justified.
- [ ] Schedule the next recovery drill and dependency/base-image update.

## 19. Operator runbooks

### API is returning 5xx

1. Check the external synthetic, ALB target 5xx rate/latency/health, and last deployment time.
2. Inspect JSON logs by request ID and deployment SHA; do not begin by restarting blindly.
3. Check ECS CPU/memory/task events and RDS availability/connections/free memory.
4. If release-correlated and DB-compatible, redeploy the previous digest.
5. If database-correlated, stop high-cost writes, inspect Database Insights/slow queries, and scale
   only after identifying the bottleneck.
6. Record impact window, cause, fix, and a preventive action.

### Database storage or connections are high

1. Confirm whether the signal is real and sustained, not a deployment task.
2. Identify top SQL and connection sources in Database Insights/`pg_stat_activity`.
3. For connections, cap ECS tasks, verify `connection_limit`, and terminate only confirmed leaked
   sessions.
4. For storage, identify table/index growth; do not depend on autoscaling during a large load.
5. Raise storage/class deliberately and update Terraform immediately to avoid drift.

RDS storage autoscaling begins under sustained low-space conditions and cannot scale storage back
down, so set a bounded ceiling and monitor it. See [RDS storage autoscaling](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIOPS.Autoscaling.html).

### CMS content looks stale

1. Confirm the API returns the new value.
2. Confirm whether the page's timed window is 60 or 300 seconds.
3. Wait through one full window and request again; inspect Amplify SSR logs on revalidation failure.
4. Do not rely on `/api/revalidate` while hosted on Amplify.
5. For an urgent public correction, redeploy Amplify or temporarily reduce the timed interval in a
   reviewed release; do not purge unrelated media.

### Contact email did not arrive

1. Verify the contact row exists; preserve it.
2. Inspect mail-attempt/outbox state or the structured failure log.
3. Check SES send/reject/bounce/complaint metrics and sandbox/identity status.
4. Retry through the idempotent job, not by recreating the contact submission.
5. If SES is impaired, keep accepting/storing messages if the DB is healthy and alert the admin.

### Suspected secret exposure

1. Disable/rotate the specific secret; do not rotate unrelated secrets reflexively.
2. Force a new ECS deployment so referenced values refresh.
3. Invalidate admin sessions when rotating JWT secrets.
4. Review CloudTrail, ECS/ALB/WAF logs, S3 access, RDS connections, and GitHub run history.
5. Remove long-lived AWS keys entirely if any were used; replace with roles/OIDC.
6. Document scope, timeline, evidence, and follow-up controls.

## 20. Go-live acceptance checklist

### Application

- [ ] CI is green for lint, type-check, tests, and both builds.
- [ ] Exact ECR image starts, serves live/ready, and runs non-root.
- [ ] Swagger is absent or protected in production.
- [ ] Proxy IP, CORS, cookies, Origin/CSRF, rate limiting, redaction, and graceful shutdown tested.
- [ ] Timed ISR behavior is understood and signed off.

### Data

- [ ] RDS private, encrypted, TLS, backup retention, final snapshot, deletion protection.
- [ ] Runtime and migrator DB users/secrets separated.
- [ ] `migrate deploy` only; current production `db push` removed.
- [ ] Production bootstrap creates no known password or demo data.
- [ ] Restore test passed and actual RTO/RPO recorded.

### Infrastructure/security

- [ ] Terraform plan reviewed; state protected and locked.
- [ ] No production SSH key, IAM user access key, or AWS credential environment variables.
- [ ] S3 public access blocked; CloudFront OAC is the only read path.
- [ ] ALB WAF rules reviewed in count mode before blocking.
- [ ] Secrets scoped to roles; root MFA and GitHub OIDC verified.

### Operations/cost

- [ ] Logs have explicit retention and no sensitive payloads.
- [ ] Dashboard, synthetic, RDS/ECS/ALB/SES/WAF/backup alarms are green.
- [ ] SNS subscriptions confirmed and one alarm tested.
- [ ] Budget and anomaly alerts configured.
- [ ] Pricing Calculator estimate attached to the change and compared with the first bill.

## 21. Source ledger

AWS documentation consulted for this assessment:

- [Amplify support for Next.js](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html)
- [Deploy SSR apps with Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/server-side-rendering-amplify.html)
- [Amplify pricing](https://aws.amazon.com/amplify/pricing/)
- [ECS Express Mode overview](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html)
- [ECS Express Mode resources and defaults](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-work.html)
- [Getting started with ECS Express Mode](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-getting-started.html)
- [ECS Express Mode advanced customization](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-advanced-customization.html)
- [Updating an ECS Express Mode service](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-update-full.html)
- [Fargate or Lambda decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/fargate-or-lambda.html)
- [App Runner availability change](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html)
- [App Runner new-customer cutoff notice](https://docs.aws.amazon.com/apprunner/latest/api/API_CreateService.html)
- [ECS task container security](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-tasks-containers.html)
- [ECS IAM roles](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-iam-roles.html)
- [ECS service metrics](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cloudwatch-metrics.html)
- [ALB metrics](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html)
- [Secrets Manager values in ECS tasks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html)
- [AWS WAF](https://docs.aws.amazon.com/waf/)
- [RDS best practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [RDS PostgreSQL TLS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html)
- [RDS automated backup retention](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.BackupRetention.html)
- [RDS storage autoscaling](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIOPS.Autoscaling.html)
- [CloudWatch Database Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Database-Insights.html)
- [S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)
- [CloudFront OAC for S3](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [SES production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- [GitHub Actions to AWS with OIDC](https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/)
- [Secrets Manager best practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [CloudWatch cost optimization](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_billing.html)
- [AWS Backup restore testing](https://docs.aws.amazon.com/aws-backup/latest/devguide/restore-testing.html)
- [AWS Budgets best practices](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html)
- [AWS Cost Anomaly Detection](https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html)
- [Terraform AWS ECS Express resource](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecs_express_gateway_service)

## 22. Final recommendation in one paragraph

Launch the globally cached Next.js site on Amplify, run the NestJS container on ECS Express Mode on
Fargate behind its ALB, connect it to private RDS, and serve immutable media from private S3 through
CloudFront OAC. The value profile deliberately assigns public IPs to tightly locked-down API tasks
so SES and other outbound services work without permanent NAT; graduate to standard ECS with
private tasks when policy justifies the added networking cost. Start RDS small and Single-AZ only
with an explicitly accepted recovery objective, strong PITR/restore testing, and a clear Multi-AZ
trigger. Before go-live, replace SSH/Compose/`db push`, split the unsafe demo seed from a guarded
one-time production bootstrap, fix readiness/proxy/logging/media/email reliability, and deliver
immutable images through GitHub OIDC and canary deployments. Treat Amplify's lack of on-demand ISR
as a known 60–300 second freshness trade-off; containerize the web tier only if that becomes a real
product requirement.
