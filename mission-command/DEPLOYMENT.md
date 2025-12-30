# Mission Command Centre - Deployment Guide

This guide covers deploying the Mission Command Centre to production using various methods.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Local)](#quick-start-local)
- [Deployment Options](#deployment-options)
  - [Option 1: Docker Compose](#option-1-docker-compose-single-server)
  - [Option 2: Kubernetes](#option-2-kubernetes-scalable)
  - [Option 3: Cloud Platforms](#option-3-cloud-platforms)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Scaling Strategies](#scaling-strategies)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required
- Docker 20.10+ and Docker Compose 2.0+
- Node.js 20+ (for local development)
- PostgreSQL 14+ (or use Docker image)
- GitHub App credentials
- Domain name (for production)

### Optional
- Kubernetes cluster (for K8s deployment)
- SSL certificate (Let's Encrypt or commercial)
- Prometheus + Grafana (for monitoring)
- Cloud provider account (Vercel, Railway, AWS, etc.)

## Quick Start (Local)

### 1. Clone and Configure

```bash
git clone <your-repo>
cd mission-command
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your values:

```env
# Database
DATABASE_URL=postgresql://missioncmd:missioncmd_password@localhost:5432/mission_command

# GitHub
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----

# Mastra API
MASTRA_API_URL=http://localhost:4112
```

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Verify Deployment

```bash
curl http://localhost:4111/webhooks/github/health
```

Expected response: `{"status":"ok"}`

## Deployment Options

### Option 1: Docker Compose (Single Server)

Best for: Small to medium deployments, single server

#### 1.1 Prepare Server

SSH into your server:

```bash
ssh user@your-server.com
```

Install Docker:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER
```

#### 1.2 Deploy

```bash
# Clone repository
git clone <your-repo> /opt/mission-command
cd /opt/mission-command

# Configure environment
cp .env.example .env
nano .env  # Edit with production values

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

#### 1.3 Configure Nginx (Optional)

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream missioncmd {
        server server:4111;
    }

    server {
        listen 80;
        server_name mission-command.example.com;

        location / {
            proxy_pass http://missioncmd;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

Start with nginx:

```bash
docker-compose --profile with-nginx up -d
```

### Option 2: Kubernetes (Scalable)

Best for: Large deployments, high availability

#### 2.1 Create Namespace

```bash
kubectl create namespace mission-command
```

#### 2.2 Create Secrets

```bash
kubectl create secret generic missioncmd-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=github-webhook-secret="..." \
  --from-literal=github-app-id="..." \
  --from-literal=github-app-private-key="..." \
  -n mission-command
```

#### 2.3 Deploy PostgreSQL

```yaml
# postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: mission-command
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        env:
        - name: POSTGRES_USER
          value: missioncmd
        - name: POSTGRES_PASSWORD
          value: missioncmd_password
        - name: POSTGRES_DB
          value: mission_command
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: mission-command
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
```

```bash
kubectl apply -f postgres-deployment.yaml
```

#### 2.4 Deploy Application

```yaml
# missioncmd-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: missioncmd
  namespace: mission-command
spec:
  replicas: 3
  selector:
    matchLabels:
      app: missioncmd
  template:
    metadata:
      labels:
        app: missioncmd
    spec:
      containers:
      - name: missioncmd
        image: ghcr.io/your-org/mission-command:latest
        ports:
        - containerPort: 4111
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: missioncmd-secrets
              key: database-url
        - name: GITHUB_WEBHOOK_SECRET
          valueFrom:
            secretKeyRef:
              name: missioncmd-secrets
              key: github-webhook-secret
        - name: GITHUB_APP_ID
          valueFrom:
            secretKeyRef:
              name: missioncmd-secrets
              key: github-app-id
        - name: GITHUB_APP_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: missioncmd-secrets
              key: github-app-private-key
        livenessProbe:
          httpGet:
            path: /webhooks/github/health
            port: 4111
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /webhooks/github/health
            port: 4111
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: missioncmd
  namespace: mission-command
spec:
  selector:
    app: missioncmd
  ports:
  - port: 80
    targetPort: 4111
  type: LoadBalancer
```

```bash
kubectl apply -f missioncmd-deployment.yaml
```

### Option 3: Cloud Platforms

#### 3.1 Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd mission-command
vercel
```

#### 3.2 Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### 3.3 AWS ECS

1. Push Docker image to ECR
2. Create ECS task definition
3. Create ECS service
4. Configure Application Load Balancer

See AWS documentation for detailed steps.

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook secret | `random-secret-string` |
| `GITHUB_APP_ID` | GitHub App ID | `123456` |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key | `-----BEGIN RSA PRIVATE KEY-----...` |
| `MASTRA_API_URL` | Mastra API endpoint | `http://localhost:4112` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4111` |
| `HOSTNAME` | Server hostname | `0.0.0.0` |
| `NODE_ENV` | Environment | `production` |
| `LOG_LEVEL` | Logging level | `info` |

## Database Setup

### 1. Create Database

```sql
CREATE DATABASE mission_command;
CREATE USER missioncmd WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE mission_command TO missioncmd;
```

### 2. Run Migrations

```bash
cd mission-command
pnpm migrate:up
```

### 3. Seed Data (Optional)

```bash
pnpm seed
```

### 4. Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U missioncmd mission_command > backup.sql

# Restore
docker-compose exec -T postgres psql -U missioncmd mission_command < backup.sql
```

## SSL/TLS Configuration

### Let's Encrypt (Certbot)

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d mission-command.example.com

# Copy certificates
sudo cp /etc/letsencrypt/live/mission-command.example.com/fullchain.pem ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/mission-command.example.com/privkey.pem ssl/privkey.pem
```

### Update Nginx for HTTPS

```nginx
server {
    listen 443 ssl;
    server_name mission-command.example.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    location / {
        proxy_pass http://missioncmd;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name mission-command.example.com;
    return 301 https://$server_name$request_uri;
}
```

## Monitoring & Logging

### Health Check Endpoint

```bash
curl http://localhost:4111/webhooks/github/health
```

### View Logs

```bash
# Docker Compose
docker-compose logs -f server

# Kubernetes
kubectl logs -f deployment/missioncmd -n mission-command
```

### Prometheus Metrics

Enable in `docker-compose.yml`:

```bash
docker-compose --profile with-monitoring up -d
```

Access Grafana at `http://localhost:3001` (admin/admin)

### Key Metrics

- Webhook request count
- Request duration (p50, p95, p99)
- Error rate
- Database query performance
- Container health

## Scaling Strategies

### Vertical Scaling

Add more resources to the server:

```yaml
# docker-compose.yml
services:
  server:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Horizontal Scaling

Run multiple instances:

```yaml
# docker-compose.yml
services:
  server:
    deploy:
      replicas: 3
```

Add load balancer (Nginx, HAProxy, or cloud LB).

### Database Scaling

- Read replicas for reads
- Connection pooling (PgBouncer)
- Caching layer (Redis)

## Security Best Practices

### 1. Secrets Management

- Never commit secrets to git
- Use environment variables or secret managers
- Rotate secrets regularly
- Use strong, unique passwords

### 2. Network Security

```yaml
# docker-compose.yml
services:
  server:
    networks:
      - missioncmd-network
    ports:
      - "127.0.0.1:4111:4111"  # Listen on localhost only
```

### 3. Firewall Rules

```bash
# Allow only necessary ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### 4. Container Security

```dockerfile
# Dockerfile
USER missioncmd  # Non-root user
```

### 5. Rate Limiting

Implement rate limiting on API endpoints:

```yaml
# nginx.conf
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location /api/ {
        limit_req zone=api burst=20;
    }
}
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs server

# Check resource usage
docker stats

# Restart
docker-compose restart server
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U missioncmd -d mission_command

# Check DATABASE_URL
echo $DATABASE_URL
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Add memory limits
# docker-compose.yml
services:
  server:
    deploy:
      resources:
        limits:
          memory: 1G
```

### Webhook Not Receiving Events

1. Verify webhook URL is correct
2. Check GitHub App settings
3. Verify `GITHUB_WEBHOOK_SECRET`
4. Check server logs for errors

### Health Check Failing

```bash
# Test health endpoint manually
curl http://localhost:4111/webhooks/github/health

# Check if service is running
docker-compose ps

# Increase health check timeout
# docker-compose.yml
healthcheck:
  interval: 30s
  timeout: 10s
  start_period: 60s
```

## Maintenance

### Update to Latest Version

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build

# Remove old images
docker image prune -f
```

### Database Migration

```bash
# Backup first
docker-compose exec postgres pg_dump -U missioncmd mission_command > backup.sql

# Run migrations
pnpm migrate:up

# Verify
pnpm migrate:status
```

### Log Rotation

```yaml
# docker-compose.yml
services:
  server:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Support

For issues and questions:
- GitHub Issues: <repository-url>/issues
- Documentation: [README.md](./README.md)
- Development Guide: [DEVELOPMENT.md](../DEVELOPMENT.md)
