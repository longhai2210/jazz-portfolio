# 🏗️ Infrastructure as Code: Complete Deployment Guide

This guide converts **every piece** of the Jazz Portfolio AWS architecture into Terraform code. After following this, your entire cloud infrastructure is version-controlled, repeatable, and destroyable with a single command.

---

Maps every component from your cloud deployment mastery doc to Terraform code:

VPC, subnets, internet gateway → networking/ module
Security groups + IAM roles → security/ module
EC2 with user_data bootstrap → compute/ module
RDS PostgreSQL with encryption + auto-scaling storage → database/ module
S3 + CloudFront with OAC (private bucket, signed requests) → storage/ module
Secrets Manager → secrets/ module
CloudWatch alarms + SNS email alerts → monitoring/ module
Amplify frontend auto-deploy → amplify/ module
GitHub Actions workflow for automated terraform plan → apply

## Quick Answer: Can All of It Be Done with IaC?

**Yes. 100%.** Every component in the cloud deployment mastery doc can be provisioned, configured, and managed through Infrastructure as Code:

| Component            | IaC Tool                  | Fully Automatable? |
| -------------------- | ------------------------- | ------------------ |
| VPC + Subnets        | Terraform                 | ✅                 |
| Security Groups      | Terraform                 | ✅                 |
| EC2 Instance         | Terraform                 | ✅                 |
| RDS PostgreSQL       | Terraform                 | ✅                 |
| S3 Bucket            | Terraform                 | ✅                 |
| CloudFront + OAC     | Terraform                 | ✅                 |
| IAM Roles & Policies | Terraform                 | ✅                 |
| Secrets Manager      | Terraform                 | ✅                 |
| CloudWatch Logging   | Terraform                 | ✅                 |
| Amplify Hosting      | Terraform                 | ✅                 |
| CI/CD Pipeline       | GitHub Actions (YAML)     | ✅                 |
| DNS / SSL            | Terraform (Route53 + ACM) | ✅                 |

---

## Project Structure

```
infrastructure/
├── main.tf              # Provider config + module calls
├── variables.tf         # Input variables
├── outputs.tf           # What Terraform prints after apply
├── terraform.tfvars     # Your actual values (NEVER commit this)
├── .gitignore           # Must include *.tfvars and .terraform/
│
├── modules/
│   ├── networking/      # VPC, subnets, internet gateway
│   ├── security/        # Security groups, IAM roles
│   ├── compute/         # EC2 instance
│   ├── database/        # RDS PostgreSQL
│   ├── storage/         # S3 + CloudFront
│   ├── secrets/         # Secrets Manager
│   └── monitoring/      # CloudWatch
│
└── environments/
    ├── dev.tfvars        # Dev-specific values
    └── prod.tfvars       # Prod-specific values
```

> **Why modules?** Each folder handles one concern. You can reuse them across projects and environments. Change one variable to switch between dev and prod.

---

## 1. Provider & Backend Setup

**File: `main.tf`**

```hcl
# Tell Terraform: "I'm working with AWS, in this region"
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Store state remotely so your team shares the same truth
  # Without this, state lives on YOUR laptop only
  backend "s3" {
    bucket         = "jazz-portfolio-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "terraform-locks"  # Prevents two people from applying at once
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "jazz-portfolio"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}
```

> **What is state?** Terraform keeps a file (`terraform.tfstate`) that maps your `.tf` code to real AWS resources. Without it, Terraform doesn't know what already exists. Storing it in S3 means your whole team sees the same infrastructure.

---

## 2. Variables

**File: `variables.tf`**

```hcl
variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Environment name (dev or prod)"
  type        = string
}

variable "project_name" {
  description = "Project identifier used in resource naming"
  type        = string
  default     = "jazz-portfolio"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  sensitive   = true  # Terraform will hide this in logs
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "ec2_key_pair_name" {
  description = "Name of the SSH key pair for EC2 access"
  type        = string
}

variable "my_ip" {
  description = "Your IP address for SSH access (e.g. 203.0.113.50/32)"
  type        = string
}
```

**File: `terraform.tfvars`** _(never commit this)_

```hcl
environment       = "prod"
db_username       = "jazz_admin"
db_password       = "super-secret-password-change-me"
ec2_key_pair_name = "jazz-portfolio-key"
my_ip             = "YOUR.IP.ADDRESS.HERE/32"
```

---

## 3. Networking Module (VPC, Subnets, Internet Gateway)

This creates the isolated network from the architecture diagram.

**File: `modules/networking/main.tf`**

```hcl
# The VPC is your isolated network in AWS
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"    # 65,536 IP addresses
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project_name}-vpc" }
}

# Public subnet: EC2 lives here (can receive internet traffic)
resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"  # 256 IPs
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-public-a" }
}

# Private subnets: RDS lives here (NO internet access)
# RDS requires at least 2 subnets in different AZs
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "${var.aws_region}a"

  tags = { Name = "${var.project_name}-private-a" }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "${var.aws_region}b"

  tags = { Name = "${var.project_name}-private-b" }
}

# Internet Gateway: the door between your VPC and the internet
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-igw" }
}

# Route table: tells the public subnet "use this door to reach the internet"
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"            # "all internet traffic"
    gateway_id = aws_internet_gateway.main.id  # "goes through this door"
  }

  tags = { Name = "${var.project_name}-public-rt" }
}

# Link the route table to the public subnet
resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

# RDS subnet group: tells RDS "use these private subnets"
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnets"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = { Name = "${var.project_name}-db-subnet-group" }
}
```

**File: `modules/networking/variables.tf`**

```hcl
variable "project_name" { type = string }
variable "aws_region"   { type = string }
```

**File: `modules/networking/outputs.tf`**

```hcl
output "vpc_id"              { value = aws_vpc.main.id }
output "public_subnet_id"    { value = aws_subnet.public_a.id }
output "db_subnet_group_name" { value = aws_db_subnet_group.main.name }
```

---

## 4. Security Module (Security Groups + IAM)

**File: `modules/security/main.tf`**

```hcl
# ──────────────────────────────────────────────
# EC2 Security Group: controls what traffic reaches the API server
# ──────────────────────────────────────────────
resource "aws_security_group" "ec2" {
  name        = "${var.project_name}-ec2-sg"
  description = "Allow SSH from my IP + API traffic on port 3001"
  vpc_id      = var.vpc_id

  # SSH: only from YOUR IP address
  ingress {
    description = "SSH from admin IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  # API: from anywhere (or restrict to Amplify)
  ingress {
    description = "NestJS API"
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic (so the server can download packages, etc.)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-ec2-sg" }
}

# ──────────────────────────────────────────────
# RDS Security Group: ONLY accepts connections from EC2
# ──────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Allow PostgreSQL from EC2 only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]  # <-- THIS is the key
    # Instead of an IP range, we say "only allow traffic from the EC2 SG"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-rds-sg" }
}

# ──────────────────────────────────────────────
# IAM Role for EC2: lets the server talk to S3 without hardcoded keys
# ──────────────────────────────────────────────

# "Trust policy" — tells AWS: "EC2 instances are allowed to assume this role"
data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2_role" {
  name               = "${var.project_name}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

# "Permission policy" — tells AWS: "this role can PUT and GET objects in our S3 bucket"
data "aws_iam_policy_document" "s3_access" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject"]
    resources = ["arn:aws:s3:::${var.project_name}-media/*"]
  }
}

resource "aws_iam_role_policy" "s3_access" {
  name   = "${var.project_name}-s3-access"
  role   = aws_iam_role.ec2_role.id
  policy = data.aws_iam_policy_document.s3_access.json
}

# Instance profile: the "wrapper" that attaches an IAM role to an EC2 instance
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2_role.name
}
```

---

## 5. Compute Module (EC2)

**File: `modules/compute/main.tf`**

```hcl
# Find the latest Amazon Linux 2023 AMI automatically
# (so you never hardcode an AMI ID that goes stale)
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "api" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type  # "t3.small" for prod, "t3.micro" for dev
  key_name               = var.key_pair_name
  subnet_id              = var.public_subnet_id
  vpc_security_group_ids = [var.ec2_sg_id]
  iam_instance_profile   = var.iam_profile_name

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  # user_data runs ONCE when the instance first boots
  # It installs Docker and starts the application
  user_data = <<-EOF
    #!/bin/bash
    set -e

    # Install Docker
    yum update -y
    yum install -y docker git
    systemctl enable docker && systemctl start docker

    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
      -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    # Clone and start the app
    cd /home/ec2-user
    git clone https://github.com/YOUR_USERNAME/jazz-portfolio.git app
    cd app
    docker-compose up -d --build
  EOF

  tags = { Name = "${var.project_name}-api" }
}

# Elastic IP: a static public IP that survives instance restarts
resource "aws_eip" "api" {
  instance = aws_instance.api.id
  domain   = "vpc"
  tags     = { Name = "${var.project_name}-api-eip" }
}
```

---

## 6. Database Module (RDS PostgreSQL)

**File: `modules/database/main.tf`**

```hcl
resource "aws_db_instance" "postgres" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.db_instance_class  # "db.t3.micro" for dev

  allocated_storage     = 20
  max_allocated_storage = 100   # Auto-scales storage up to 100GB
  storage_type          = "gp3"
  storage_encrypted     = true  # Encrypt data at rest

  db_name  = "jazz_portfolio"
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [var.rds_sg_id]

  # Backups
  backup_retention_period = 7           # Keep 7 days of automated backups
  backup_window           = "03:00-04:00"  # Run backups at 3 AM UTC

  # Maintenance
  maintenance_window      = "Mon:04:00-Mon:05:00"
  auto_minor_version_upgrade = true

  # Protection
  deletion_protection = var.environment == "prod" ? true : false
  skip_final_snapshot = var.environment == "prod" ? false : true
  final_snapshot_identifier = "${var.project_name}-final-snapshot"

  # Don't expose to public internet
  publicly_accessible = false

  tags = { Name = "${var.project_name}-db" }
}
```

> **Key insight:** `deletion_protection` is `true` for prod and `false` for dev. This is the power of IaC — one codebase, different behavior per environment.

---

## 7. Storage Module (S3 + CloudFront with OAC)

**File: `modules/storage/main.tf`**

```hcl
# ──────────────────────────────────────────────
# S3 Bucket: stores media files (kept PRIVATE)
# ──────────────────────────────────────────────
resource "aws_s3_bucket" "media" {
  bucket = "${var.project_name}-media"
  tags   = { Name = "${var.project_name}-media" }
}

# Block ALL public access — CloudFront is the only way in
resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS: allow the frontend to upload directly to S3 via presigned URLs
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT"]
    allowed_origins = ["https://your-domain.com"]
    max_age_seconds = 3600
  }
}

# ──────────────────────────────────────────────
# CloudFront: CDN that sits in front of S3
# ──────────────────────────────────────────────

# Origin Access Control: CloudFront signs requests to S3
# This is what keeps S3 private while still serving files publicly
resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${var.project_name}-media-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "media" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"  # US, Europe, Asia (cheaper than global)

  origin {
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.media.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.media.id}"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 86400   # Cache for 1 day
    max_ttl     = 31536000 # Max cache: 1 year
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = { Name = "${var.project_name}-cdn" }
}

# S3 bucket policy: allow ONLY CloudFront to read from this bucket
resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOnly"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.media.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.media.arn
        }
      }
    }]
  })
}
```

---

## 8. Secrets Module

**File: `modules/secrets/main.tf`**

```hcl
# Store the database connection string in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_url" {
  name                    = "${var.project_name}/${var.environment}/database-url"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0
  # 0 = can delete immediately in dev. 30 = 30-day safety net in prod.

  tags = { Name = "${var.project_name}-db-url" }
}

resource "aws_secretsmanager_secret_version" "db_url" {
  secret_id = aws_secretsmanager_secret.db_url.id
  secret_string = jsonencode({
    DATABASE_URL = "postgresql://${var.db_username}:${var.db_password}@${var.db_endpoint}:5432/jazz_portfolio"
    JWT_SECRET   = var.jwt_secret
  })
}

# Give the EC2 role permission to read this secret
data "aws_iam_policy_document" "secrets_read" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.db_url.arn]
  }
}

resource "aws_iam_role_policy" "secrets_read" {
  name   = "${var.project_name}-secrets-read"
  role   = var.ec2_role_id
  policy = data.aws_iam_policy_document.secrets_read.json
}
```

---

## 9. Monitoring Module (CloudWatch)

**File: `modules/monitoring/main.tf`**

```hcl
# Log group: where Docker container logs are stored
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project_name}-api"
  retention_in_days = 30  # Auto-delete logs after 30 days (saves cost)

  tags = { Name = "${var.project_name}-api-logs" }
}

# Alarm: fires when CPU stays above 80% for 5 minutes
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.project_name}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2             # Check 2 consecutive periods
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300           # Each period = 5 minutes
  statistic           = "Average"
  threshold           = 80            # Trigger at 80%

  dimensions = {
    InstanceId = var.ec2_instance_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.project_name}-high-cpu-alarm" }
}

# SNS topic: sends email when alarms fire
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# RDS alarm: fires when database connections exceed 80% of max
resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${var.project_name}-rds-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}
```

---

## 10. Amplify Hosting (Frontend)

**File: `modules/amplify/main.tf`**

```hcl
resource "aws_amplify_app" "frontend" {
  name       = "${var.project_name}-frontend"
  repository = "https://github.com/YOUR_USERNAME/jazz-portfolio"

  build_spec = <<-YAML
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
  YAML

  environment_variables = {
    NEXT_PUBLIC_API_URL = "https://api.your-domain.com"
  }

  tags = { Name = "${var.project_name}-amplify" }
}

# Auto-deploy when code is pushed to the main branch
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = "main"
  stage       = "PRODUCTION"

  environment_variables = {
    NEXT_PUBLIC_ENV = "production"
  }
}
```

---

## 11. Wiring It All Together

**File: `main.tf`** (updated root file)

```hcl
module "networking" {
  source       = "./modules/networking"
  project_name = var.project_name
  aws_region   = var.aws_region
}

module "security" {
  source       = "./modules/security"
  project_name = var.project_name
  vpc_id       = module.networking.vpc_id
  my_ip        = var.my_ip
}

module "compute" {
  source           = "./modules/compute"
  project_name     = var.project_name
  instance_type    = var.environment == "prod" ? "t3.small" : "t3.micro"
  key_pair_name    = var.ec2_key_pair_name
  public_subnet_id = module.networking.public_subnet_id
  ec2_sg_id        = module.security.ec2_sg_id
  iam_profile_name = module.security.ec2_instance_profile_name
}

module "database" {
  source               = "./modules/database"
  project_name         = var.project_name
  environment          = var.environment
  db_instance_class    = var.environment == "prod" ? "db.t3.small" : "db.t3.micro"
  db_username          = var.db_username
  db_password          = var.db_password
  db_subnet_group_name = module.networking.db_subnet_group_name
  rds_sg_id            = module.security.rds_sg_id
}

module "storage" {
  source       = "./modules/storage"
  project_name = var.project_name
}

module "secrets" {
  source       = "./modules/secrets"
  project_name = var.project_name
  environment  = var.environment
  db_username  = var.db_username
  db_password  = var.db_password
  db_endpoint  = module.database.db_endpoint
  jwt_secret   = var.jwt_secret
  ec2_role_id  = module.security.ec2_role_id
}

module "monitoring" {
  source          = "./modules/monitoring"
  project_name    = var.project_name
  ec2_instance_id = module.compute.instance_id
  rds_instance_id = module.database.db_instance_id
  alert_email     = var.alert_email
}
```

---

## 12. Deploy Commands

```bash
# First time only: create the S3 bucket for Terraform state
aws s3 mb s3://jazz-portfolio-terraform-state --region ap-southeast-1

# Initialize Terraform (downloads providers, sets up backend)
terraform init

# See what Terraform WILL do (without doing it)
terraform plan -var-file=environments/prod.tfvars

# Apply changes (creates/updates real AWS resources)
terraform apply -var-file=environments/prod.tfvars

# Tear down EVERYTHING (use with extreme caution)
terraform destroy -var-file=environments/prod.tfvars
```

---

## 13. CI/CD Integration (GitHub Actions + Terraform)

**File: `.github/workflows/infrastructure.yml`**

```yaml
name: Infrastructure CI/CD

on:
  push:
    branches: [main]
    paths: ['infrastructure/**'] # Only run when infra code changes
  pull_request:
    branches: [main]
    paths: ['infrastructure/**']

jobs:
  terraform:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infrastructure

    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.9.0

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-southeast-1

      - name: Terraform Init
        run: terraform init

      - name: Terraform Format Check
        run: terraform fmt -check # Fail if code isn't formatted

      - name: Terraform Validate
        run: terraform validate # Fail if syntax is wrong

      - name: Terraform Plan
        run: terraform plan -var-file=environments/prod.tfvars -no-color

      # Only apply on merge to main (not on PR)
      - name: Terraform Apply
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: terraform apply -var-file=environments/prod.tfvars -auto-approve
```

---

## Mapping: Cloud Deployment Mastery → IaC

| Mastery Doc Section   | IaC Module     | Key Terraform Resources                                        |
| --------------------- | -------------- | -------------------------------------------------------------- |
| §1 VPC Architecture   | `networking/`  | `aws_vpc`, `aws_subnet`, `aws_internet_gateway`                |
| §1 EC2 Server         | `compute/`     | `aws_instance`, `aws_eip`                                      |
| §1 RDS Database       | `database/`    | `aws_db_instance`                                              |
| §1 S3 + CloudFront    | `storage/`     | `aws_s3_bucket`, `aws_cloudfront_distribution`                 |
| §1 Amplify Hosting    | `amplify/`     | `aws_amplify_app`, `aws_amplify_branch`                        |
| §2 S3 OAC Security    | `storage/`     | `aws_cloudfront_origin_access_control`, `aws_s3_bucket_policy` |
| §2 Security Groups    | `security/`    | `aws_security_group` (EC2 + RDS)                               |
| §2 IAM Roles          | `security/`    | `aws_iam_role`, `aws_iam_role_policy`                          |
| §3 Secrets Management | `secrets/`     | `aws_secretsmanager_secret`                                    |
| §4 CI/CD Pipeline     | GitHub Actions | `.github/workflows/infrastructure.yml`                         |
| §6 CloudWatch Logging | `monitoring/`  | `aws_cloudwatch_log_group`, `aws_cloudwatch_metric_alarm`      |
