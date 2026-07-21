# 🎷 Detailed AWS Service Specifications & Configurations

This document details the configuration, security rules, and roles of the AWS services used to host the Jazz Portfolio application.

---

## 1. Amazon EC2 (Elastic Compute Cloud)
Virtual computing environments (instances) that host our Dockerized NestJS API.

### Configuration Specification
- **Instance Type:** `t4g.micro` (ARM64 architecture powered by AWS Graviton2 processors). It offers a 40% price-performance improvement over comparable `t3` x86 instances.
- **Operating System:** Amazon Linux 2023 AMI.
- **Volume:** 8GB GP3 EBS (Elastic Block Store) root volume.

### Security Group Configuration (Stateful Firewall)
| Type | Protocol | Port Range | Source | Purpose |
|---|---|---|---|---|
| Inbound | TCP | 22 | My IP (`/32`) | Secure SSH Administration |
| Inbound | TCP | 3001 | `0.0.0.0/0` | Public API access |
| Outbound | TCP | All | `0.0.0.0/0` | Access external APIs and packages |

---

## 2. Amazon RDS (Relational Database Service)
Managed relational database engine running PostgreSQL, handling database patching, backups, and scaling.

### Configuration Specification
- **Engine Version:** PostgreSQL 16.x.
- **Instance Class:** `db.t4g.micro` (1 vCPU, 1GB RAM) — eligible for AWS Free Tier.
- **Storage:** 20GB gp3 SSD with auto-scaling enabled (allocates more storage automatically if space runs low).
- **Multi-AZ:** Disabled for Free Tier (can be enabled in production for high availability).
- **Backups:** Automated daily backups with a 7-day retention period.

### Networking & Security Group
- **Subnet Group:** Placed in Private Subnets across two Availability Zones (AZs).
- **Public Access:** Disabled (requires VPC Peering or SSH tunneling to access).
- **RDS Security Group Rules:**
  - **Inbound:** Allow TCP port `5432` from the **EC2 Security Group ID** only.
  - **Outbound:** Deny all outbound traffic (highly secure).

---

## 3. Amazon S3 (Simple Storage Service)
Object storage service designed for storing assets like audio tracks, images, and documents.

### Configuration Specification
- **Bucket Name:** `jazz-portfolio-media` (must be globally unique).
- **Block Public Access:** Enabled. All objects are private by default.
- **Encryption:** Server-Side Encryption with Amazon S3 managed keys (SSE-S3) enabled by default.
- **CORS Policy (Cross-Origin Resource Sharing):** Configured to allow Next.js browsers to upload files directly via presigned URLs:
  ```json
  [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "GET", "POST", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
  ```

---

## 4. Amazon CloudFront
Content Delivery Network (CDN) that caches assets globally at AWS Edge locations, reducing latency.

### Configuration Specification
- **Origin:** The `jazz-portfolio-media` S3 bucket.
- **Origin Access:** Origin Access Control (OAC) enabled. CloudFront signs all requests to S3, allowing the S3 bucket to remain private.
- **Viewer Protocol Policy:** Redirect HTTP to HTTPS.
- **Default TTL (Time to Live):** 24 hours. Media assets (songs, images) change rarely, so caching them long-term reduces latency and AWS data egress costs.

### S3 Bucket Policy (OAC Configured)
Paste this policy into your S3 bucket settings to grant CloudFront access to S3 objects:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::jazz-portfolio-media/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR_AWS_ACCOUNT_ID:distribution/YOUR_CF_DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

---

## 5. AWS Amplify
A fully managed service for deploying and hosting serverless web applications.

### Configuration Specification
- **Framework:** Next.js 15 (App Router). Amplify automatically provisions the server-side rendering (SSR) compute environment.
- **Monorepo Build App Root:** `apps/web`
- **SSL/TLS:** Free managed certificates generated automatically via Amazon Trust Services.
- **Deployment Webhook:** Listens for pushes to the `main` branch on GitHub to trigger builds.

---

## 6. AWS IAM (Identity & Access Management)
Provides secure access control for AWS services and resources.

### 1. EC2 Instance IAM Role
Allows the NestJS API running on EC2 to request presigned upload URLs from S3 without hardcoding access keys on the instance.
- **Policy Definition (`s3-presign-policy`):**
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject"
        ],
        "Resource": "arn:aws:s3:::jazz-portfolio-media/*"
      }
    ]
  }
  ```

### 2. CI/CD Deployment IAM User
Allows GitHub Actions to deploy updates to EC2.
- **Required Policies:**
  - `AmazonEC2ReadOnlyAccess`
  - Custom policy allowing SSH key associations or SSM Session Manager access to run deploy scripts.
