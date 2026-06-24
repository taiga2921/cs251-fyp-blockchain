# blockchain-ethereum-v1

Ethereum smart contract project for the FYP surveillance platform **Blockchain Module**.

This folder holds **Solidity, Hardhat, contract tests, deployment scripts, and deployment metadata only**. It is intentionally separated from `backend-laravel-v1/` so PHP/Composer and Node/Hardhat toolchains do not mix.

## Purpose

The Blockchain Module provides a **tamper-evident proof layer**: Laravel stores operational data and deterministic hashes in the database; this project hosts the minimal on-chain `EvidenceStore` contract that stores and verifies those hashes on Ganache (local) or Sepolia (testnet, **M9**).

**Laravel remains the source of truth.** React and AI ANPR call Laravel APIs only—they do not talk to Ethereum directly.

## Hash-only on-chain rule

The contract stores **only `bytes32` hashes**. It does **not** store plate numbers, GPS coordinates, user data, images, patrol routes, or raw JSON evidence.

## M9 status

**Milestone M9 — Sepolia deployment** is complete:

- Hardhat `sepolia` network (`SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY`, chain ID `11155111`)
- `npm run deploy:sepolia` → `deployments/sepolia/EvidenceStore.json`
- `npm run verify:sepolia` — network-aware deployment verification
- Laravel Sepolia anchoring via `eth_sendRawTransaction` (`EthereumTransactionSigner` + `EthereumRpcClient`)

See [`docs/m9-sepolia-deployment.md`](docs/m9-sepolia-deployment.md) for setup, Laravel configuration, and manual smoke-test steps.

Laravel does **not** implement M10 ANPR auto-anchoring or M11 dashboard UI in M9.

## M8 status

**Milestone M8 — Verification system** is complete in `backend-laravel-v1/`:

- `App\Services\Blockchain\BlockchainVerificationService` — recompute hash, compare locally, on-chain `verifyHash(bytes32)` via `eth_call`
- `POST /api/blockchain-records/{id}/verify` — Admin + Security Operator manual verification
- Persists `blockchain_verifications` and `blockchain_jobs` (`job_type = verify`)

Laravel does **not** implement Sepolia deployment (M9), M10 auto-anchoring, or M11 dashboard UI in M8.

## M7 status

**Milestone M7 — Retry and failure handling** is complete in `backend-laravel-v1/`:

- `App\Services\Blockchain\BlockchainRetryService` — exponential backoff, retry eligibility, error sanitization
- Refactored `App\Jobs\AnchorBlockchainRecordJob` — business retries with `retry_anchor` audit rows
- `POST /api/blockchain-records/{id}/retry` — Admin-only manual retry
- Receipt-first recovery when `tx_hash` exists (no duplicate `storeHash`)

Laravel does **not** implement Sepolia anchoring, M8 verification APIs, M10 auto-anchoring, or M11 dashboard UI in M7.

## M6 status

**Milestone M6 — Ganache anchoring end-to-end** is complete in `backend-laravel-v1/`:

- `App\Services\Blockchain\EthereumRpcClient` — Ganache JSON-RPC (`eth_sendTransaction` for `storeHash(bytes32)`)
- `App\Jobs\AnchorBlockchainRecordJob` — anchoring worker with `blockchain_jobs` audit rows
- `BlockchainRecordService` dispatches anchoring when `BLOCKCHAIN_ENABLED=true`

Laravel does **not** implement Sepolia anchoring, M8 verification APIs, or M11 dashboard UI in M6.

## M5 status

**Milestone M5 — Blockchain record service and read APIs** is complete in `backend-laravel-v1/`:

- `App\Services\Blockchain\BlockchainRecordService` — idempotent pending `blockchain_records` creation
- Uses M4 `BlockchainHashService` for `record_hash` and proof metadata
- Read APIs: `GET /api/blockchain-records`, `GET /api/blockchain-records/{id}` (Admin + Security Operator)

Laravel still does **not** submit transactions, call RPC, or dispatch anchoring queue jobs from M5.

## M4 status

**Milestone M4 — Deterministic hashing architecture** is complete in `backend-laravel-v1/`:

- `App\Support\BlockchainCanonicalJson` — stable canonical JSON encoding
- `App\Services\Blockchain\BlockchainHashService` — SHA-256 hashing for supported entities (`AnprEvent` v1)
- Uses M3 config: `BLOCKCHAIN_CANONICAL_VERSION`, `BLOCKCHAIN_HASH_ALGORITHM`

Laravel still does **not** create `blockchain_records` rows, submit transactions, or call RPC from M4.

## M3 status

**Milestone M3 — Configuration and environment management** is complete in `backend-laravel-v1/`:

- Laravel reads blockchain settings from `backend-laravel-v1/config/blockchain.php` and `BLOCKCHAIN_*` env vars
- Validation command: `php artisan blockchain:check-config` (from the Laravel app directory)
- Blockchain is **disabled by default** (`BLOCKCHAIN_ENABLED=false`)

This Ethereum folder still contains **contract tooling only**. Laravel does **not** submit transactions or call RPC from M3.

## M1 status

**Milestone M1 — Ethereum project foundation is complete** in this folder:

- Hardhat project initialized (`package.json`, `hardhat.config.js`)
- `contracts/EvidenceStore.sol` implemented and compiled
- Hardhat tests in `test/EvidenceStore.test.js` (13 cases)
- Ganache deploy script: `scripts/deploy-ganache.js`
- ABI export: `scripts/export-abi.js`
- Deployment verification: `scripts/verify-deployment.js`
- Deployment artifact: `deployments/ganache/EvidenceStore.json` (after Ganache deploy)

**Not in M1:** Laravel anchoring, Ethereum RPC clients, queue jobs, Sepolia deployment (**M9**), React blockchain dashboard (**M11**), ANPR auto-anchoring (**M10**).

## Setup

```bash
cd blockchain-ethereum-v1
npm install
cp .env.example .env   # optional — edit GANACHE_RPC_URL / DEPLOYER_PRIVATE_KEY locally only
```

Never commit `.env` or private keys.

## Compile and test

```bash
npm run compile
npm test
```

## Ganache deployment

1. Start Ganache (default RPC `http://127.0.0.1:7545`).
2. Optionally set `GANACHE_RPC_URL` and `DEPLOYER_PRIVATE_KEY` in local `.env`. If `DEPLOYER_PRIVATE_KEY` is empty, scripts use Ganache unlocked `eth_accounts`.
3. Deploy:

```bash
npm run deploy:ganache
```

4. Verify one harmless sample hash on the deployed contract (includes chain ID and bytecode sanity checks):

```bash
npm run verify:ganache
```

5. Refresh ABI in deployment JSON (no Ganache required):

```bash
npm run export:abi
```

## Sepolia deployment (M9)

1. Set `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` in local `.env` (never commit private keys). The wallet needs Sepolia ETH.
2. Deploy:

```bash
npm run deploy:sepolia
```

3. Verify sample hash on the deployed contract:

```bash
npm run verify:sepolia
```

4. Copy `address` from `deployments/sepolia/EvidenceStore.json` into Laravel `BLOCKCHAIN_CONTRACT_ADDRESS`.

### Deployment JSON

After `npm run deploy:ganache`, metadata is written to:

```text
deployments/ganache/EvidenceStore.json
```

Fields include `contractName`, `network`, `chainId`, `address`, `deployer`, `deploymentTxHash`, `deployedAt`, and `abi`. Laravel will reference this path in later milestones (**M3+** config, **M6+** anchoring)—not the React frontend.

## Project layout

```text
blockchain-ethereum-v1/
├── contracts/EvidenceStore.sol
├── scripts/
│   ├── deploy-ganache.js
│   ├── deploy-sepolia.js
│   ├── export-abi.js
│   ├── verify-deployment.js
│   └── lib/
├── test/EvidenceStore.test.js
├── deployments/
│   ├── ganache/EvidenceStore.json
│   └── sepolia/EvidenceStore.json   # after M9 deploy
└── docs/
    ├── m0-architecture-finalization-and-repository-split.md
    ├── m1-ethereum-project-foundation.md
    ├── m2-laravel-database-foundation.md
    ├── m3-configuration-and-environment-management.md
    ├── m4-deterministic-hashing-architecture.md
    ├── m5-blockchain-record-service-and-read-apis.md
    ├── m6-ganache-anchoring-end-to-end.md
    ├── m7-retry-and-failure-handling.md
    ├── m8-verification-system.md
    └── m9-sepolia-deployment.md
```

## What does **not** belong here

- Laravel services, controllers, models, or migrations
- React dashboard or API client code
- AI ANPR runtime or evidence pipelines
- Private keys, wallet mnemonics, or raw evidence

## Documentation

- [`docs/m9-sepolia-deployment.md`](docs/m9-sepolia-deployment.md) — M9 Sepolia deployment summary
- [`docs/m8-verification-system.md`](docs/m8-verification-system.md) — M8 Laravel verification summary
- [`docs/m7-retry-and-failure-handling.md`](docs/m7-retry-and-failure-handling.md) — M7 Laravel retry/failure handling summary
- [`docs/m6-ganache-anchoring-end-to-end.md`](docs/m6-ganache-anchoring-end-to-end.md) — M6 Laravel Ganache anchoring summary
- [`docs/m5-blockchain-record-service-and-read-apis.md`](docs/m5-blockchain-record-service-and-read-apis.md) — M5 Laravel record service summary
- [`docs/m4-deterministic-hashing-architecture.md`](docs/m4-deterministic-hashing-architecture.md) — M4 Laravel hashing summary
- [`docs/m3-configuration-and-environment-management.md`](docs/m3-configuration-and-environment-management.md) — M3 Laravel config summary
- [`docs/m2-laravel-database-foundation.md`](docs/m2-laravel-database-foundation.md) — M2 database/models summary
- [`docs/m1-ethereum-project-foundation.md`](docs/m1-ethereum-project-foundation.md) — M1 implementation summary
- [`docs/m0-architecture-finalization-and-repository-split.md`](docs/m0-architecture-finalization-and-repository-split.md) — M0 architecture decisions
- [`blockchain-module.md`](blockchain-module.md) — full module plan (M0–M13)

## Next milestones

| Milestone | Scope |
| --- | --- |
| **M4** (Laravel) | Deterministic hashing (`BlockchainHashService`) — **complete** |
| **M5** (Laravel) | `BlockchainRecordService` — pending proof rows — **complete** |
| **M6** (Laravel) | Ganache anchoring (`EthereumRpcClient`, `AnchorBlockchainRecordJob`) — **complete** |
| **M7** (Laravel) | Retry strategy and failure handling — **complete** |
| **M8** (Laravel) | Verification system — **complete** |
| **M9** (this folder + Laravel) | Sepolia deployment and signed anchoring — **complete** |
| **M11** (frontend) | Blockchain monitoring dashboard via Laravel APIs |
