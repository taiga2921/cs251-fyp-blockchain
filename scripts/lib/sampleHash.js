const crypto = require("crypto");

/**
 * Deterministic harmless bytes32 hash for local verification scripts.
 * Uses SHA-256 over a fixed non-sensitive label (not real evidence).
 */
function sampleVerificationHash(label = "m1-verification-sample-v1") {
  const digest = crypto.createHash("sha256").update(label, "utf8").digest("hex");
  return `0x${digest}`;
}

module.exports = {
  sampleVerificationHash,
};
