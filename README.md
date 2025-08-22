# ContractWatch MVP

A real-time smart contract deployment monitoring system.

## Architecture

This monorepo contains:

- **`packages/worker`** - Blockchain scanning service (Node.js + ethers.js)
- **`packages/api`** - Backend API (Fastify + tRPC)
- **`packages/web`** - Frontend dashboard (Next.js + React)

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PNPM package manager
- Alchemy API key
- 1Password CLI (optional, for secure environment setup)

### Installation

1. **Clone and setup**:
```bash
git clone <repo-url>
cd contractwatch
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Setup environment variables**:

**Option A: Using 1Password (Recommended)**
```bash
# Setup your 1Password item first (see scripts/1password-setup.md)
pnpm setup-env
```

**Option B: Manual setup**
```bash
cp .env.example .env
# Edit .env with your actual values
```

4. **Start infrastructure**:
```bash
docker compose up -d postgres nats
```

5. **Start services**:
```bash
# Terminal 1: API
pnpm --filter api dev

# Terminal 2: Worker
pnpm --filter worker dev

# Terminal 3: Web
pnpm --filter web dev
```

6. **Open dashboard**:
```
http://localhost:3001
```

## Environment Setup

### 🔐 1Password Integration (Recommended)

For secure secret management, use the included 1Password integration:

1. **Setup 1Password item**: Follow the guide in [`scripts/1password-setup.md`](scripts/1password-setup.md)
2. **Run setup script**: `pnpm setup-env`

This will securely pull all secrets from your 1Password vault and create the `.env` file.

### 📝 Manual Setup

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgres://postgres:secret@localhost:5433/contractwatch

# NATS
NATS_URL=nats://localhost:4222

# Alchemy API Key (Required)
ALCHEMY_KEY=your-alchemy-api-key-here

# Networks to monitor
NETWORKS=sepolia,polygon,arbitrum

# JWT Secret
JWT_SECRET=your-jwt-secret-here
```

## Usage

### Adding Wallets

1. Open the dashboard at `http://localhost:3001`
2. Click "Add Wallet"
3. Enter an Ethereum wallet address
4. The system will monitor all contract deployments from this address

### Real-time Monitoring

- Contract deployments are detected in real-time
- WebSocket updates push new deployments to the dashboard
- View deployment history and statistics

### API Endpoints

The API runs on `http://localhost:3000`:

- `GET /health` - Health check
- `POST /trpc/addWallet` - Add wallet for monitoring
- `GET /trpc/getWallets` - List monitored wallets
- `GET /trpc/listDeployments` - Get deployment history
- `WebSocket /live` - Real-time deployment updates

### Backfill Historical Data

To backfill historical deployments:

```bash
cd packages/worker
pnpm backfill --wallet 0x1234... --network sepolia --blocks 5000
```

## Development

### Project Structure

```
contractwatch/
├── packages/
│   ├── api/          # Fastify + tRPC backend
│   ├── worker/       # Blockchain scanner
│   └── web/          # Next.js frontend
├── scripts/
│   ├── setup-env.sh       # 1Password environment setup
│   └── 1password-setup.md # 1Password configuration guide
├── docker-compose.yml
├── package.json
└── README.md
```

### Database Schema

The system uses PostgreSQL with TimescaleDB:

```sql
-- Wallets being monitored
CREATE TABLE wallets (
  id UUID PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contract deployments
CREATE TABLE deployments (
  id UUID PRIMARY KEY,
  ts TIMESTAMP NOT NULL,
  wallet_id UUID REFERENCES wallets(id),
  network TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  gas_used BIGINT
);
```

### Supported Networks

- Ethereum Mainnet (`eth_mainnet`)
- Sepolia Testnet (`sepolia`)
- Polygon (`polygon`)
- Arbitrum (`arbitrum`)

### Available Scripts

```bash
# Environment setup
pnpm setup-env              # Setup .env from 1Password

# Development
pnpm dev                     # Start all services
pnpm --filter api dev        # Start API only
pnpm --filter worker dev     # Start worker only
pnpm --filter web dev        # Start web only

# Building
pnpm build                   # Build all packages
pnpm test                    # Run all tests

# Code quality
pnpm lint                    # Lint all code
pnpm format                  # Format all code
```

### Testing

```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter api test
pnpm --filter worker test
pnpm --filter web test
```

## Deployment

### Docker Build

```bash
# Build all services
docker compose build

# Run in production
docker compose up -d
```

### Environment Setup

For production deployment:

1. Set up PostgreSQL with TimescaleDB
2. Configure NATS streaming server
3. Set environment variables for production
4. Deploy using Docker Compose or Kubernetes

## Security

- 🔒 Environment variables are managed via 1Password
- 🔑 JWT authentication for API access
- 👥 Rate limiting on API endpoints
- 🔐 Secure WebSocket connections
- 📝 Audit logging for all operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License 
