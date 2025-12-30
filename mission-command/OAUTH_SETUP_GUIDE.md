# OAuth Setup Guide for Mission Command

This guide will help you configure OAuth providers (GitHub and Google) for Mission Command authentication.

## Prerequisites

- Mission Command installed locally
- `.env` file created (run `./setup-env.sh` if not)
- GitHub account
- Google account (optional)

## GitHub OAuth Setup

### 1. Create GitHub OAuth App

1. Navigate to: https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in the form:
   - **Application name**: Mission Command (local)
   - **Homepage URL**: `http://localhost:4111`
   - **Authorization callback URL**: `http://localhost:4111/auth/github/callback`
   - **Application description**: Mission Command local development
4. Click **"Register application"**

### 2. Configure GitHub Credentials

1. After registration, you'll see your **Client ID**
2. Click **"Generate a new client secret"**
3. Copy both values to your `.env` file:
   ```bash
   GITHUB_CLIENT_ID=your_actual_github_client_id
   GITHUB_CLIENT_SECRET=your_actual_github_client_secret
   ```

### 3. Generate GitHub Personal Access Token

1. Navigate to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Configure token:
   - **Note**: Mission Command
   - **Expiration**: No expiration (or your preference)
   - **Scopes**: Check **"repo"** (full repository access)
4. Click **"Generate token"**
5. **Important**: Copy the token immediately (you won't see it again)
6. Add to `.env` file:
   ```bash
   GITHUB_TOKEN=ghp_your_actual_token_here
   ```

### 4. Generate Webhook Secret

1. Generate a secure random string:
   ```bash
   openssl rand -base64 32
   ```
2. Add to `.env` file:
   ```bash
   GITHUB_WEBHOOK_SECRET=your_generated_webhook_secret
   ```
3. Save this secret - you'll need it when configuring webhooks in GitHub

## Google OAuth Setup (Optional)

### 1. Create Google Cloud Project

1. Navigate to: https://console.cloud.google.com
2. Create a new project or select existing one
3. Enable Google+ API:
   - Go to **"APIs & Services"** → **"Library"**
   - Search for **"Google+ API"**
   - Click **"Enable"**

### 2. Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **"External"** user type
3. Fill in required information:
   - App name: Mission Command
   - User support email: your email
   - Developer contact: your email
4. Click **"Save and Continue"** (can skip optional fields)

### 3. Create OAuth Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Application type: **"Web application"**
4. Configure:
   - **Name**: Mission Command
   - **Authorized redirect URIs**: `http://localhost:4111/auth/google/callback`
5. Click **"Create"**
6. Copy **Client ID** and **Client Secret** to `.env`:
   ```bash
   GOOGLE_CLIENT_ID=your_actual_google_client_id
   GOOGLE_CLIENT_SECRET=your_actual_google_client_secret
   ```

## JWT Secret Setup

Generate a secure JWT secret for token signing:

```bash
openssl rand -base64 32
```

Add to `.env` file:
```bash
JWT_AUTH_SECRET=your_generated_jwt_secret
```

## Database Configuration

### Option 1: PostgreSQL (Recommended for Production)

1. Install PostgreSQL locally or use Docker:
   ```bash
   docker run --name mission-command-db \
     -e POSTGRES_USER=mission_command \
     -e POSTGRES_PASSWORD=mission_command_password \
     -e POSTGRES_DB=mission_command_db \
     -p 5432:5432 \
     postgres:16
   ```

2. Update `.env` with connection string (already configured):
   ```bash
   DATABASE_URL=postgresql://mission_command:mission_command_password@localhost:5432/mission_command_db
   ```

### Option 2: LibSQL (Good for Development)

The `.env` file is already configured with file-based LibSQL:
```bash
LIBSQL_URL=file:mission-command.db
```

This requires no additional setup - the database file will be created automatically.

## Verification

After configuration, verify your setup:

```bash
# Check all required variables are set
grep -E "^(JWT_AUTH_SECRET|FRONTEND_URL|GITHUB_CLIENT_ID|GITHUB_CLIENT_SECRET|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|DEFAULT_ROLE|DATABASE_URL|LIBSQL_URL)=" .env
```

Expected output should show all variables with actual values (not placeholders).

## Troubleshooting

### GitHub OAuth Not Working

- **Error**: "Redirect URI mismatch"
  - **Fix**: Ensure callback URL in GitHub OAuth App matches `http://localhost:4111/auth/github/callback`

- **Error**: "Invalid client credentials"
  - **Fix**: Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correctly copied

### Google OAuth Not Working

- **Error**: "redirect_uri_mismatch"
  - **Fix**: Ensure authorized redirect URI in Google Console matches `http://localhost:4111/auth/google/callback`

- **Error**: OAuth app not verified (for production)
  - **Fix**: For local development, add your email to "Test users" in OAuth consent screen

### Database Connection Issues

- **PostgreSQL connection refused**
  - **Fix**: Ensure PostgreSQL is running and accessible on port 5432
  - **Fix**: Verify credentials in `DATABASE_URL` match database configuration

- **LibSQL file errors**
  - **Fix**: Ensure application has write permissions in the project directory

## Security Best Practices

1. **Never commit `.env` to version control** (already in `.gitignore`)
2. **Use strong, unique secrets** in production
3. **Rotate secrets periodically**
4. **Use environment-specific configs** (`.env.production`, `.env.staging`)
5. **Limit OAuth app scopes** to minimum required permissions
6. **Set webhook expiration** and use HTTPS in production

## Production Deployment

For production deployment:

1. **Use HTTPS** for all callback URLs
2. **Set secure cookies** (automatically enabled with HTTPS)
3. **Use production database** (managed PostgreSQL, not local)
4. **Generate production JWT secret** (at least 32 characters)
5. **Configure CORS** properly for your domain
6. **Set up proper logging** and monitoring
7. **Use secrets management** (AWS Secrets Manager, HashiCorp Vault, etc.)

## Quick Start Commands

```bash
# 1. Setup environment file
./setup-env.sh

# 2. Edit with your credentials
nano .env

# 3. Generate secure secrets
openssl rand -base64 32

# 4. Start PostgreSQL (if using)
docker-compose up -d

# 5. Start Mission Command
pnpm dev

# 6. Access the application
open http://localhost:4111
```

## Additional Resources

- [GitHub OAuth Apps Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [LibSQL Documentation](https://turso.tech/docs/libsql)

## Support

If you encounter issues:
1. Check server logs: `pnpm dev` (look for OAuth errors)
2. Verify environment variables: `cat .env`
3. Test database connection: `psql $DATABASE_URL` (for PostgreSQL)
4. Review this guide and ensure all steps are completed correctly
