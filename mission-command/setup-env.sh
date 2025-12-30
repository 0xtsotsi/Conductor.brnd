#!/bin/bash

# Mission Command - Environment Setup Script
# This script helps you set up your .env file for local development

set -e

echo "🚀 Mission Command Environment Setup"
echo "====================================="
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    echo ""
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled. Existing .env file preserved."
        exit 0
    fi
    echo "📋 Backing up existing .env to .env.backup..."
    cp .env .env.backup
fi

# Copy from example
echo "📄 Creating .env from .env.example..."
cp .env.example .env

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "📝 Next Steps:"
echo "============="
echo ""
echo "1️⃣  Generate a secure JWT secret:"
echo "   You can use: openssl rand -base64 32"
echo ""
echo "2️⃣  Create GitHub OAuth App:"
echo "   • Go to: https://github.com/settings/developers"
echo "   • Create a new OAuth App"
echo "   • Authorization callback URL: http://localhost:4111/auth/github/callback"
echo "   • Copy the Client ID and Secret to your .env file"
echo ""
echo "3️⃣  Create Google OAuth App (optional):"
echo "   • Go to: https://console.cloud.google.com"
echo "   • Create a new OAuth 2.0 Client ID"
echo "   • Authorized redirect URI: http://localhost:4111/auth/google/callback"
echo "   • Copy the Client ID and Secret to your .env file"
echo ""
echo "4️⃣  Set up PostgreSQL database:"
echo "   • Update DATABASE_URL with your database credentials"
echo "   • Or use the default LibSQL file-based database (no setup required)"
echo ""
echo "5️⃣  Generate GitHub Token:"
echo "   • Go to: https://github.com/settings/tokens"
echo "   • Generate a new personal access token with 'repo' permissions"
echo "   • Copy the token to GITHUB_TOKEN in your .env file"
echo ""
echo "6️⃣  Edit .env file:"
echo "   nano .env  # or use your preferred editor"
echo ""
echo "====================================="
echo "✨ Setup complete! Please update .env with your actual values."
echo ""
