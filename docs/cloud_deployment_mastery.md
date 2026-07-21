# ☁️ Cloud Deployment, AWS Infrastructure & CI/CD Mastery

This document outlines the architecture, deployment strategies, and operational best practices for hosting the Jazz Portfolio project on AWS. It is written to serve as a transferrable guide for running production-grade web applications in the cloud.

---

## 1. AWS Production Architecture Blueprint

The Jazz Portfolio project uses a hybrid architecture that balances ease of deployment with operational control.

```
                  +-----------------------------------+
                  |           AWS Cloud VPC           |
                  |                                   |
                  |   +---------------------------+   |
                  |   |   Public Subnet           |   |
                  |   |                           |   |
                  |   |   +-------------------+   |   |
                  |   |   | AWS EC2 (NestJS)  |<------+--- [API Requests (Port 3001)]
                  |   |   +---------+---------+   |   |
                  |   +-------------|-------------+   |
                  |                 | (VPC Peering)   |
                  |   +-------------v-------------+   |
                  |   |   Private Subnet          |   |
                  |   |                           |   |
                  |   |   +-------------------+   |   |
                  |   |   | AWS RDS Postgres  |   |   |
                  |   |   +-------------------+   |   |
                  |   +---------------------------+   |
                  +-----------------------------------+

[Browser UI] ----> +---------------------+
                   | AWS Amplify Hosting | (Serves Next.js Frontend)
                   +---------------------+

[Media Uploads] -> +---------------------+
                   | AWS S3 + CloudFront | (Media CDN)
                   +---------------------+
```

### Infrastructure Components & Roles

1. **Virtual Private Cloud (VPC):** Creates an isolated virtual network. The EC2 instance resides in a public subnet to accept API traffic, while the RDS database resides in a private subnet, blocking all direct access from the public internet.
2. **AWS Amplify Hosting:** Manages the Next.js frontend. It handles SSL certificate generation, CDN edge caching, and automatically deploys builds on Git commits.
3. **AWS S3 + CloudFront CDN:** S3 stores uploaded media and tracks. CloudFront sits in front of S3 as a Content Delivery Network (CDN) to cache media files globally, reducing latency and offloading traffic from S3.
4. **AWS EC2 (Elastic Compute Cloud):** A virtual server running a Docker container with our NestJS API.
5. **AWS RDS (Relational Database Service):** A managed PostgreSQL instance that handles database replication, automated backups, OS patching, and storage scaling.

---

## 2. Infrastructure Security Hardening

Security in the cloud is based on the **Principle of Least Privilege**. Every service should have access *only* to the resources it requires to function.

### 1. Securing S3 with Origin Access Control (OAC)
By default, S3 buckets are private. To serve files through CloudFront, developers often make the S3 bucket public. This is a security risk.
- **Best Practice:** Keep the S3 bucket private. Configure CloudFront to use **Origin Access Control (OAC)**. OAC signs requests from CloudFront to S3, allowing S3 to verify that traffic originates from your CloudFront distribution and block all other requests.

### 2. Network Security Groups
Security Groups act as virtual firewalls for your AWS resources:
- **EC2 Security Group:** Allows inbound TCP traffic on port `22` (restricted to your IP address or GitHub Runner IP ranges) and port `3001` (from all sources or restricted to the Amplify origin proxy).
- **RDS Security Group:** Allows inbound TCP traffic on port `5432` *only* from the EC2 Security Group. No database ports are exposed to the public internet.

### 3. IAM (Identity & Access Management) Roles
Our NestJS backend requests presigned URLs from S3. Instead of hardcoding root AWS credentials in your server's `.env` file:
- **Best Practice:** Create an IAM Role with a policy restricted to `s3:PutObject` and `s3:GetObject` on the `jazz-portfolio-media` bucket. Associate this role directly with the EC2 instance, allowing the AWS SDK to retrieve temporary, rotating credentials automatically.

---

## 3. Secure Secret Management

Hardcoding api keys, database credentials, or JWT secrets in source code leads to security breaches.

### The Secrets Hierarchy
1. **Local Development:** Use `.env` files (make sure they are added to your `.gitignore`).
2. **CI/CD Pipelines:** Store SSH keys and deploy target variables as **GitHub Secrets**.
3. **Production Cloud Runtime:** Use a dedicated secrets manager:
   - **AWS Systems Manager Parameter Store:** Ideal for standard configuration variables.
   - **AWS Secrets Manager:** A more robust service that supports automated database credential rotation and encryption.

*How it works in production:* During the build phase, the Docker container retrieves secrets from the Parameter Store or Secrets Manager, injecting them as runtime environment variables without writing them to disk.

---

## 4. The CI/CD Pipeline Lifecycle

Continuous Integration (CI) and Continuous Deployment (CD) automate the testing and release of software updates, reducing manual errors.

```
 [Push to GitHub] 
        |
        v
 +--------------+
 |  CI Phase    | ---> Run linter checks (ESLint)
 |  (GitHub)    | ---> Verify TypeScript type-safety (tsc)
 +------+-------+ ---> Run compilation checks (build tests)
        |
        | (If successful & merged to main)
        v
 +--------------+
 |  CD Phase    | ---> Connect via SSH to EC2
 |  (GitHub)    | ---> Pull latest code changes
 +------+-------+ ---> Rebuild Docker container (`docker compose up --build`)
        |
        v
 [App Server Up] ---> Execute pending Prisma migrations (`db:push` / `migrate deploy`)
```

### Essential CI/CD Best Practices
- **Idempotency:** Pipelines should be repeatable. Re-running a failed pipeline step should not alter your infrastructure's state.
- **Fail Fast:** Place fast, lightweight checks (like code formatting and linting) at the beginning of your pipeline, before slow operations (like Docker builds and integration tests).
- **Environment Isolation:** Maintain separate `develop` and `main` branches that deploy to staging and production environments, respectively.

---

## 5. Zero-Downtime Database Migrations

Applying database migrations in production is risky. If a migration alters or drops a table while your application is running, it can cause database downtime or application crashes.

### 1. Rolling Migrations
When using Docker Compose to update services, the old API container is stopped before the new container starts. This causes a short window of downtime.
- **Solution:** In production, use a container orchestrator (like AWS ECS or Kubernetes) to run a **Rolling Update**. The orchestrator starts the new container version, health checks it, and routes traffic to it before stopping the old version.

### 2. Multi-Phase (Expand & Contract) Schema Changes
If you need to rename a database column (e.g. changing `username` to `email`), doing it in a single step will crash the running app version.
- **Best Practice:** Use a three-step **Expand and Contract** pattern:
  1. **Expand:** Add the new column `email` and update the application code to write to both columns.
  2. **Backfill:** Copy existing data from `username` to `email`.
  3. **Contract:** Update the application to read only from `email`, then run a migration to drop the old `username` column.

---

## 6. Observability: Logging & Monitoring

Once an application is running in the cloud, you must monitor its health to respond to outages and performance bottlenecks.

### 1. Structured Logging
Never rely on `console.log` for production logging. It prints unstructured text that is difficult to parse.
- **Best Practice:** Use a structured logging library like **Winston** or **Pino** to output logs as JSON. This allows search tools to query log attributes (such as `userId` or `statusCode`) easily:
  ```json
  {"level":"error","message":"Database connection timeout","timestamp":"2026-07-12T13:20:00Z","context":"PrismaService"}
  ```

### 2. Log Aggregation
EC2 instances can be terminated or replaced. Storing logs on the host's disk is risky because they are deleted when the host is replaced.
- **Solution:** Configure your Docker containers to stream logs to **AWS CloudWatch** or a log aggregation tool (like Datadog or ELK).

### 3. Key Metrics to Monitor
- **Infrastructure Metrics:** CPU utilization, memory usage, and disk space.
- **Application Metrics:** Response latency, request rates, and HTTP 5xx error rates.
- **Database Metrics:** Concurrent connection counts and CPU usage. Set up alerts to notify you if connection limits are reached.
