# ContractWatch – Setup Guide

Below is a **practical, step‑by‑step game plan** you (or a small team) can follow to get the ContractWatch MVP up and running locally, then promoted to staging and production. Everything links back to the architecture in the Technical Design Doc, so you can tick boxes as you go.

---

## 1 . Bootstrap the Monorepo

| Task | Command / Notes |
|------|-----------------|
| **Create repo** | `gh repo create contractwatch --public` |
| **Init monorepo with PNPM workspaces** | `pnpm init -y` → add `packages/api`, `packages/worker`, `packages/web` |
| **Set Node version** | `.nvmrc` ⇒ `20` |
| **Lint / format** | `eslint`, `prettier`, `husky` pre‑commit |

```text
repo/
├─ packages/
│  ├─ api/          # Fastify + tRPC
│  ├─ worker/       # Chain Scan Worker
│  └─ web/          # Next.js dashboard
└─ infra/           # Terraform or Fly.io configs
```

---

## 2 . Stand‑up Core Infrastructure (Docker‑Compose)

```yaml
version: '3.8'
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    environment:
      - POSTGRES_PASSWORD=secret
    ports: ["5432:5432"]

  nats:
    image: nats-streaming:0.25
    command: ["-p", "4222", "-m", "8222", "-store", "file", "-dir", "/data/stan"]
    ports: ["4222:4222", "8222:8222"]

  api:
    build: ./packages/api
    depends_on: [postgres, nats]
    environment:
      - DATABASE_URL=postgres://postgres:secret@postgres:5432/contractwatch
      - NATS_URL=nats://nats:4222
    ports: ["3000:3000"]

  worker:
    build: ./packages/worker
    depends_on: [postgres, nats]
    environment:
      - DATABASE_URL=postgres://postgres:secret@postgres:5432/contractwatch
      - NATS_URL=nats://nats:4222
      - ALCHEMY_KEY=your-key
      - NETWORKS=eth_mainnet,sepolia,polygon,arbitrum
```

Run:

```bash
docker compose up -d postgres nats
pnpm --filter api dev     # launches Fastify locally
pnpm --filter worker dev  # starts scanning Sepolia
```

---

## 3 . Implement the Chain‑Scan Worker (`packages/worker`)

1. **Dependencies**

```bash
pnpm add ethers ws pino nats@2.x pg nanoid
```

2. **Skeleton**

```ts
import { ethers } from "ethers";
import { connect as connectNats } from "nats";
import { Client } from "pg";

async function main() {
  const nats = await connectNats({ servers: process.env.NATS_URL });
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const provider = new ethers.WebSocketProvider(
    `wss://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
  );

  provider.on("block", async (blockNum) => {
    const block = await provider.getBlockWithTransactions(blockNum);
    for (const tx of block.transactions) {
      if (!tx.to) {
        const receipt = await provider.getTransactionReceipt(tx.hash);
        const isWatched = await pg.query(
          "SELECT id FROM wallets WHERE address = $1",
          [tx.from.toLowerCase()]
        );
        if (isWatched.rowCount) {
          const payload = {
            ts: new Date(receipt.timestamp * 1000).toISOString(),
            wallet: tx.from,
            contract: receipt.contractAddress,
            network: "sepolia",
            txHash: tx.hash,
            gas: receipt.gasUsed.toString(),
          };
          // store & publish
          await pg.query(
            "INSERT INTO deployments (ts, wallet_id, network, contract_address, tx_hash, gas_used) VALUES (NOW(), $1, $2, $3, $4, $5)",
            [isWatched.rows[0].id, "sepolia", receipt.contractAddress, tx.hash, receipt.gasUsed]
          );
          nats.publish("deployment.created", JSON.stringify(payload));
        }
      }
    }
  });
}

main().catch(console.error);
```

3. **Unit test** with Hardhat’s `anvil` fork + jest.

---

## 4 . Build the Fastify API (`packages/api`)

1. **Generate tRPC router**

```ts
export const appRouter = t.router({
  addWallet: t.procedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const addr = input.toLowerCase();
    await ctx.db.query(
      "INSERT INTO wallets (id, user_id, address, created_at) VALUES (uuid_generate_v4(), $1, $2, NOW()) ON CONFLICT DO NOTHING",
      [ctx.user.id, addr]
    );
    ctx.nats.publish("wallet.added", addr);
    return { ok: true };
  }),
  listDeployments: t.procedure
    .input(z.object({ wallet: z.string(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const res = await ctx.db.query(
        "SELECT * FROM deployments WHERE wallet_id = (SELECT id FROM wallets WHERE address=$1) ORDER BY ts DESC LIMIT $2",
        [input.wallet.toLowerCase(), input.limit ?? 50]
      );
      return res.rows;
    }),
});
```

2. **JWT** via `@fastify/jwt`; attach `ctx.user`.

3. **Rate‑limit** with `fastify-rate-limit`.

---

## 5 . Front‑End Dashboard (`packages/web`)

1. Scaffold Next.js 14 (`app/` router) + Tailwind.

2. **Pages**
   - `/` Wallet list + “Add wallet” modal
   - `/wallet/[address]` → Timeline table + real‑time WebSocket feed

3. Consume tRPC via `@trpc/next`, use React `useEffect` to subscribe to `ws://api/live`.

4. Use `react-hot-toast` for on‑screen pop notifications when a new deployment is pushed.

---

## 6 . Alerts

1. **Email** with AWS SES SDK (sandbox).  
2. **Discord**: POST to webhook URL.

Simple `sendAlert(user, payload)` helper lives in Notification Service. Retry with exponential back‑off, store failures in `alerts_failed` table.

---

## 7 . Backfill Script

In `packages/worker/scripts/backfill.ts`:

```bash
pnpm ts-node scripts/backfill.ts --wallet 0xabc --network sepolia --blocks 5000
```

Iterates `eth_getLogs` over block ranges and populates `deployments`.

---

## 8 . CI/CD with GitHub Actions

```yaml
name: CI
on:
  push: { branches: [main] }

jobs:
  build-test:
    runs-on: ubuntu-latest
    services:
      postgres: …
      nats: …
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm test

  deploy:
    needs: build-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: superfly/flyctl-actions@1.4
        with:
          args: "deploy --remote-only"
```

---

## 9 . Milestone Checklist (2‑week sprints)

| Sprint | Deliverable |
|--------|-------------|
| **0**  | Repo scaffold, docker‑compose infra booting |
| **1**  | Chain‑scan worker logs Sepolia → Postgres |
| **2**  | API endpoints + wallet add UI |
| **3**  | Real‑time WebSocket updates, email alerts |
| **4**  | Polygon & Arbitrum support, CSV export, staging on Fly.io |
| **5**  | Hardened auth, rate‑limit, Discord alerts — **Beta** |
| **6**  | Prod infra, docs, public MVP launch |

---

## 10 . Developer DX Tips

- **`.env.example`** in repo → copy to `.env` locally.  
- Use **`direnv`** or `dotenv-linter` to keep secrets consistent.  
- For test RPC, use **Anvil** (`foundryup && anvil`) to run regressed unit tests quickly.  
- Embed **`pino`** logger in all services; set up a shared `logger.ts`.  
- Create a **VS Code devcontainer** for contributors: Timescale, NATS, Node 20 pre‑installed.

---

### Ready to code?

Clone the repo, fire up `docker compose up`, and implement the Chain‑Scan Worker first—the rest of the stack can run off that heartbeat. Ping me whenever you hit blockers (e.g., decoding proxy patterns, WebSocket auth), and we’ll iterate!
