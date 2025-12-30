# Deployment Guide - Mission Command Centre

This guide covers deploying Mission Command Centre to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Deployment (Docker Compose)](#local-deployment)
3. [Production Deployment](#production-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Monitoring & Logging](#monitoring--logging)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required

- **Docker** 20.10+
- **Docker Compose** 2.0+
- **PostgreSQL** 14+ (or use Docker)
- **GitHub Account** (for OAuth app)
- **Google Account** (for OAuth app, optional)
- **Domain Name** (for production)

### Optional

- **SSL Certificate** (for HTTPS)
- **Monitoring Stack** (Prometheus + Grafana)
- **Log Aggregation** (ELK, Loki, etc.)

## Local Deployment (Docker Compose)

### 1. Clone Repository

```bash
git clone https://github.com/mastra-ai/mastra.git
cd mastra
cd packages/mission-command
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

Set required variables:
```bash
# Database
DATABASE_URL=postgresql://mission_command:password@postgres:5432/mission_command_db

# GitHub
GITHUB_TOKEN=ghp_your_token_here
GITHUB_WEBHOOK_SECRET=your_random_secret_here

# JWT
JWT_SECRET=your_jwt_secret_here

# OAuth (optional for local)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 3. Start Services

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Mission Command Server on port 4111
- UI on port 3000
- Nginx reverse proxy on ports 80/443 (optional)
- Prometheus on port 9090 (optional)
- Grafana on port 3001 (optional)

### 4. Verify Deployment

```bash
# Check health
curl http://localhost:4111/webhooks/github/health

# Should return:
# {"status":"ok","timestamp":"...","suspendedRuns":0}
```

### 5. Access UI

Open browser: http://localhost:3000

## Production Deployment

### Option 1: Docker Compose (Recommended for Single Server)

#### 1. Prepare Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER

# Re-login for group changes
```

#### 2. Create Deployment Directory

```bash
sudo mkdir -p /opt/mission-command
sudo chown $USER:$USER /opt/mission-command
cd /opt/mission-command
```

#### 3. Copy Files

```bash
# Copy docker-compose.yml
scp docker-compose.yml user@server:/opt/mission-command/

# Copy .env file (with production values)
scp .env user@server:/opt/mission-command/
```

#### 4. Configure Production Environment

Edit `.env` on the server:

```bash
nano .env
```

Production values:
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mission_command_db

# GitHub
GITHUB_TOKEN=ghp_production_token
GITHUB_WEBHOOK_SECRET=strong_random_secret_here

# JWT
JWT_SECRET=very_strong_random_secret_here

# OAuth
GITHUB_CLIENT_ID=your_production_client_id
GITHUB_CLIENT_SECRET=your_production_client_secret
GITHUB_CALLBACK_URL=https://your-domain.com/auth/github/callback

# Admins
ADMIN_EMAILS=admin@yourdomain.com,ops@yourdomain.com
ADMIN_DOMAINS=yourdomain.com
```

#### 5. Deploy

```bash
# Start services
docker-compose up -d

# Run migrations
docker-compose exec server pnpm db:migrate

# Check logs
docker-compose logs -f
```

### Option 2: Kubernetes (Recommended for Scale)

#### 1. Create Namespace

```bash
kubectl create namespace mission-command
```

#### 2. Create Secrets

```bash
# Database secret
kubectl create secret generic mission-command-db \
  --from-literal=database-url="postgresql://..." \
  -n mission-command

# GitHub secret
kubectl create secret generic mission-command-github \
  --from-literal=token="ghp_..." \
  --from-literal=webhook-secret="..." \
  -n mission-command

# JWT secret
kubectl create secret generic mission-command-jwt \
  --from-literal=secret="..." \
  -n mission-command

# OAuth secret
kubectl create secret generic mission-command-oauth \
  --from-literal=github-client-id="..." \
  --from-literal=github-client-secret="..." \
  -n mission-command
```

#### 3. Deploy PostgreSQL

```bash
kubectl apply -f k8s/postgres/
```

#### 4. Deploy Application

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

#### 5. Verify Deployment

```bash
# Check pods
kubectl get pods -n mission-command

# Check logs
kubectl logs -f deployment/mission-command -n mission-command

# Port forward for testing
kubectl port-forward svc/mission-command 4111:4111 -n mission-command
```

### Option 3: Cloud Platforms

#### Vercel (UI Only)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy UI
cd ui
vercel --prod
```

#### Railway / Render

1. Connect GitHub repo
2. Select `mission-command` package
3. Configure environment variables
4. Deploy!

#### AWS ECS

1. Push Docker image to ECR
2. Create ECS task definition
3. Create ECS service
4. Configure ALB
5. Deploy!

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `GITHUB_TOKEN` | GitHub personal access token | `ghp_xxx` |
| `GITHUB_WEBHOOK_SECRET` | Webhook signature secret | `random_string` |
| `JWT_SECRET` | JWT signing secret | `random_string` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4111` |
| `UI_PORT` | UI port | `3000` |
| `NODE_ENV` | Environment | `production` |
| `CLEANUP_INTERVAL_MS` | Cleanup interval | `3600000` |
| `RATE_LIMIT_CLEANUP_INTERVAL_MS` | Rate limit cleanup | `60000` |

### OAuth Variables (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | `Iv1...` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret | `ghp_...` |
| `GITHUB_CALLBACK_URL` | OAuth callback URL | `https://domain.com/auth/github/callback` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | `GOCSPX_...` |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback | `https://domain.com/auth/google/callback` |
| `ADMIN_EMAILS` | Admin email whitelist | `admin@domain.com` |
| `ADMIN_DOMAINS` | Admin domain whitelist | `domain.com` |

## Database Setup

### PostgreSQL

#### 1. Create Database

```bash
# Using psql
createdb mission_command_db

# Or Docker
docker exec -it postgres psql -U postgres
CREATE DATABASE mission_command_db;
CREATE USER mission_command WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE mission_command_db TO mission_command;
```

#### 2. Run Migrations

```bash
# From server container
docker-compose exec server pnpm db:migrate

# Or locally
cd packages/mission-command
pnpm db:migrate
```

#### 3. Verify Tables

```bash
docker-compose exec postgres psql -U mission_command -d mission_command_db -c "\dt"

# Should show:
# mastra_suspended_runs
# users
# sessions
# audit_log
```

### Backup & Restore

#### Backup

```bash
# Automated backup
docker-compose exec postgres pg_dump -U mission_command mission_command_db > backup.sql

# Or cron job
0 2 * * * docker-compose exec -T postgres pg_dump -U mission_command mission_command_db > /backups/backup_$(date +\%Y\%m\%d).sql
```

#### Restore

```bash
docker-compose exec -T postgres psql -U mission_command mission_command_db < backup.sql
```

## Monitoring & Logging

### Health Checks

```bash
# API health
curl http://localhost:4111/webhooks/github/health

# Docker health
docker-compose ps

# Kubernetes health
kubectl get pods -n mission-command
```

### Metrics

Prometheus metrics are exposed on `/metrics` endpoint:

- Webhook request count
- Request duration
- Suspended runs count
- Database query duration

### Logs

#### Docker Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server

# Last 100 lines
docker-compose logs --tail=100 server
```

#### Kubernetes Logs

```bash
# All pods
kubectl logs -f -n mission-command --all-containers

# Specific pod
kubectl logs -f deployment/mission-command -n mission-command
```

### Monitoring Stack

If using Prometheus + Grafana:

1. **Access Grafana**: http://localhost:3001 (admin/admin)
2. **Add Prometheus datasource**: http://prometheus:9090
3. **Import dashboard**: Use provided JSON

Key metrics to monitor:
- `webhook_requests_total` - Webhook request count
- `webhook_duration_seconds` - Request duration
- `suspended_runs_total` - Active suspended runs
- `database_query_duration_seconds` - DB query performance

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs server

# Common issues:
# 1. Port already in use
sudo lsof -i :4111

# 2. Database connection failed
# Check DATABASE_URL is correct
# Check PostgreSQL is running
docker-compose ps postgres

# 3. Missing environment variable
# Check .env file exists and has all required vars
```

### Database Connection Issues

```bash
# Test connection from server container
docker-compose exec server sh -c "nc -zv postgres 5432"

# Check PostgreSQL logs
docker-compose logs postgres

# Verify credentials
docker-compose exec postgres psql -U mission_command -d mission_command_db -c "SELECT 1;"
```

### Webhook Not Received

```bash
# Check webhook is configured
curl -X POST http://localhost:4111/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check GitHub webhook configuration
# 1. Payload URL matches
# 2. Secret matches
# 3. Events are selected
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Limit memory in docker-compose.yml
services:
  server:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

### Slow Performance

```bash
# Check database query performance
docker-compose exec postgres psql -U mission_command -d mission_command_db \
  -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check indexes
docker-compose exec postgres psql -U mission_command -d mission_command_db \
  -c "\d mastra_suspended_runs"

# Add missing indexes if needed
```

## Scaling

### Vertical Scaling

Increase resources in `docker-compose.yml`:

```yaml
services:
  server:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

### Horizontal Scaling

```bash
# Scale server to 3 instances
docker-compose up -d --scale server=3

# Add load balancer (nginx, traefik)
```

### Kubernetes Scaling

```bash
# Scale to 3 replicas
kubectl scale deployment/mission-command --replicas=3 -n mission-command

# Enable autoscaling
kubectl autoscale deployment/mission-command \
  --min=2 --max=10 \
  --cpu-percent=70 \
  -n mission-command
```

## Security

### SSL/TLS

```bash
# Generate self-signed cert (for testing)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Or use Let's Encrypt
certbot certonly --standalone -d mission-command.example.com
```

### Firewall Rules

```bash
# Allow only necessary ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### Secrets Management

**Never commit secrets to git!**

Use environment variables or secret managers:
- Docker Secrets
- Kubernetes Secrets
- AWS Secrets Manager
- HashiCorp Vault

## Updates & Maintenance

### Update Application

```bash
# Pull latest image
docker-compose pull

# Restart with new image
docker-compose up -d

# Or zero-downtime deployment
docker-compose up -d --no-deps --build server
```

### Database Migration

```bash
# Backup first
docker-compose exec postgres pg_dump -U mission_command mission_command_db > backup.sql

# Run migration
docker-compose exec server pnpm db:migrate

# Verify
docker-compose exec server pnpm db:migrate:status
```

## Support

For issues and questions:
- **Documentation**: [Mastra Docs](https://mastra.ai/docs)
- **Issues**: [GitHub Issues](https://github.com/mastra-ai/mastra/issues)
- **Discord**: [Mastra Discord](https://discord.gg/mastra-ai)

---

**Deployment complete!** 🚀

For additional help, see the main [README.md](./README.md) or [DEVELOPMENT.md](./DEVELOPMENT.md).
