require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
const { buildSepoliaNetworkConfig, isSepoliaNetworkTask } = require("./scripts/lib/sepoliaConfig");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: false,
      },
    },
  },
  networks: {
    hardhat: {},
    ganache: {
      url: process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545",
      ...(deployerPrivateKey ? { accounts: [deployerPrivateKey] } : {}),
    },
    sepolia: isSepoliaNetworkTask()
      ? buildSepoliaNetworkConfig()
      : {
          url: process.env.SEPOLIA_RPC_URL?.trim() || "http://localhost:0",
          accounts: [],
          chainId: 11155111,
        },
  },
};
