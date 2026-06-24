const fs = require("fs");
const path = require("path");
const { getOwnerSigner } = require("./lib/signer");
const { sampleVerificationHash } = require("./lib/sampleHash");

const RERUN_DEPLOY_HINT =
  'Rerun "npm run deploy:ganache" to regenerate deployments/ganache/EvidenceStore.json.';

function assertDeploymentFields(deployment) {
  const missing = [];

  if (deployment.address === undefined || deployment.address === null || deployment.address === "") {
    missing.push("address");
  }
  if (deployment.chainId === undefined || deployment.chainId === null || deployment.chainId === "") {
    missing.push("chainId");
  }
  if (deployment.abi === undefined || deployment.abi === null) {
    missing.push("abi");
  }

  if (missing.length > 0) {
    throw new Error(
      `Deployment JSON is missing required field(s): ${missing.join(", ")}. ${RERUN_DEPLOY_HINT}`
    );
  }

  if (!ethers.isAddress(deployment.address)) {
    throw new Error(
      `Deployment JSON has an invalid address: ${JSON.stringify(deployment.address)}. ${RERUN_DEPLOY_HINT}`
    );
  }

  const chainId = Number(deployment.chainId);
  if (!Number.isFinite(chainId) || !Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(
      `Deployment JSON has an invalid chainId: ${JSON.stringify(deployment.chainId)}. ` +
        `Expected a positive integer. ${RERUN_DEPLOY_HINT}`
    );
  }

  if (!Array.isArray(deployment.abi) || deployment.abi.length === 0) {
    throw new Error(
      `Deployment JSON has an invalid abi: expected a non-empty array. ${RERUN_DEPLOY_HINT}`
    );
  }
}

function assertChainIdMatches(deployment, liveChainId) {
  const expectedChainId = Number(deployment.chainId);

  if (expectedChainId !== liveChainId) {
    throw new Error(
      `Chain ID mismatch: deployment JSON expects chain ID ${expectedChainId}, ` +
        `but the connected RPC network reports chain ID ${liveChainId}. ` +
        `Likely cause: wrong RPC URL, wrong network, or Ganache reset/reconfigured. ` +
        `Check GANACHE_RPC_URL and rerun "npm run deploy:ganache" if Ganache was restarted.`
    );
  }
}

async function assertBytecodeExists(address) {
  const bytecode = await ethers.provider.getCode(address);

  if (bytecode === "0x" || bytecode === "0x0") {
    throw new Error(
      `No contract bytecode exists at deployment address ${address}. ` +
        `Likely cause: Ganache was reset or deployments/ganache/EvidenceStore.json is stale. ` +
        `Rerun "npm run deploy:ganache" against the current Ganache workspace.`
    );
  }
}

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", "ganache", "EvidenceStore.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `Deployment file not found at ${deploymentPath}. Run "npm run deploy:ganache" first.`
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  assertDeploymentFields(deployment);

  const network = await ethers.provider.getNetwork();
  const liveChainId = Number(network.chainId);
  assertChainIdMatches(deployment, liveChainId);
  await assertBytecodeExists(deployment.address);

  const contract = await ethers.getContractAt("EvidenceStore", deployment.address);
  const sampleHash = sampleVerificationHash();

  let storeTxHash = null;
  const alreadyStored = await contract.verifyHash(sampleHash);

  if (!alreadyStored) {
    const ownerAddress = await contract.owner();
    const ownerSigner = await getOwnerSigner(ethers, ownerAddress);
    const connected = contract.connect(ownerSigner);
    const tx = await connected.storeHash(sampleHash);
    const receipt = await tx.wait();
    storeTxHash = receipt.hash;
  }

  const verified = await contract.verifyHash(sampleHash);
  if (!verified) {
    throw new Error("Verification failed: sample hash is not stored on-chain.");
  }

  console.log("Ganache deployment verification succeeded");
  console.log(`  Contract address:   ${deployment.address}`);
  console.log(`  Chain ID:           ${liveChainId}`);
  console.log(`  Sample hash:        ${sampleHash}`);
  console.log(`  Store tx hash:      ${storeTxHash ?? "(already stored — no new transaction)"}`);
  console.log(`  verifyHash result:  ${verified}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
