# Mission Command Centre - Deployment Guide

## Overview

This guide covers deploying Mission Command Centre to production using Docker, Docker Compose, or ECS (AWS Elastic Container Service).

## Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- Node.js 20+ (for local development)
- PostgreSQL 15+ (for production database)
- GitHub OAuth app (optional)
- Google OAuth app (optional)
- Domain name (for production)

## Environment Variables

Create a `.env` file in the mission-command directory:

```env
# JWT Secret (required, generate with: openssl rand -base64 32)
JWT_AUTH_SECRET=your-super-secret-key-change-this

# Frontend URL (required)
FRONTEND_URL=http://localhost:3000  # Development
# FRONTEND_URL=https://missioncommand.com  # Production

# GitHub OAuth (optional - omit to disable)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Google OAuth (optional - omit to disable)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Default role for new users (optional, default: viewer)
DEFAULT_ROLE=viewer

# Database (required for production)
DATABASE_URL=postgresql://user:password@localhost:5432/mission_command

# Or use LibSQL (development only)
LIBSQL_URL=file:mission-command.db
```

## Development Deployment

### Quick Start with Docker Compose

1. **Clone and build:**
   ```bash
   git clone https://github.com/your-org/Conductor-brnd.git
   cd Conductor-brnd
   pnpm install
   pnpm build
   ```

2. **Configure environment:**
   ```bash
   cd mission-command
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - UI: http://localhost:3000
   - API: http://localhost:4111

5. **View logs:**
   ```bash
   docker-compose logs -f
   ```

6. **Stop services:**
   ```bash
   docker-compose down
   ```

## Production Deployment

### Option 1: Docker Compose (Production)

1. **Build production images:**
   ```bash
   docker build -t mission-command-ui:latest -f mission-command/Dockerfile --target ui-production .
   docker build -t mission-command-server:latest -f mission-command/Dockerfile --target server .
   ```

2. **Configure production environment:**
   ```bash
   cp .env.example .env.prod
   # Edit .env.prod with production values
   ```

3. **Start production stack:**
   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```

### Option 2: AWS ECS (Recommended for Scale)

#### Prerequisites

- AWS account with ECS, ECR, and ALB access
- AWS CLI configured
- Domain with SSL certificate (AWS Certificate Manager)

#### Deployment Steps

1. **Create ECR repository:**
   ```bash
   aws ecr create-repository --repository-name mission-command
   ```

2. **Login to ECR:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
   ```

3. **Build and push image:**
   ```bash
   docker build -t mission-command:latest -f mission-command/Dockerfile .
   docker tag mission-command:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/mission-command:latest
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/mission-command:latest
   ```

4. **Create ECS cluster:**
   ```bash
   aws ecs create-cluster --cluster-name mission-command
   ```

5. **Create task definition** (save as `task-definition.json`):
   ```json
   {
     "family": "mission-command",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "512",
     "memory": "1024",
     "containerDefinitions": [
       {
         "name": "mission-command-ui",
         "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/mission-command:latest",
         "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
         "environment": [
           {"name": "VITE_MASTRA_API_URL", "value": "http://localhost:4111"},
           {"name": "NODE_ENV", "value": "production"}
         ],
         "essential": true
       },
       {
         "name": "mastra-server",
         "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/mission-command:latest",
         "portMappings": [{"containerPort": 4111, "protocol": "tcp"}],
         "environment": [
           {"name": "NODE_ENV", "value": "production"},
           {"name": "DATABASE_URL", "value": "your-production-db-url"}
         ],
         "secrets": [
           {"name": "JWT_AUTH_SECRET", "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:mission-command/jwt-secret"}
         ],
         "essential": true
       }
     ]
   }
   ```

6. **Register task definition:**
   ```bash
   aws ecs register-task-definition --cli-input-json file://task-definition.json
   ```

7. **Create ECS service:**
   ```bash
   aws ecs create-service \
     --cluster mission-command \
     --service-name mission-command \
     --task-definition mission-command \
     --desired-count 2 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
   ```

8. **Configure Application Load Balancer:**
   ```bash
   # Create target group
   aws elbv2 create-target-group --name mission-command-tg --port 3000 --protocol HTTP --vpc-id vpc-xxx

   # Create load balancer
   aws elbv2 create-load-balancer --name mission-command-alb --subnets subnet-xxx subnet-yyy --security-groups sg-xxx

   # Create listener
   aws elbv2 create-listener --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:<account-id>:load-balancer/net/xxx --protocol HTTP --port 80 --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:<account-id>:targetgroup/xxx
   ```

9. **Set up CI/CD:**
   - The `.github/workflows/mission-command-deploy.yml` workflow is already configured
   - Add AWS secrets to GitHub repository settings:
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`
     - `POSTGRES_USER`
     - `POSTGRES_PASSWORD`

10. **Deploy:**
    ```bash
    # Trigger deployment from GitHub Actions
    gh workflow run mission-command-deploy.yml -f environment=production
    ```

### Option 3: Vercel (UI Only) + Railway (Server)

#### Deploy UI to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   cd mission-command/ui
   vercel --prod
   ```

3. **Configure environment variables in Vercel dashboard:**
   - `VITE_MASTRA_API_URL`: Your Railway server URL

#### Deploy Server to Railway

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Create Railway project and deploy:**
   ```bash
   railway login
   railway init
   railway up
   ```

3. **Configure environment variables in Railway dashboard:**
   - `JWT_AUTH_SECRET`
   - `DATABASE_URL`
   - OAuth credentials

## Database Setup

### PostgreSQL (Production)

1. **Create database:**
   ```sql
   CREATE DATABASE mission_command;
   ```

2. **Run migrations:**
   ```bash
   psql -U postgres -d mission_command -f migration.sql
   ```

3. **Create admin user:**
   ```sql
   INSERT INTO mission_command_users (id, sub, email, name, provider, role, created_at, updated_at)
   VALUES (
     gen_random_uuid(),
     'admin-001',
     'admin@yourcompany.com',
     'Admin User',
     'github',
     'admin',
     NOW(),
     NOW()
   );
   ```

### Supabase (Alternative)

1. **Create project at https://supabase.com**
2. **Get connection string from Settings > Database**
3. **Run migrations in Supabase SQL Editor**
4. **Configure environment variable:**
   ```env
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```

## Monitoring & Logging

### Health Checks

Health check endpoint: `GET /health`

Configure in ECS target group or Docker Compose healthcheck:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:4111/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Logging

Logs are captured by:
- Docker: `docker-compose logs -f [service]`
- ECS: CloudWatch Logs (automatically enabled)
- Railway: Built-in log viewer

### Metrics

For production monitoring, consider:
- Prometheus + Grafana
- DataDog
- New Relic

## Security Checklist

- [ ] Change `JWT_AUTH_SECRET` to strong random value
- [ ] Enable HTTPS (use Let's Encrypt or AWS Certificate Manager)
- [ ] Set up firewall rules (only allow ports 80, 443)
- [ ] Enable rate limiting on API endpoints
- [ ] Configure CORS to only allow your domain
- [ ] Set up database backups
- [ ] Enable audit logging
- [ ] Use secrets manager (AWS Secrets Manager, Railway env vars)
- [ ] Regular security updates

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs mission-command-ui

# Check resource usage
docker stats

# Restart service
docker-compose restart mission-command-ui
```

### Database connection errors

- Verify `DATABASE_URL` is correct
- Check database is accepting connections
- Ensure network allows traffic on port 5432
- Check firewall rules

### OAuth not working

- Verify OAuth app credentials
- Check callback URL matches OAuth app configuration
- Verify `FRONTEND_URL` is correct
- Check browser console for errors

## Scaling

### Vertical Scaling

Increase CPU/memory in `task-definition.json` or `docker-compose.yml`:

```yaml
services:
  mastra-server:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

### Horizontal Scaling

Increase desired count in ECS or use Docker Swarm:

```bash
docker-compose up -d --scale mission-command-ui=3 --scale mastra-server=2
```

## Backup & Restore

### Database Backup

```bash
# Backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore
pssql $DATABASE_URL < backup-20241229.sql
```

### Volume Backup

```bash
# Backup Docker volumes
docker run --rm -v mission-command-data:/data -v $(pwd):/backup alpine tar czf /backup/mission-command-backup.tar.gz /data
```

## Cost Estimation

**AWS ECS (us-east-1):**
- Fargate (0.5 vCPU, 1GB): ~$20/month per instance
- ALB: ~$20/month
- RDS PostgreSQL (t3.micro): ~$15/month
- **Total**: ~$75/month for 2 instances

**Alternative:**
- Railway: ~$5-20/month
- Vercel: Free tier, then $20/month
- **Total**: ~$25-40/month

## Support

For issues or questions:
- GitHub Issues: https://github.com/mastra-ai/mastra/issues
- Documentation: https://mastra.ai/docs
- Discord: https://mastra.ai/discord
