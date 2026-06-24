# M10 — ANPR Module Integration

**Milestone:** M10  
**Status:** Complete  
**Implementation repositories:** `backend-laravel-v1`, `frontend-react-v1` (detail visibility only)  
**Prior milestone:** M9 — Sepolia Deployment

## Milestone summary

M10 connects the existing ANPR ingest flow to the blockchain services delivered in M4–M9. When blockchain is enabled, Laravel automatically creates privacy-safe proof records for new ANPR events and uploaded evidence images, queues asynchronous anchoring through `AnchorBlockchainRecordJob`, and exposes safe proof status on the ANPR event detail API. ANPR APIs never wait for Ethereum confirmation. When `BLOCKCHAIN_ENABLED=false`, ANPR behavior is unchanged and no automatic proofs or anchoring jobs are created.

## Architecture summary

```text
AI ANPR / React
    ↓ HTTP (Laravel API only)
AnprEventController@store / AnprImageController@uploadForEvent
    ↓ persist ANPR row + vehicle link / file storage
BlockchainAnprIntegrationService (when BLOCKCHAIN_ENABLED=true)
    ↓
BlockchainRecordService::createForEntity(...)
    ↓ pending blockchain_records row
AnchorBlockchainRecordJob (async queue)
    ↓
EthereumRpcClient → Ganache or Sepolia EvidenceStore.storeHash(bytes32)
```

**Design choices:**

- Backend-managed blockchain linkage; clients cannot supply `blockchain_record_id` on ANPR create/update.
- Automatic proof creation is skipped entirely when blockchain is disabled (no pending rows, no queue dispatch).
- Blockchain configuration failures during automatic proof creation are logged and do not fail ANPR writes.
- Image file replacement reuses the same `anpr_images` row; existing proof rows remain idempotent by entity/proof/environment. Verification may report **tampered** if file metadata or content changes after anchoring.

## Files changed

| Repository | Path | Change |
|------------|------|--------|
| backend-laravel-v1 | `app/Services/Blockchain/BlockchainAnprIntegrationService.php` | **Added** — ANPR auto-proof orchestration |
| backend-laravel-v1 | `app/Services/Blockchain/BlockchainHashService.php` | **Extended** — `AnprImage` canonical payloads and safe file hashing |
| backend-laravel-v1 | `app/Services/Blockchain/BlockchainRecordService.php` | **Extended** — `AnprImage` payload summaries |
| backend-laravel-v1 | `app/Services/Blockchain/BlockchainVerificationService.php` | **Extended** — verify `anpr_image` records |
| backend-laravel-v1 | `app/Http/Controllers/Api/AnprEventController.php` | **Updated** — auto event proof; prohibit client `blockchain_record_id`; detail proof loading |
| backend-laravel-v1 | `app/Http/Controllers/Api/AnprImageController.php` | **Updated** — auto image proof on upload/store |
| backend-laravel-v1 | `app/Http/Resources/BlockchainProofSummaryResource.php` | **Added** — safe public proof fields |
| backend-laravel-v1 | `app/Http/Resources/AnprEventResource.php` | **Updated** — event + image proof visibility |
| backend-laravel-v1 | `app/Http/Resources/AnprImageResource.php` | **Updated** — optional image proof field |
| backend-laravel-v1 | `tests/Feature/Blockchain/AnprBlockchainIntegrationTest.php` | **Added** — integration feature tests |
| backend-laravel-v1 | `tests/Unit/Blockchain/BlockchainHashServiceTest.php` | **Extended** — `AnprImage` hash tests |
| backend-laravel-v1 | `tests/Unit/Blockchain/BlockchainRecordServiceTest.php` | **Extended** — image summary/idempotency tests |
| backend-laravel-v1 | `tests/Unit/Blockchain/BlockchainVerificationServiceTest.php` | **Extended** — image verification tests |
| frontend-react-v1 | `src/feature/anpr-monitoring/components/AnprBlockchainProofSection.jsx` | **Added** — lightweight detail UI |
| frontend-react-v1 | `src/feature/anpr-monitoring/components/AnprStatusChip.jsx` | **Extended** — blockchain status chip |
| frontend-react-v1 | `src/feature/anpr-monitoring/views/AnprEventDetail.jsx` | **Updated** — render proof section |
| frontend-react-v1 | `src/feature/anpr-monitoring/repositories/AnprMonitoringRepository.js` | **Updated** — normalize proof fields |
| frontend-react-v1 | `src/feature/anpr-monitoring/repositories/AnprMonitoringRepository.test.js` | **Extended** — proof normalization test |

## Backend integration details

### Event proof trigger

After `AnprEventController@store` persists the event and completes vehicle linking, `BlockchainAnprIntegrationService::anchorEventCreation()` runs when `BLOCKCHAIN_ENABLED=true`. It calls `BlockchainRecordService::createForEntity($event, 'entity_created')`, links `anpr_events.blockchain_record_id` when empty, and queues `AnchorBlockchainRecordJob`.

### Image/evidence proof trigger

After `AnprImageController@uploadForEvent` or `@store` persists the image row, `BlockchainAnprIntegrationService::anchorImageEvidence()` runs when enabled. Proof type is `evidence_file` with `entity_type = anpr_image`.

### Async behavior

Controllers return immediately after database persistence and proof row creation/queue dispatch. Ethereum RPC work runs only inside `AnchorBlockchainRecordJob`.

### Disabled blockchain behavior

When `BLOCKCHAIN_ENABLED=false`:

- ANPR event and image APIs behave as before.
- No automatic `blockchain_records` rows are created.
- No anchoring jobs are dispatched.
- No Ethereum RPC calls are made.

## Canonical payloads

### ANPR event payload (`entity_created`)

| Field | Source |
|-------|--------|
| `entity_type` | `anpr_event` |
| `entity_id` | Event UUID |
| `proof_type` | `entity_created` |
| `camera_id` | Event camera |
| `plate_number` | Normalized plate |
| `confidence` | 4-decimal string |
| `detection_time` | ISO-8601 UTC |
| `is_flagged`, `is_valid` | Booleans |

**Excluded:** `created_at`, `updated_at`, `vehicle_id`, `blockchain_record_id`, GPS coordinates.

### ANPR image/evidence payload (`evidence_file`)

| Field | Source |
|-------|--------|
| `entity_type` | `anpr_image` |
| `entity_id` | Image UUID |
| `proof_type` | `evidence_file` |
| `anpr_event_id` | Parent event |
| `image_type` | `full`, `plate`, or `annotated` |
| `file_path` | Safe relative path only (no `..`, no absolute paths) |
| `file_sha256` | Lowercase SHA-256 of resolved file when under allowed ANPR roots; otherwise `null` |
| `file_size`, `resolution` | Metadata |
| `evidence_hash_source` | `file` or `metadata` |

**Excluded:** volatile timestamps, absolute filesystem paths, raw image bytes.

## API/resource visibility

`GET /api/anpr-events/{id}` includes:

- `blockchain_proof` — safe summary for the event creation proof (`BlockchainProofSummaryResource`)
- `image_blockchain_proof_summary` — count, status list, confirmed count for loaded image proofs
- Per-image `blockchain_proof` when image proofs are attached on detail responses

**Not exposed:** private keys, raw canonical JSON, `record_hash` in summary resource, absolute local paths, RPC URLs.

## Frontend visibility

The ANPR event detail page (`AnprEventDetail`) renders `AnprBlockchainProofSection` when Laravel returns proof data:

- Event proof status chip, network/environment, shortened tx hash, confirmations, submitted/confirmed timestamps
- Image proof count and status summary

React uses Laravel API data only. No Web3, wallet, or direct RPC libraries were added.

## Testing results

| Command | Result |
|---------|--------|
| `php artisan test --filter=Blockchain` | **197 passed** |
| `php artisan test --filter=Anpr` | **79 passed** |
| `php artisan test` | **318 passed** |
| `npm run test` (frontend-react-v1) | **29 passed** |

Tests use `Bus::fake()` / `Http::fake()` so feature tests do not execute live queue workers or Ethereum RPC.

## Manual smoke-test steps

### Ganache (local)

1. Start Ganache and deploy `EvidenceStore` (`npm run deploy:ganache` in `blockchain-ethereum-v1`).
2. Set Laravel `.env`: `BLOCKCHAIN_ENABLED=true`, Ganache RPC/contract/wallet values.
3. Create an ANPR event via `POST /api/anpr-events`.
4. Confirm a `blockchain_records` row with `entity_type=anpr_event` and status progressing through queue/worker.
5. Upload evidence via `POST /api/anpr-events/{id}/images/upload`.
6. Confirm a separate `blockchain_records` row with `entity_type=anpr_image`, `proof_type=evidence_file`.
7. Open ANPR event detail in React and verify blockchain proof section.

### Sepolia (testnet)

Repeat steps 2–7 with `BLOCKCHAIN_NETWORK=sepolia`, valid Sepolia contract address, wallet, and funded private key per [`m9-sepolia-deployment.md`](m9-sepolia-deployment.md).

## Security and privacy rules

- On-chain data remains **hash-only** (`bytes32`); no plates, GPS, images, or raw JSON on-chain.
- File hashing uses only paths resolved under configured `ANPR_IMAGE_ROOTS`.
- Client-supplied `blockchain_record_id` is **prohibited** on ANPR create/update.
- Automatic proof failures are logged with sanitized messages; ANPR writes are not rolled back.
- API responses expose only safe blockchain status fields.

## Known limitations

- Re-uploading the same image type updates the file but reuses the existing proof row (idempotent by entity). Post-replacement verification may report **tampered** relative to the original anchored hash.
- Metadata-only image rows (unresolvable file path) anchor deterministic metadata proofs with `evidence_hash_source=metadata`.
- Full blockchain monitoring dashboard is not included (see M11).
- Event **updates** do not create new blockchain proofs in M10.

## Not delivered in M10

| Item | Target milestone |
|------|------------------|
| Dedicated blockchain monitoring dashboard route | M11 |
| React/Ethereum RPC or wallet integration | Out of scope |
| AI ANPR direct Ethereum calls | Out of scope |
| Solidity contract changes | Out of scope |
| Automatic proof on ANPR event update | Out of scope |

## Related documentation

- [`../blockchain-module.md`](../blockchain-module.md) — module roadmap
- [`m9-sepolia-deployment.md`](m9-sepolia-deployment.md) — Sepolia setup (prior milestone)
- [`m8-verification-system.md`](m8-verification-system.md) — verification service
- [`m5-blockchain-record-service-and-read-apis.md`](m5-blockchain-record-service-and-read-apis.md) — record service
- [`m4-deterministic-hashing-architecture.md`](m4-deterministic-hashing-architecture.md) — hashing rules
- `backend-laravel-v1/documentation.md` — Laravel API reference
- `frontend-react-v1/documentation.md` — React ANPR monitoring module
