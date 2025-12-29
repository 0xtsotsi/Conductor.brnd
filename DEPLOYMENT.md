# Mission Command Centre - Production Deployment Guide

## Overview
Complete guide for deploying Mission Command Centre to production.

## Prerequisites

### Infrastructure Requirements
- **Docker**: 20.10+ and Docker Compose 2.0+
- **Node.js**: 20.x (for local builds)
- **PostgreSQL**: 16+ (or managed database)
- **Redis**: 7+ (or managed cache)
- **Domain**: Custom domain with SSL certificate

### Environment Variables
Generate secure values for:
```bash
# Generate secure passwords
openssl rand -base64 32  # JWT secret
openssl rand -base64 16  # Database password
openssl rand -base64 16  # Redis password
```

## Deployment Options

### Option 1: Docker Compose (Recommended for Small Deployments)

#### 1. Prepare Environment
```bash
cp .env.example .env
# Edit .env with your production values
```

#### 2. Update docker-compose.yml for Production
```yaml
services:
  mission-command-ui:
    environment:
      - VITE_MASTRA_API_URL=https://api.yourdomain.com
    # Add SSL configuration
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
```

#### 3. Start Services
```bash
docker-compose up -d
```

#### 4. Check Health
```bash
docker-compose ps
curl https://yourdomain.com/health
```

### Option 2: Kubernetes (Recommended for Large Deployments)

#### 1. Build and Push Images
```bash
# Build UI image
docker build -t your-registry/mission-command-ui:latest -f mission-command/ui/Dockerfile .

# Push to registry
docker push your-registry/mission-command-ui:latest
```

#### 2. Create Kubernetes Manifests
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mission-command-ui
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mission-command-ui
  template:
    metadata:
      labels:
        app: mission-command-ui
    spec:
      containers:
      - name: ui
        image: your-registry/mission-command-ui:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### 3. Deploy
```bash
kubectl apply -f k8s/
```

### Option 3: Vercel/Netlify (UI Only)

#### Deploy UI to Vercel
```bash
cd mission-command/ui
vercel --prod
```

**Note:** You'll need to deploy the Mastra Server separately and configure `VITE_MASTRA_API_URL`.

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/mastra
POSTGRES_PASSWORD=your-secure-password

# Redis
REDIS_URL=redis://host:6379

# Authentication
JWT_AUTH_SECRET=your-jwt-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Admin Access
ADMIN_DOMAINS=yourcompany.com
ADMIN_EMAILS=admin@yourcompany.com

# GitHub Token
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

## SSL/TLS Setup

### Using Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (cron)
0 0,12 * * * root certbot renew --quiet
```

### Using Cloudflare (Recommended)

1. Add domain to Cloudflare
2. Enable "Full SSL" in SSL/TLS settings
3. Enable "Auto Minify" for CSS/JS
4. Configure page rules for caching

## Monitoring & Logging

### Application Monitoring

```yaml
# docker-compose.yml
services:
  mission-command-ui:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Health Checks

```bash
# Add to cron
*/5 * * * * curl -f http://localhost:3000/health || echo "UI down" | mail -s "Alert" admin@yourdomain.com
```

### Log Aggregation

Consider using:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Grafana Loki** (lightweight alternative)
- **CloudWatch** (if on AWS)
- **Datadog** (paid, but excellent)

## Performance Optimization

### Nginx Tuning
```nginx
# nginx.conf
worker_processes auto;
worker_connections 2048;
keepalive_timeout 65;
types_hash_max_size 2048;

# Gzip compression
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript;
```

### Database Optimization
```sql
-- Add indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON auth_audit_log(created_at);

-- Connection pooling in application
-- pool: min 2, max 10
```

### CDN Configuration

Serve static assets through CDN:
- AWS CloudFront
- Cloudflare
- Fastly

## Backup Strategy

### Database Backups
```bash
# Daily backup
0 2 * * * pg_dump -U mastra mastra | gzip > /backups/mastra-$(date +\%Y\%m\%d).sql.gz

# Retention: 30 days
find /backups -name "mastra-*.sql.gz" -mtime +30 -delete
```

### Disaster Recovery
1. **RTO** (Recovery Time Objective): 1 hour
2. **RPO** (Recovery Point Objective): 15 minutes
3. **Backup frequency**: Every 15 minutes
4. **Off-site backups**: S3/Glacier for long-term storage

## Scaling Strategy

### Horizontal Scaling
- **UI**: Stateless, can scale horizontally
- **Server**: May need session affinity
- **Database**: Use read replicas for scaling reads

### Load Balancing
```nginx
upstream mission_command_ui {
    least_conn;
    server ui1:3000;
    server ui2:3000;
    server ui3:3000;
}
```

## Security Checklist

- [ ] SSL/TLS enabled
- [ ] Strong password policy
- [ ] JWT secret is >32 characters
- [ ] Database not exposed to internet
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] CSP headers set
- [ ] Regular security updates
- [ ] Audit logging enabled
- [ ] Backup encryption at rest

## Troubleshooting

### Common Issues

**1. UI shows blank page**
- Check nginx error logs: `docker-compose logs ui`
- Verify API URL is correct
- Check browser console for errors

**2. OAuth login fails**
- Verify redirect URIs match OAuth app settings
- Check JWT_SECRET is set
- Review callback URL configuration

**3. Database connection refused**
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure network connectivity

### Debug Mode
```bash
# Enable debug logging
DEBUG=* docker-compose up
```

## Maintenance

### Regular Tasks
- **Daily**: Check disk space, review error logs
- **Weekly**: Review security updates, backup test
- **Monthly**: Review performance metrics, cleanup old logs

### Update Procedure
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d

# Verify health
curl http://localhost:3000/health
```

## Rollback Procedure

### Quick Rollback
```bash
# Git rollback
git revert HEAD
docker-compose up -d --build
```

### Database Rollback
```bash
# Restore from backup
psql -U mastra mastra < /backups/mastra-YYYYMMDD.sql.gz
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/mastra-ai/mastra/issues
- Documentation: https://mastra.ai/docs
- Discord Community: https://discord.gg/mastra

---

**Last Updated:** 2025-12-29
**Version:** 1.0.0
