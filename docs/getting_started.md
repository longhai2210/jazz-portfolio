# 🎷 Jazz Portfolio — Developer Onboarding & Deployment Guide

Welcome to the Jazz Portfolio project! This document is designed to get any new developer up and running with the codebase in under 10 minutes, connect to a local PostgreSQL database, and guide you through production deployment to AWS.

---

## 🚀 Part 1: Quick Start for New Developers

Follow these steps in order to set up your local development environment.

### Step 1: Install Prerequisites
Before you begin, ensure you have the following installed on your machine:
1. **Node.js:** Version 18.x or 20.x (LTS recommended).
2. **pnpm:** Version 9.x (our package manager). If you don't have it, install it via npm:
   ```bash
   npm install -g pnpm
   ```
3. **PostgreSQL:** A local database instance. On Windows, verify your PostgreSQL service (e.g., `postgresql-x64-16`) is running on port `5432`.

---

### Step 2: Clone the Project & Install Dependencies
1. Clone the repository to your local workspace:
   ```bash
   git clone <your-repository-url>
   cd jazz-portfolio
   ```
2. Install all workspace dependencies:
   ```bash
   pnpm install
   ```

---

### Step 3: Configure Environment Variables
We use environment files (`.env`) to manage configurations. Copy the templates below to create your local environment files.

1. **Create Database Env:** In `packages/database/.env`, add:
   ```env
   DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/jazz_db?schema=public"
   ```
   *(Adjust `postgres:postgres123` to match your local PostgreSQL username and password).*

2. **Create Backend API Env:** In `apps/api/.env`, add:
   ```env
   PORT=3001
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/jazz_db?schema=public"
   JWT_SECRET="dev-secret-key-make-it-long-and-secure-for-local-testing"
   JWT_EXPIRATION="24h"
   AWS_REGION="ap-southeast-1"
   AWS_ACCESS_KEY_ID="dev-dummy-key"
   AWS_SECRET_ACCESS_KEY="dev-dummy-secret"
   AWS_S3_BUCKET="dev-media-bucket"
   AWS_CLOUDFRONT_DOMAIN="https://localhost:3000"
   FRONTEND_URL="http://localhost:3000"

   # Mail/Email Notifications (Optional fallbacks)
   MAIL_PROVIDER="resend"
   MAIL_FROM="notifications@example.com"
   MAIL_TO="contact@example.com"
   RESEND_API_KEY="re_123456789"
   # SMTP_HOST="smtp.mailtrap.io"
   # SMTP_PORT=587
   # SMTP_USER="username"
   # SMTP_PASS="password"
   ```

3. **Create Frontend Web Env:** In `apps/web/.env`, add:
   ```env
   NEXT_PUBLIC_API_URL="http://localhost:3001/api"
   ```

---

### Step 4: Initialize the Database
Run the following commands to generate the Prisma Client, push the schema to PostgreSQL, and seed the default data:

```bash
# 1. Generate Prisma typings
pnpm --filter @jazz-portfolio/database db:generate

# 2. Push database schema structure
pnpm --filter @jazz-portfolio/database db:push

# 3. Seed initial admin user, demo profile, skills/experience items, and site settings
pnpm --filter @jazz-portfolio/database db:seed
```

The seed fills the landing page (Hero, About, Experience, Skills, Contact) with a jazz-themed demo persona. Re-running `db:seed` overwrites the demo profile and category items with the values in `packages/database/prisma/seed-data.ts`—use Admin CMS or edit those constants for real content. Music tracks are not seeded (the player uses client fallbacks).

#### 🔑 Seeded Developer Credentials
- **Admin Panel URL:** `http://localhost:3000/en/admin/login`
- **Username:** `admin`
- **Password:** `admin123`
- *Note:* In development mode, if the database is unconfigured, the frontend automatically falls back to offline mock profiles and a fallback playlist so you can test immediately.

---

### Step 5: Run the App
Launch the development servers for both the frontend and backend in parallel:
```bash
pnpm dev
```
- **Frontend App:** `http://localhost:3000`
- **Backend API:** `http://localhost:3001/api`
- **Swagger Docs:** `http://localhost:3001/api/docs`

---

## 🛠️ Part 2: Helpful Commands for Daily Development

Use these shortcuts inside the root directory to run specific tasks:

| Command | Action |
|---|---|
| `pnpm dev` | Starts development servers in watch mode |
| `pnpm build` | Builds all packages and apps for production |
| `pnpm run lint` | Runs ESLint analysis across the entire project |
| `pnpm run type-check` | Compiles and validates TypeScript typings |
| `pnpm --filter @jazz-portfolio/database db:studio` | Opens Prisma Studio GUI to view database records |

---

## ☁️ Part 3: AWS Production Deployment Guide

Deploying the application stack to AWS involves provisioning S3, RDS, EC2, and Amplify services.

```
+---------------------------------------------------------------+
|                      AWS Cloud Environment                    |
|                                                               |
|  +-------------------+      +------------------------------+  |
|  | AWS Amplify (CDN) |      | AWS EC2 (Docker Host)        |  |
|  |                   |      |                              |  |
|  |   Next.js App     |      |   +--------------------+     |  |
|  |   (Port 80/443)   |----->|   | NestJS REST API    |     |  |
|  |                   |      |   | (Docker:Port 3001) |     |  |
|  +-------------------+      |   +---------+----------+     |  |
|                             +-------------|----------------+  |
|                                           |                   |
|                                           v                   |
|                              +------------+---------------+   |
|                              | AWS RDS PostgreSQL (5432)  |   |
|                              +----------------------------+   |
+---------------------------------------------------------------+
```

### 1. Database Setup (AWS RDS)
1. Open the **Amazon RDS console** and click **Create database**.
2. Select **PostgreSQL 16.x** and choose the **Free Tier** template (uses `db.t4g.micro`, 20GB gp3 storage).
3. Set **DB instance identifier** to `jazz-portfolio-db`.
4. Enter master username `postgres` and a strong master password.
5. In **Connectivity**, configure a VPC and Security Group that allows inbound TCP traffic on port `5432` from your EC2 instance's Security Group.
6. Click **Create database** and copy the endpoint once active.

### 2. Storage Setup (AWS S3 & CloudFront)
1. Open **Amazon S3** and click **Create bucket** (e.g. `jazz-portfolio-media`).
2. Keep **Block all public access** turned ON.
3. In S3 bucket's **Permissions** tab, add the following CORS policy:
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
4. Create an **AWS CloudFront Distribution** targeting your S3 bucket.
5. Select **Origin access control settings (OAC)** to secure S3 access. Apply the policy generated by CloudFront to the S3 bucket's policy field.

### 3. API Host Setup (AWS EC2)
1. Launch an EC2 Instance using the **Amazon Linux 2023 AMI** (Free Tier `t4g.micro`, ARM64).
2. Configure Security Group rules:
   - Port `22` (SSH) from your IP.
   - Port `3001` (NestJS REST API) from all sources.
3. Install Docker and Docker Compose on the host:
   ```bash
   sudo dnf update -y
   sudo dnf install docker -y
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -aG docker ec2-user
   
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```
4. Clone the repository into `~/personal` and configure `apps/api/.env` with your production RDS, S3, and CloudFront details.

### 4. Hosting Frontend (AWS Amplify)
1. Open the **AWS Amplify Console**, click **New App**, and connect to your GitHub repository's `main` branch.
2. In build settings, specify the frontend build specs:
   ```yaml
   version: 1
   applications:
     - appRoot: apps/web
       frontend:
         phases:
           preBuild:
             commands:
               - corepack enable
               - pnpm install
           build:
             commands:
               - pnpm run build
         artifacts:
           baseDirectory: .next
           files:
             - '**/*'
   ```
3. Set `NEXT_PUBLIC_API_URL` to `http://YOUR_EC2_PUBLIC_IP:3001/api` (or a custom subdomain) and deploy.

### 5. Automated CI/CD Setup
To enable continuous deployments, add the following secrets to your GitHub Repository (**Settings > Secrets > Actions**):
- `AWS_EC2_HOST`: Public IP of your EC2 instance.
- `AWS_EC2_USERNAME`: `ec2-user`
- `AWS_EC2_SSH_KEY`: The contents of your private SSH key (`.pem` file).

Pushing updates to the `main` branch will automatically trigger type checks, build verification, container redeployment on EC2, and database migration pushes.
