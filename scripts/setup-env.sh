#!/bin/bash

# Script to create .env file from 1Password secrets
# Usage: ./scripts/setup-env.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VAULT="DevSecrets"
ITEM="ContractWatch"
ENV_FILE=".env"

echo -e "${YELLOW}🔐 Setting up environment from 1Password...${NC}"

# Check if 1Password CLI is installed
if ! command -v op &> /dev/null; then
    echo -e "${RED}❌ 1Password CLI (op) is not installed${NC}"
    echo "Install it from: https://1password.com/downloads/command-line/"
    exit 1
fi

# Check if signed in to 1Password
if ! op account list &> /dev/null; then
    echo -e "${YELLOW}🔑 Please sign in to 1Password CLI first:${NC}"
    echo "op signin"
    exit 1
fi

echo -e "${GREEN}✅ 1Password CLI is available and signed in${NC}"

# Function to get field from 1Password
get_secret() {
    local field_name="$1"
    local default_value="$2"
    local reveal_flag="$3"  # Add reveal flag parameter
    
    # Try to get the field value from 1Password
    local value
    if [ "$reveal_flag" = "true" ]; then
        value=$(op item get "$ITEM" --vault "$VAULT" --fields "$field_name" --reveal 2>/dev/null || echo "")
    else
        value=$(op item get "$ITEM" --vault "$VAULT" --fields "$field_name" 2>/dev/null || echo "")
    fi
    
    if [ -z "$value" ]; then
        if [ -n "$default_value" ]; then
            echo "$default_value"
        else
            echo ""
        fi
    else
        echo "$value"
    fi
}

echo -e "${YELLOW}📋 Retrieving secrets from 1Password...${NC}"

# Get secrets from 1Password (using --reveal for password fields)
ALCHEMY_KEY=$(get_secret "ALCHEMY_KEY" "" "true")
JWT_SECRET=$(get_secret "JWT_SECRET" "$(openssl rand -base64 32)" "true")
DATABASE_URL=$(get_secret "DATABASE_URL" "postgres://postgres:secret@localhost:5433/contractwatch" "false")
NATS_URL=$(get_secret "NATS_URL" "nats://localhost:4222" "false")
NETWORKS=$(get_secret "NETWORKS" "sepolia" "false")
LOG_LEVEL=$(get_secret "LOG_LEVEL" "info" "false")
CORS_ORIGIN=$(get_secret "CORS_ORIGIN" "http://localhost:3001" "false")

# AWS SES credentials (optional) - using reveal for secret key
AWS_ACCESS_KEY_ID=$(get_secret "AWS_ACCESS_KEY_ID" "" "false")
AWS_SECRET_ACCESS_KEY=$(get_secret "AWS_SECRET_ACCESS_KEY" "" "true")
AWS_REGION=$(get_secret "AWS_REGION" "us-east-1" "false")
FROM_EMAIL=$(get_secret "FROM_EMAIL" "noreply@contractwatch.com" "false")

# Discord webhook (optional) - using reveal for webhook URL
DISCORD_WEBHOOK_URL=$(get_secret "DISCORD_WEBHOOK_URL" "" "true")

# Create .env file
echo -e "${YELLOW}📝 Creating .env file...${NC}"

cat > "$ENV_FILE" << EOF
# Database
DATABASE_URL=$DATABASE_URL

# NATS
NATS_URL=$NATS_URL

# Alchemy API Key (Required)
ALCHEMY_KEY=$ALCHEMY_KEY

# Networks to monitor
NETWORKS=$NETWORKS

# JWT Secret
JWT_SECRET=$JWT_SECRET

# Log Level
LOG_LEVEL=$LOG_LEVEL

# CORS Origin
CORS_ORIGIN=$CORS_ORIGIN

# AWS SES (Optional - for email alerts)
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_REGION=$AWS_REGION
FROM_EMAIL=$FROM_EMAIL

# Discord Webhook (Optional - for Discord alerts)
DISCORD_WEBHOOK_URL=$DISCORD_WEBHOOK_URL
EOF

echo -e "${GREEN}✅ .env file created successfully!${NC}"

# Validate required secrets
echo -e "${YELLOW}🔍 Validating required secrets...${NC}"

if [ -z "$ALCHEMY_KEY" ] || [ "$ALCHEMY_KEY" = "your-alchemy-api-key-here" ]; then
    echo -e "${RED}⚠️  WARNING: ALCHEMY_KEY is missing or using default value${NC}"
    echo "Please add your Alchemy API key to the 'ALCHEMY_KEY' field in 1Password"
    echo "Vault: $VAULT, Item: $ITEM"
else
    echo -e "${GREEN}✅ ALCHEMY_KEY is set${NC}"
fi

if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}⚠️  WARNING: JWT_SECRET is missing${NC}"
else
    echo -e "${GREEN}✅ JWT_SECRET is set${NC}"
fi

echo -e "${GREEN}🚀 Environment setup complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Make sure your Alchemy API key is set in 1Password"
echo "2. Run: ${GREEN}pnpm --filter api dev${NC}"
echo "3. Run: ${GREEN}pnpm --filter worker dev${NC}"
echo "4. Run: ${GREEN}pnpm --filter web dev${NC}" 