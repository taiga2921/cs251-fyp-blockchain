const fs = require("fs");
const path = require("path");
const { getOwnerSigner } = require("./lib/signer");
const { sampleVerificationHash } = require("./lib/sampleHash");

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", "ganache", "EvidenceStore.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `Deployment file not found at ${deploymentPath}. Run "npm run deploy:ganache" first.`
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contract = await ethers.getContractAt("EvidenceStore", deployment.address);

  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
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
  console.log(`  Chain ID:           ${chainId}`);
  console.log(`  Sample hash:        ${sampleHash}`);
  console.log(`  Store tx hash:      ${storeTxHash ?? "(already stored — no new transaction)"}`);
  console.log(`  verifyHash result:  ${verified}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
