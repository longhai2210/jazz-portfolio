# 📚 Infrastructure as Code — Learning Guide

Beginner-friendly, zero-to-competent guide covering:

Part 1-2: Core concepts + HCL syntax with inline examples
Part 3: Modules explained like functions
Part 4: State management (remote S3 + locking)
Part 5: Best practices checklist (naming, security, lifecycle)
Part 6: 4 hands-on exercises (5 min → 20 min, progressive difficulty)
Part 7: Real-world patterns (tagging, env configs, for_each, dynamic blocks)
Part 8: Debugging & common error fixes
Part 9: The real-life workflow + golden rules + cheat sheet

A practical guide to mastering IaC from zero. No fluff, no theory walls. Every concept is followed by a real example you can run.

---

## What is Infrastructure as Code?

**Old way:** You click through the AWS Console to create a server. A week later, you need another one. You can't remember the exact settings. You click around again, guess some values, and hope it matches.

**IaC way:** You write a file that says "I want a server with these exact settings." You run one command. The server appears. Need another? Run the same command with a different name. Need to tear it all down? One command. Done.

```
# This is Infrastructure as Code
resource "aws_instance" "my_server" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
}
```

That's it. That block of text IS a server. Run `terraform apply` and it exists in AWS.

---

## Why Should You Care?

| Without IaC                             | With IaC                                   |
| --------------------------------------- | ------------------------------------------ |
| "Who changed the firewall rule?"        | `git log` shows exactly who, when, and why |
| "How do I rebuild this if it breaks?"   | `terraform apply` — done in 5 minutes      |
| "Dev and prod are somehow different"    | Same code, different variable files        |
| "I'm scared to touch anything"          | Destroy and recreate with confidence       |
| New team member: "How was this set up?" | Read the `.tf` files                       |

---

## The Big Three IaC Tools

| Tool                   | Language             | Best For                      | Managed By |
| ---------------------- | -------------------- | ----------------------------- | ---------- |
| **Terraform**          | HCL                  | Multi-cloud (AWS, GCP, Azure) | HashiCorp  |
| **AWS CloudFormation** | JSON/YAML            | AWS-only projects             | Amazon     |
| **Pulumi**             | Python/TypeScript/Go | Devs who hate new languages   | Pulumi     |

**This guide uses Terraform** because:

- It works with any cloud, not just AWS
- HCL (HashiCorp Configuration Language) is the easiest to read
- It's the most in-demand IaC skill in job postings

---

## Part 1: Core Concepts (The Mental Model)

### 1.1 Declarative vs. Imperative

**Imperative** (how scripts work): "Step 1: Create a VPC. Step 2: Create a subnet. Step 3: If the subnet exists, skip..."

**Declarative** (how Terraform works): "I want a VPC and a subnet. Figure out how to get there."

```hcl
# You declare WHAT you want. Terraform figures out HOW.
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}
```

You never write "if VPC exists, skip." Terraform checks reality, compares it to your code, and only changes what's different.

### 1.2 The Four Terraform Commands You'll Use 90% of the Time

```bash
terraform init      # Download providers (run once per project)
terraform plan      # Preview changes (safe — changes nothing)
terraform apply     # Make changes for real
terraform destroy   # Delete everything Terraform created
```

**Memory trick:** Think of it as: **Install → Preview → Deploy → Cleanup**

### 1.3 State: Terraform's Memory

When you run `terraform apply`, Terraform creates a `terraform.tfstate` file. This file is Terraform's memory — it maps your `.tf` code to real AWS resources.

```
Your Code (.tf files)     Terraform State (.tfstate)     Real AWS Resources
─────────────────────     ─────────────────────────      ──────────────────
aws_instance "api"   ──→  id: "i-0abc123"           ──→  EC2 instance running
aws_s3_bucket "media" ─→  id: "my-bucket"           ──→  S3 bucket exists
```

**Why this matters:**

- Delete the state file = Terraform "forgets" your resources (they still exist in AWS, Terraform just can't manage them anymore)
- Two people modifying state at once = corruption → store state remotely in S3

### 1.4 Providers: How Terraform Talks to Clouds

```hcl
# "I want to use AWS"
provider "aws" {
  region = "ap-southeast-1"
}
```

A provider is a plugin. `aws` provider teaches Terraform how to create AWS resources. There are providers for GCP, Azure, Cloudflare, GitHub, Datadog — over 4,000 providers.

---

## Part 2: HCL Language (Learn by Example)

### 2.1 Resources — The Building Blocks

A resource = one thing in your cloud (a server, a database, a bucket).

```hcl
resource "TYPE" "NAME" {
  argument = "value"
}
```

- **TYPE** = what kind of thing (`aws_instance`, `aws_s3_bucket`, `aws_vpc`)
- **NAME** = your label for it (used only in your code, not visible in AWS)

```hcl
# Create an S3 bucket
resource "aws_s3_bucket" "photos" {
  bucket = "my-photo-storage-2026"
}

# Create an EC2 instance
resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
  tags = {
    Name = "My Web Server"
  }
}
```

### 2.2 Variables — Make Code Reusable

Instead of hardcoding values, use variables:

```hcl
# Define the variable (variables.tf)
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "instance_type" {
  description = "EC2 instance size"
  type        = string
  default     = "t3.micro"
}

# Use the variable (main.tf)
resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = var.instance_type   # <-- var.VARIABLE_NAME

  tags = {
    Environment = var.environment
  }
}
```

**Set variable values** in a `.tfvars` file:

```hcl
# dev.tfvars
environment   = "dev"
instance_type = "t3.micro"

# prod.tfvars
environment   = "prod"
instance_type = "t3.small"
```

```bash
# Deploy dev
terraform apply -var-file=dev.tfvars

# Deploy prod (same code, bigger server)
terraform apply -var-file=prod.tfvars
```

### 2.3 Outputs — Get Info Back From Terraform

After creating resources, you often need to know their IDs or addresses:

```hcl
output "server_ip" {
  description = "The public IP of our API server"
  value       = aws_instance.web.public_ip
}

output "database_endpoint" {
  description = "The connection URL for the database"
  value       = aws_db_instance.postgres.endpoint
}
```

After `terraform apply`, you'll see:

```
Outputs:

server_ip = "54.123.45.67"
database_endpoint = "my-db.abc123.ap-southeast-1.rds.amazonaws.com:5432"
```

### 2.4 References — Resources Talking to Each Other

This is where IaC gets powerful. Resources can reference each other:

```hcl
# Create a VPC
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

# Create a subnet INSIDE that VPC
resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id     # <-- Reference: TYPE.NAME.ATTRIBUTE
  cidr_block = "10.0.1.0/24"
}

# Create a security group IN that VPC
resource "aws_security_group" "web" {
  vpc_id = aws_vpc.main.id         # <-- Same reference pattern
  # ...
}
```

**Pattern:** `RESOURCE_TYPE.RESOURCE_NAME.ATTRIBUTE`

Terraform automatically understands: "I need to create the VPC before the subnet, because the subnet references the VPC's ID." You never tell Terraform what order to create things in.

### 2.5 Data Sources — Read Existing Things

Sometimes you need to reference something that already exists (you didn't create it with Terraform):

```hcl
# "Find the latest Amazon Linux AMI for me"
data "aws_ami" "latest_amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

# Use it
resource "aws_instance" "web" {
  ami = data.aws_ami.latest_amazon_linux.id   # data.TYPE.NAME.ATTRIBUTE
}
```

### 2.6 Locals — Computed Values

When you want to calculate or combine values:

```hcl
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  db_connection_string = "postgresql://${var.db_user}:${var.db_pass}@${aws_db_instance.main.endpoint}/mydb"
}

resource "aws_instance" "web" {
  # ...
  tags = local.common_tags
}
```

### 2.7 Conditionals and Loops

```hcl
# Conditional: only create in production
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  count = var.environment == "prod" ? 1 : 0   # 1 = create it, 0 = skip it
  # ...
}

# Ternary in a value
instance_type = var.environment == "prod" ? "t3.small" : "t3.micro"

# Loop: create multiple subnets
variable "availability_zones" {
  default = ["ap-southeast-1a", "ap-southeast-1b"]
}

resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = var.availability_zones[count.index]
}
```

---

## Part 3: Modules — Organizing Your Code

### 3.1 What is a Module?

A module = a folder of `.tf` files that creates a group of related resources.

```
modules/
├── networking/        # VPC + subnets + routes
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── database/          # RDS instance + config
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
```

### 3.2 Using a Module

```hcl
# In your root main.tf
module "networking" {
  source       = "./modules/networking"    # Path to the module folder
  project_name = "jazz-portfolio"
  aws_region   = "ap-southeast-1"
}

module "database" {
  source               = "./modules/database"
  db_subnet_group_name = module.networking.db_subnet_group_name  # <-- Module output
  # ...
}
```

**Key idea:** Modules are like functions in programming:

- `variables.tf` = function parameters (input)
- `main.tf` = function body (logic)
- `outputs.tf` = return values (output)

### 3.3 Community Modules

Don't reinvent the wheel. The Terraform Registry has pre-built modules:

```hcl
# Use a community VPC module (battle-tested by thousands of users)
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "my-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["ap-southeast-1a", "ap-southeast-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
}
```

---

## Part 4: State Management

### 4.1 Remote State (Required for Teams)

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "terraform-locks"   # Prevents concurrent modifications
    encrypt        = true
  }
}
```

**Setup (one-time):**

```bash
# Create the S3 bucket for state
aws s3 mb s3://my-terraform-state --region ap-southeast-1

# Create the DynamoDB table for locking
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-1
```

### 4.2 State Commands You Need

```bash
# See what Terraform is tracking
terraform state list

# Inspect a specific resource
terraform state show aws_instance.web

# Remove a resource from state (Terraform forgets it, but it still exists in AWS)
terraform state rm aws_instance.web

# Import an existing AWS resource into Terraform's management
terraform import aws_instance.web i-0abc123def456
```

---

## Part 5: Best Practices Checklist

### File Organization

```
✅ DO THIS                          ❌ NOT THIS
──────────────────────              ──────────────────────
main.tf (resources)                 everything-in-one-huge-file.tf
variables.tf (inputs)
outputs.tf (outputs)
providers.tf (provider config)
terraform.tfvars (values)
```

### Naming Conventions

```hcl
# ✅ Resource names: lowercase with underscores
resource "aws_instance" "api_server" { }
resource "aws_s3_bucket" "media_uploads" { }

# ❌ Bad names
resource "aws_instance" "MyServer" { }    # No PascalCase
resource "aws_instance" "server-1" { }    # No dashes
resource "aws_instance" "s" { }           # Not descriptive
```

### Security Rules

```hcl
# ✅ Mark sensitive values
variable "db_password" {
  type      = string
  sensitive = true   # Hidden in terraform plan output
}

# ✅ Never commit .tfvars with real secrets
# .gitignore should contain:
# *.tfvars
# .terraform/
# terraform.tfstate*

# ✅ Use IAM roles instead of access keys
# ❌ NEVER do this:
provider "aws" {
  access_key = "AKIA..."    # NEVER hardcode credentials
  secret_key = "wJalrXU..."
}
```

### Lifecycle Rules

```hcl
resource "aws_db_instance" "main" {
  # ...

  lifecycle {
    prevent_destroy = true   # Terraform refuses to delete this resource
    # Useful for databases and other things you NEVER want accidentally destroyed
  }
}

resource "aws_instance" "api" {
  # ...

  lifecycle {
    create_before_destroy = true  # Create new one BEFORE destroying old one
    # Useful for zero-downtime updates
  }
}
```

---

## Part 6: Practical Exercises

### Exercise 1: Your First Resource (5 minutes)

Create a file called `main.tf`:

```hcl
provider "aws" {
  region = "ap-southeast-1"
}

resource "aws_s3_bucket" "my_first_bucket" {
  bucket = "my-unique-first-bucket-2026"  # Must be globally unique
  tags = {
    Name      = "My First Terraform Bucket"
    ManagedBy = "terraform"
  }
}

output "bucket_name" {
  value = aws_s3_bucket.my_first_bucket.id
}
```

```bash
terraform init     # Download the AWS provider
terraform plan     # See what will be created
terraform apply    # Create it (type "yes" when prompted)
terraform destroy  # Clean up (type "yes" when prompted)
```

### Exercise 2: Variables and Environments (10 minutes)

```hcl
# variables.tf
variable "environment" {
  type = string
}

variable "bucket_prefix" {
  type    = string
  default = "my-app"
}

# main.tf
provider "aws" {
  region = "ap-southeast-1"
}

resource "aws_s3_bucket" "data" {
  bucket = "${var.bucket_prefix}-${var.environment}-data"
  tags = {
    Environment = var.environment
  }
}
```

```bash
# Deploy dev version
terraform apply -var="environment=dev"

# Destroy it
terraform destroy -var="environment=dev"

# Deploy prod version (same code, different name)
terraform apply -var="environment=prod"
```

### Exercise 3: Multi-Resource with References (15 minutes)

Build a VPC with a subnet and a security group — all connected:

```hcl
provider "aws" {
  region = "ap-southeast-1"
}

# 1. Create the network
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags       = { Name = "exercise-vpc" }
}

# 2. Create a subnet inside that network
resource "aws_subnet" "web" {
  vpc_id     = aws_vpc.main.id       # References the VPC above
  cidr_block = "10.0.1.0/24"
  tags       = { Name = "exercise-web-subnet" }
}

# 3. Create a firewall rule for that network
resource "aws_security_group" "web" {
  vpc_id      = aws_vpc.main.id      # Same network
  name        = "allow-http"
  description = "Allow HTTP traffic"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "exercise-web-sg" }
}

# 4. Output the IDs
output "vpc_id"    { value = aws_vpc.main.id }
output "subnet_id" { value = aws_subnet.web.id }
output "sg_id"     { value = aws_security_group.web.id }
```

### Exercise 4: Your First Module (20 minutes)

Create this structure:

```
exercise4/
├── main.tf
├── modules/
│   └── s3_website/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
```

**`modules/s3_website/variables.tf`:**

```hcl
variable "bucket_name" { type = string }
variable "environment" { type = string }
```

**`modules/s3_website/main.tf`:**

```hcl
resource "aws_s3_bucket" "website" {
  bucket = var.bucket_name
  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_website_configuration" "website" {
  bucket = aws_s3_bucket.website.id
  index_document { suffix = "index.html" }
  error_document { key    = "error.html" }
}
```

**`modules/s3_website/outputs.tf`:**

```hcl
output "bucket_id"       { value = aws_s3_bucket.website.id }
output "website_endpoint" { value = aws_s3_bucket_website_configuration.website.website_endpoint }
```

**`main.tf` (root):**

```hcl
provider "aws" {
  region = "ap-southeast-1"
}

module "dev_site" {
  source      = "./modules/s3_website"
  bucket_name = "my-dev-site-2026"
  environment = "dev"
}

module "prod_site" {
  source      = "./modules/s3_website"
  bucket_name = "my-prod-site-2026"
  environment = "prod"
}

output "dev_url"  { value = module.dev_site.website_endpoint }
output "prod_url" { value = module.prod_site.website_endpoint }
```

One module, two websites. That's the power.

---

## Part 7: Common Patterns & Recipes

### Pattern: Tag Everything

```hcl
locals {
  common_tags = {
    Project     = "jazz-portfolio"
    Environment = var.environment
    ManagedBy   = "terraform"
    Team        = "backend"
  }
}

# Use everywhere
resource "aws_instance" "api" {
  tags = merge(local.common_tags, {
    Name = "api-server"
    Role = "api"
  })
}
```

### Pattern: Environment-Specific Config

```hcl
locals {
  env_config = {
    dev = {
      instance_type    = "t3.micro"
      db_instance      = "db.t3.micro"
      min_capacity     = 1
      enable_alarms    = false
      deletion_protect = false
    }
    prod = {
      instance_type    = "t3.small"
      db_instance      = "db.t3.small"
      min_capacity     = 2
      enable_alarms    = true
      deletion_protect = true
    }
  }

  config = local.env_config[var.environment]
}

# Usage
resource "aws_instance" "api" {
  instance_type = local.config.instance_type
}

resource "aws_db_instance" "main" {
  instance_class      = local.config.db_instance
  deletion_protection = local.config.deletion_protect
}
```

### Pattern: for_each (Create Multiple Similar Resources)

```hcl
# Create multiple S3 buckets from a list
variable "bucket_names" {
  default = ["media", "logs", "backups"]
}

resource "aws_s3_bucket" "buckets" {
  for_each = toset(var.bucket_names)

  bucket = "${var.project_name}-${each.value}"
  tags   = { Name = each.value }
}

# Access a specific one: aws_s3_bucket.buckets["media"]
```

### Pattern: Dynamic Blocks

```hcl
# Create security group with a variable number of ingress rules
variable "allowed_ports" {
  default = [80, 443, 3001]
}

resource "aws_security_group" "web" {
  vpc_id = aws_vpc.main.id

  dynamic "ingress" {
    for_each = var.allowed_ports
    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
}
```

---

## Part 8: Debugging & Troubleshooting

### Common Errors and Fixes

| Error                                      | Cause                                     | Fix                                         |
| ------------------------------------------ | ----------------------------------------- | ------------------------------------------- |
| `Error: No valid credential sources found` | AWS CLI not configured                    | Run `aws configure`                         |
| `Error: S3 bucket already exists`          | Bucket names are globally unique          | Change the bucket name                      |
| `Error: resource already exists`           | Resource was created outside Terraform    | `terraform import` it                       |
| `Error: cycle detected`                    | Resource A depends on B, B depends on A   | Restructure to remove circular dependency   |
| `Plan shows destroy + create`              | You changed an immutable field (like AMI) | Expected — some changes require replacement |

### Debugging Commands

```bash
# See verbose Terraform output
TF_LOG=DEBUG terraform plan

# Visualize the dependency graph
terraform graph | dot -Tpng > graph.png

# See what Terraform is tracking
terraform state list

# Refresh state (re-read real AWS state)
terraform refresh
```

---

## Part 9: The Terraform Workflow in Real Life

```
 You write .tf code
       │
       ▼
 terraform plan           ← "What WILL change?"
       │
       ▼
 Code review on GitHub    ← Teammates review the plan
       │
       ▼
 terraform apply          ← Changes go live
       │
       ▼
 State updated            ← Terraform remembers what it did
       │
       ▼
 Git commit               ← Code is versioned forever
```

### The Golden Rules

1. **Never modify infrastructure manually** if Terraform manages it. Terraform will undo your manual changes on next `apply`.
2. **Always run `plan` before `apply`.** Read the output. Know what you're changing.
3. **Store state remotely.** Local state = team disasters waiting to happen.
4. **Lock your provider versions.** `version = "~> 5.0"` prevents surprise updates.
5. **Use modules for anything you build twice.** Copy-paste is a bug factory.

---

## Cheat Sheet

```
┌─────────────────────────────────────────────────────────┐
│                  TERRAFORM CHEAT SHEET                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  COMMANDS                                               │
│  terraform init          Set up project                 │
│  terraform plan          Preview changes                │
│  terraform apply         Deploy changes                 │
│  terraform destroy       Remove everything              │
│  terraform fmt           Format code                    │
│  terraform validate      Check syntax                   │
│  terraform output        Show output values             │
│  terraform state list    Show tracked resources         │
│  terraform import        Adopt existing resource        │
│                                                         │
│  SYNTAX                                                 │
│  resource "TYPE" "NAME" { }   Create a thing            │
│  data "TYPE" "NAME" { }       Read an existing thing    │
│  variable "NAME" { }          Input parameter           │
│  output "NAME" { }            Output value              │
│  module "NAME" { }            Use a module              │
│  locals { }                   Computed values           │
│                                                         │
│  REFERENCES                                             │
│  var.name                     Variable value            │
│  local.name                   Local value               │
│  resource_type.name.attr      Resource attribute        │
│  data.type.name.attr          Data source attribute     │
│  module.name.output           Module output             │
│                                                         │
│  FILES                                                  │
│  main.tf          Resources and logic                   │
│  variables.tf     Input definitions                     │
│  outputs.tf       Output definitions                    │
│  providers.tf     Provider configuration                │
│  terraform.tfvars Actual values (don't commit!)         │
│  .terraform/      Downloaded providers (don't commit!)  │
│  *.tfstate        State files (store in S3!)            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## What to Learn Next

| Topic                             | When You Need It                        | Resource                                          |
| --------------------------------- | --------------------------------------- | ------------------------------------------------- |
| **Terraform Workspaces**          | Managing dev/staging/prod in one config | `terraform workspace` command                     |
| **Terragrunt**                    | DRY config across many environments     | [gruntwork.io](https://terragrunt.gruntwork.io/)  |
| **Terraform Cloud**               | Team collaboration + remote runs        | [app.terraform.io](https://app.terraform.io/)     |
| **Policy as Code (Sentinel/OPA)** | Enforce rules ("no public S3 buckets")  | HashiCorp Sentinel                                |
| **AWS CDK**                       | Write IaC in TypeScript/Python          | [aws.amazon.com/cdk](https://aws.amazon.com/cdk/) |
| **Ansible**                       | Configure servers AFTER creation        | Good companion to Terraform                       |
