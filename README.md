# blockchain-ethereum-v1

Ethereum smart contract project for the FYP surveillance platform **Blockchain Module**.

This folder holds **Solidity, Hardhat, and deployment artifacts only**. It is intentionally separated from `backend-laravel-v1/` so PHP/Composer and Node/Hardhat toolchains do not mix.

## Purpose

The Blockchain Module provides a **tamper-evident proof layer**: Laravel stores operational data and deterministic hashes in the database; this project will host the minimal on-chain contract that stores and verifies those hashes on Ganache (local) or Sepolia (testnet).

## Why this folder is separate from Laravel

| Concern | `backend-laravel-v1/` | `blockchain-ethereum-v1/` |
| --- | --- | --- |
| Runtime | PHP, Laravel, Composer | Node.js, Hardhat, npm |
| Responsibility | Application logic, DB, queues, RPC calls, APIs | Solidity source, compile, test, deploy |
| Secrets | Server `.env` (RPC URL, wallet private key) | Never commit keys; deployment config via env at M1+ |

Laravel remains the **source of truth** and the only component that submits transactions. React and AI ANPR call Laravel APIs only—they do not talk to Ethereum directly.

## What belongs here (M1 and later)

- Solidity contracts (e.g. minimal hash store / verify contract)
- `hardhat.config.js` and `package.json`
- Contract unit tests (`test/`)
- Deployment scripts (`scripts/`)
- ABI and deployment JSON under `deployments/` (Ganache, Sepolia)

## What does **not** belong here

- Laravel services, controllers, models, or migrations
- Application database schemas or business rules
- React dashboard or API client code
- AI ANPR runtime or evidence pipelines
- Private keys, wallet mnemonics, or raw ANPR/patrol evidence
- Plate numbers, GPS coordinates, images, or full JSON payloads (on-chain storage is **hash-only**)

## M0 status

**Milestone M0 (architecture finalization and repository split) is complete for this folder.**

Current contents are documentation and placeholder directories only. There is **no** Hardhat project, **no** `EvidenceStore.sol`, and **no** deployment tooling yet.

## Next milestone (M1)

**M1 — Ethereum project foundation:** initialize Hardhat, add and test the hash storage contract, deploy to Ganache, and export deployment metadata for Laravel configuration.

See:

- [`docs/m0-architecture-finalization-and-repository-split.md`](docs/m0-architecture-finalization-and-repository-split.md) — M0 decisions and acceptance criteria
- [`../blockchain-module.md`](../blockchain-module.md) — full module architecture and milestone plan
