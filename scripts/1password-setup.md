# 1Password Setup for ContractWatch

This document explains how to set up the 1Password item for ContractWatch environment variables.

## Prerequisites

1. **Install 1Password CLI**: Download from [1password.com/downloads/command-line/](https://1password.com/downloads/command-line/)
2. **Sign in to 1Password CLI**: Run `op signin` and follow the prompts

## 1Password Item Setup

Create a new item in your **DevSecrets** vault with the following details:

### Basic Information
- **Title**: `ContractWatch`
- **Vault**: `DevSecrets`
- **Category**: `Secure Note` or `API Credential`

### Required Fields

Add the following custom fields to your 1Password item:

#### Essential Fields
| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `ALCHEMY_KEY` | Password | Your Alchemy API key | `your-actual-alchemy-key` |
| `JWT_SECRET` | Password | JWT signing secret | `auto-generated-if-empty` |

#### Database & Infrastructure
| Field Name | Type | Description | Default Value |
|------------|------|-------------|---------------|
| `DATABASE_URL` | Text | PostgreSQL connection string | `postgres://postgres:secret@localhost:5433/contractwatch` |
| `NATS_URL` | Text | NATS server URL | `nats://localhost:4222` |
| `NETWORKS` | Text | Blockchain networks to monitor | `sepolia` |

#### Optional Configuration
| Field Name | Type | Description | Default Value |
|------------|------|-------------|---------------|
| `LOG_LEVEL` | Text | Logging level | `info` |
| `CORS_ORIGIN` | Text | Frontend URL for CORS | `http://localhost:3001` |

#### Optional: Email Alerts (AWS SES)
| Field Name | Type | Description |
|------------|------|-------------|
| `AWS_ACCESS_KEY_ID` | Text | AWS Access Key ID |
| `AWS_SECRET_ACCESS_KEY` | Password | AWS Secret Access Key |
| `AWS_REGION` | Text | AWS Region (e.g., `us-east-1`) |
| `FROM_EMAIL` | Text | Sender email address |

#### Optional: Discord Alerts
| Field Name | Type | Description |
|------------|------|-------------|
| `DISCORD_WEBHOOK_URL` | Password | Discord webhook URL |

## Step-by-Step Setup

### 1. Create the 1Password Item

1. Open 1Password
2. Navigate to the **DevSecrets** vault
3. Click **+ New Item**
4. Choose **Secure Note** or **API Credential**
5. Set the title to **ContractWatch**

### 2. Add Required Fields

For each field listed above:
1. Click **Add Field**
2. Choose the appropriate field type (Text/Password)
3. Set the field name exactly as shown (case-sensitive)
4. Enter the value

### 3. Save the Item

Click **Save** to store your configuration.

## Using the Setup Script

Once your 1Password item is configured:

```bash
# Run the setup script
pnpm setup-env

# Or run directly
./scripts/setup-env.sh
```

The script will:
1. ✅ Check if 1Password CLI is installed and signed in
2. 📋 Retrieve secrets from your 1Password item
3. 📝 Generate the `.env` file
4. 🔍 Validate required secrets
5. 🚀 Show next steps

## Troubleshooting

### Common Issues

**"1Password CLI (op) is not installed"**
- Install the CLI from [1password.com/downloads/command-line/](https://1password.com/downloads/command-line/)

**"Please sign in to 1Password CLI first"**
- Run `op signin` and follow the prompts

**"Item not found"**
- Verify the item name is exactly `ContractWatch`
- Verify the vault name is exactly `DevSecrets`
- Check that you have access to the vault

**"Field not found warnings"**
- Ensure field names match exactly (case-sensitive)
- Add missing required fields to your 1Password item

### Manual Verification

To manually check if your setup is correct:

```bash
# List your vaults
op vault list

# Get item details
op item get "ContractWatch" --vault "DevSecrets"

# Get specific field
op item get "ContractWatch" --vault "DevSecrets" --fields "ALCHEMY_KEY"
```

## Security Notes

- 🔒 Never commit the `.env` file to version control (it's in `.gitignore`)
- 🔑 Use strong, unique passwords for all API keys
- 👥 Only grant access to the DevSecrets vault to team members who need it
- 🔄 Rotate API keys regularly
- 📝 Use 1Password's audit features to track access 