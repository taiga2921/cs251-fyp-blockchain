const fs = require("fs");
const path = require("path");

async function main() {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "EvidenceStore.sol",
    "EvidenceStore.json"
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Compiled artifact not found at ${artifactPath}. Run "npm run compile" first.`
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abiExportPath = path.join(__dirname, "..", "deployments", "ganache", "EvidenceStore.abi.json");
  fs.mkdirSync(path.dirname(abiExportPath), { recursive: true });
  fs.writeFileSync(abiExportPath, `${JSON.stringify(artifact.abi, null, 2)}\n`);

  const deploymentPath = path.join(__dirname, "..", "deployments", "ganache", "EvidenceStore.json");
  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    deployment.abi = artifact.abi;
    fs.writeFileSync(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);
    console.log(`Updated ABI in ${deploymentPath}`);
  }

  console.log(`Exported ABI to ${abiExportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
