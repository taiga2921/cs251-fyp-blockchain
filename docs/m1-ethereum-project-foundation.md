# M1 — Ethereum Project Foundation

**Milestone:** M1  
**Status:** Complete  
**Folder:** `blockchain-ethereum-v1/`  
**Related documents:** [`m0-architecture-finalization-and-repository-split.md`](m0-architecture-finalization-and-repository-split.md), [`../blockchain-module.md`](../blockchain-module.md)

---

## 1. Milestone Summary

M1 establishes a working **Hardhat Ethereum project** with the minimal **`EvidenceStore`** smart contract. The contract compiles, passes automated tests, deploys to **local Ganache**, and exports deployment metadata for future Laravel configuration.

**Deliverables:**

- Hardhat toolchain (`package.json`, `hardhat.config.js`, `.env.example`)
- `EvidenceStore.sol` — hash-only on-chain storage
- Hardhat tests (13 cases)
- Ganache deploy, ABI export, and deployment verification scripts
- `deployments/ganache/EvidenceStore.json` (generated after Ganache deploy)

**Explicitly not delivered in M1:** Laravel RPC integration, queue jobs, Sepolia deployment, React dashboard, ANPR auto-anchoring.

---

## 2. Objective

Initialize the Ethereum side of the hybrid blockchain architecture:

1. Create a maintainable Hardhat project in `blockchain-ethereum-v1/`.
2. Implement and test a minimal owner-gated hash store contract.
3. Deploy to Ganache and produce a machine-readable deployment artifact (address, chain ID, ABI, deployment transaction hash).
4. Verify end-to-end that the owner can `storeHash` and `verifyHash` on a live Ganache instance.

---

## 3. Scope

| Area | M1 work |
| --- | --- |
| Solidity | `EvidenceStore` — `bytes32` hash mapping, owner access control |
| Hardhat | Compiler `0.8.20`, local `hardhat` + `ganache` networks |
| Tests | Owner store/verify, events, duplicates, zero hash, ownership transfer |
| Scripts | `deploy-ganache.js`, `export-abi.js`, `verify-deployment.js` |
| Artifacts | `deployments/ganache/EvidenceStore.json`, optional `EvidenceStore.abi.json` |
| Documentation | README, this document |

---

## 4. Out of Scope

| Item | Target milestone |
| --- | --- |
| Laravel `EthereumRpcClient` | M6 |
| `AnchorBlockchainRecordJob` / queue jobs | M6–M7 |
| `config/blockchain.php` / Laravel `.env` wiring | M3 |
| `blockchain_jobs`, `blockchain_verifications` tables | M2 |
| Sepolia deploy script and `deployments/sepolia/` JSON | M9 |
| React `feature/blockchain-monitoring` | M11 |
| ANPR automatic anchoring on event create | M10 |
| AI ANPR Ethereum calls | Never (Laravel only) |

---

## 5. Architecture Alignment

| Module | M1 role |
| --- | --- |
| `blockchain-ethereum-v1` | Contract source, compile, test, Ganache deploy, deployment JSON |
| `backend-laravel-v1` | Unchanged for M1 — still read-only `BlockchainRecord` APIs; no RPC client |
| `frontend-react-v1` | Unchanged — no Ethereum RPC; dashboard remains planned (M11) |
| `ai-anpr-v1` | Unchanged — sends data to Laravel only |

**Privacy:** Only deterministic `bytes32` hashes may be stored on-chain. Verification scripts use a fixed harmless label (`m1-verification-sample-v1`) for SHA-256 sample hashes—not real evidence.

---

## 6. Files Created or Updated

| Path | Description |
| --- | --- |
| `package.json` | npm scripts: `compile`, `test`, `deploy:ganache`, `verify:ganache`, `export:abi` |
| `package-lock.json` | Locked dependency tree |
| `hardhat.config.js` | Solidity `0.8.20`, `ganache` network from `GANACHE_RPC_URL` |
| `.env.example` | Safe placeholders (no secrets) |
| `contracts/EvidenceStore.sol` | Minimal hash store contract |
| `test/EvidenceStore.test.js` | 13 Hardhat tests |
| `scripts/deploy-ganache.js` | Deploy and write `deployments/ganache/EvidenceStore.json` |
| `scripts/export-abi.js` | Refresh ABI from compiled artifact |
| `scripts/verify-deployment.js` | Store + verify harmless sample hash on Ganache |
| `scripts/lib/signer.js` | Deployer/owner signer resolution |
| `scripts/lib/sampleHash.js` | Deterministic non-sensitive sample hash |
| `deployments/ganache/EvidenceStore.json` | Post-deploy metadata (commit-ready) |
| `deployments/ganache/EvidenceStore.abi.json` | Standalone ABI export |
| `deployments/sepolia/.gitkeep` | M9 placeholder |
| `README.md` | Updated for M1 |

---

## 7. Smart Contract Design

**Contract:** `EvidenceStore` (`pragma solidity ^0.8.20`)

| Function / element | Behavior |
| --- | --- |
| `owner` | Set to `msg.sender` in constructor |
| `storeHash(bytes32)` | Owner only; rejects `bytes32(0)` and duplicates; emits `HashStored` |
| `verifyHash(bytes32)` | `view` — returns whether hash was stored |
| `transferOwnership(address)` | Owner only; rejects zero address; emits `OwnershipTransferred` |
| Storage | Private `mapping(bytes32 => bool) stored` — **hash flags only** |

No application entities, strings, metadata, plate fields, GPS, or JSON on-chain.

---

## 8. Hardhat Project Setup

**Dependencies (dev):**

- `hardhat` ^2.22.x
- `@nomicfoundation/hardhat-toolbox` ^5.0.0
- `dotenv` ^16.4.x

**Networks (`hardhat.config.js`):**

| Network | URL | Accounts |
| --- | --- | --- |
| `hardhat` | In-process (tests) | Default Hardhat accounts |
| `ganache` | `GANACHE_RPC_URL` or `http://127.0.0.1:7545` | `DEPLOYER_PRIVATE_KEY` if set; else Ganache `eth_accounts` in scripts |

**npm scripts:**

```json
"compile": "hardhat compile",
"test": "hardhat test",
"deploy:ganache": "hardhat run scripts/deploy-ganache.js --network ganache",
"verify:ganache": "hardhat run scripts/verify-deployment.js --network ganache",
"export:abi": "hardhat run scripts/export-abi.js"
```

---

## 9. Deployment Artifact Design

**Path:** `deployments/ganache/EvidenceStore.json`

| Field | Description |
| --- | --- |
| `contractName` | `"EvidenceStore"` |
| `network` | `"ganache"` |
| `chainId` | Actual chain ID from provider (e.g. `1337`) |
| `address` | Deployed contract address |
| `deployer` | Deployer wallet address |
| `deploymentTxHash` | Contract creation transaction hash |
| `deployedAt` | ISO-8601 UTC timestamp |
| `abi` | Full contract ABI from Hardhat artifact |

**Security:** The JSON contains **no private keys**. Addresses and transaction hashes are public on-chain data.

Laravel will consume this file in **M3** (`BLOCKCHAIN_CONTRACT_ABI_PATH`) and **M6** (anchoring).

---

## 10. Ganache Deployment Flow

```text
Start Ganache (127.0.0.1:7545)
        ↓
npm run deploy:ganache
        ↓
EvidenceStore.deploy() via deploy-ganache.js
        ↓
Read chainId, tx hash, ABI from artifact
        ↓
Write deployments/ganache/EvidenceStore.json
        ↓
Console deployment summary
```

**Signer resolution:** If `DEPLOYER_PRIVATE_KEY` is set in local `.env`, Hardhat uses it. Otherwise `getDeployerSigner()` uses the first unlocked account from Ganache `eth_accounts`.

---

## 11. Verification Script Flow

```text
Read deployments/ganache/EvidenceStore.json
        ↓
Connect EvidenceStore at deployed address
        ↓
sampleHash = SHA-256("m1-verification-sample-v1") as bytes32
        ↓
If not stored → owner calls storeHash(sampleHash)
        ↓
verifyHash(sampleHash) must return true
        ↓
Print success summary (address, chainId, hash, tx hash if any)
```

Re-running verification is idempotent: if the sample hash is already stored, no new transaction is submitted.

---

## 12. Testing Summary

**Command:** `npm test` (`hardhat test`)

**File:** `test/EvidenceStore.test.js`

| # | Test case | Result |
| --- | --- | --- |
| 1 | Deploys with deployer as owner | Pass |
| 2 | Owner can store valid hash | Pass |
| 3 | `HashStored` event (hash + sender) | Pass |
| 4 | `verifyHash(stored)` → `true` | Pass |
| 5 | `verifyHash(unknown)` → `false` | Pass |
| 6 | Rejects `bytes32(0)` | Pass |
| 7 | Rejects duplicate hash | Pass |
| 8 | Non-owner cannot store | Pass |
| 9 | Owner can transfer ownership | Pass |
| 10 | `OwnershipTransferred` event | Pass |
| 11 | Old owner cannot store after transfer | Pass |
| 12 | New owner can store after transfer | Pass |
| 13 | Rejects zero-address transfer | Pass |

**Total:** 13 passing (Hardhat in-memory network).

Test hashes use `keccak256(utf8Bytes(label))` with harmless labels (e.g. `m1-test-hash-alpha`).

---

## 13. Security and Privacy Rules

| Rule | M1 enforcement |
| --- | --- |
| Hash-only on-chain | Contract stores `bytes32` flags only |
| No secrets in Git | `.gitignore` excludes `.env`; `.env.example` has empty key placeholders |
| No sensitive verification data | Sample hash from fixed non-evidence string |
| Owner-only writes | `onlyOwner` on `storeHash` |
| Local keys only | `DEPLOYER_PRIVATE_KEY` read from local `.env` when provided |

---

## 14. Known Limitations

1. **Ganache required for deploy/verify scripts** — `npm run deploy:ganache` fails if nothing listens on `GANACHE_RPC_URL`.
2. **Deployment JSON is environment-specific** — Re-deploying to a fresh Ganache workspace produces a new address; Laravel env must be updated accordingly in M3/M6.
3. **Sepolia not implemented** — `deployments/sepolia/` is a placeholder for M9.
4. **No Laravel integration** — Backend does not read deployment JSON or call the contract yet.
5. **Ganache chain ID** — Stored from live provider; do not assume `1337` without checking the artifact.

---

## 15. Acceptance Criteria

| Criterion | Met |
| --- | --- |
| `npm install` works | Yes |
| `EvidenceStore.sol` compiles | Yes |
| `npm test` passes (13 tests) | Yes |
| Ganache deploy script implemented | Yes |
| Deploy succeeds when Ganache is available | Yes (verified in dev session) |
| `deployments/ganache/EvidenceStore.json` contains address, chainId, ABI, deploymentTxHash | Yes |
| Verification script stores and verifies sample hash | Yes |
| M1 documentation exists | Yes |
| README reflects M1 | Yes |
| No private keys or sensitive data committed | Yes |
| No Laravel anchoring, frontend dashboard, Sepolia, or AI Ethereum calls | Yes |

---

## 16. Handoff to M2

**M2 — Laravel database foundation** (in `backend-laravel-v1/`) should:

1. Add or extend migrations for `blockchain_jobs` and `blockchain_verifications` if not present.
2. Align `blockchain_records` schema with `blockchain-module.md` (proof types, canonical version, etc.) where gaps exist.
3. Add Eloquent models, factories, and API resources.

**Inputs from M1 for later Laravel milestones:**

| Artifact | Used in |
| --- | --- |
| `deployments/ganache/EvidenceStore.json` | M3 `BLOCKCHAIN_CONTRACT_ABI_PATH`, M6 RPC client |
| Contract ABI `storeHash(bytes32)` / `verifyHash(bytes32)` | M6 transaction encoding |
| Ganache `chainId` + `address` | M3 `.env` / `config/blockchain.php` |

Do **not** start Laravel anchoring until M3 (config) and M4 (hashing) are in place; first live anchor target is **M6**.

---

## 17. References

- [`../README.md`](../README.md)
- [`m0-architecture-finalization-and-repository-split.md`](m0-architecture-finalization-and-repository-split.md)
- [`../blockchain-module.md`](../blockchain-module.md) — §11 Smart Contract Design, §M1 milestone table
- [`../../backend-laravel-v1/documentation.md`](../../backend-laravel-v1/documentation.md)
- [`../../frontend-react-v1/documentation.md`](../../frontend-react-v1/documentation.md)
- [Hardhat documentation](https://hardhat.org/docs)
