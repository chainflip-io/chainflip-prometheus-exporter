import { ethers } from "ethers";
import FlipABI from "../abi/FLIP.json";
import StateChainGatewayABI from "../abi/StateChainGateway.json";
import VaultABI from "../abi/Vault.json";
import KeyManagerABI from "../abi/KeyManager.json";
import USDCABI from "../abi/MockUSDC.json";
import { Logger } from "winston";
import { EthConfig } from "../config/interfaces";
import { Context } from "../lib/interfaces";
import promClient from "prom-client";
import {
  countContractEvents,
  gaugeBlockHeight,
  gaugeEthBalance,
  gaugeTokenBalance,
  gaugeBlockTime,
  gaugeReorgSize,
} from "../metrics/eth";

const metricName: string = "eth_watcher_failure";
const metric: promClient.Gauge = new promClient.Gauge({
  name: metricName,
  help: "Ethereum watcher failing",
  registers: [],
});
const metricFailureName: string = "metric_scrape_failure";
const metricFailure: promClient.Gauge = new promClient.Gauge({
  name: metricFailureName,
  help: "Metric is failing to report",
  labelNames: ["metric"],
  registers: [],
});

// needed to be able to use logger and config in case of uncaughtException
let logger1: Logger;
let config1: EthConfig;
let registry1: promClient.Registry;
let wsProvider: ethers.providers.WebSocketProvider;
export default async function startEthereumService(context: Context) {
  const { logger, config, registry } = context;
  logger.info("Starting Ethereum listeners");
  logger1 = logger;
  config1 = config as EthConfig;
  registry1 = registry;
  await startWatcher(context);
}

process.on("uncaughtException", async err => {
  logger1.error(err);
  // TODO: handle metric for failure, increment it
  metric.set(1);
});

async function startWatcher(context: Context) {
  const { logger, env } = context;
  context = {...context, metricFailure}
  const config = context.config as EthConfig;
  if (registry1.getSingleMetric(metricName) === undefined)
    registry1.registerMetric(metric);
  if (registry1.getSingleMetric(metricFailureName) === undefined)
    registry1.registerMetric(metricFailure);

  metric.set(0);

  try {
    wsProvider = new ethers.providers.WebSocketProvider(env.ETH_WS_ENDPOINT);
    wsProvider._websocket.on("close", async (err: any, origin: any) => {
      logger.error(`ws connection closed ${err} ${origin}`);
      await wsProvider.destroy();
      setTimeout(() => {
        startWatcher(context); // Retry after a delay
      }, 5000); // 5s
    });

    const flipContract: ethers.Contract = new ethers.Contract(
      config.contracts.find((c: any) => c.alias === "flip")!.address,
      FlipABI,
      wsProvider
    );
    const stateChainGatewayContract: ethers.Contract = new ethers.Contract(
      config.contracts.find(
        (c: any) => c.alias === "state-chain-gateway"
      )!.address,
      StateChainGatewayABI,
      wsProvider
    );
    const keyManagerContract: ethers.Contract = new ethers.Contract(
      config.contracts.find((c: any) => c.alias === "key-manager")!.address,
      KeyManagerABI,
      wsProvider
    );
    const vaultContract: ethers.Contract = new ethers.Contract(
      config.contracts.find((c: any) => c.alias === "vault")!.address,
      VaultABI,
      wsProvider
    );
    const usdcContract: ethers.Contract = new ethers.Contract(
      config.contracts.find((c: any) => c.alias === "usdc")!.address,
      USDCABI,
      wsProvider
    );

    context.provider = wsProvider;

    wsProvider.on("block", async (blockNumber: number) => {
      await gaugeEthBalance(context);
      await gaugeTokenBalance({ ...context, contract: flipContract }, "FLIP");
      await gaugeTokenBalance({ ...context, contract: usdcContract }, "USDC");
      await gaugeBlockHeight({ ...context, blockNumber });
      await gaugeBlockTime({ ...context, blockNumber });
      await gaugeReorgSize({...context, blockNumber});
    });

    flipContract.deployed().then(() => logger.info("Flip contract added"));
    flipContract.on("*", async (event: any) => {
      if (event.fragment?.name !== undefined) {
        await countContractEvents({
          ...context,
          contractAlias: "flip",
          event: event.fragment.name,
        });
      }
    });

    stateChainGatewayContract
      .deployed()
      .then(() => logger.info("Stake manager contract added"));
    stateChainGatewayContract.on("*", async (event: any) => {
      if (event.fragment?.name !== undefined) {
        await countContractEvents({
          ...context,
          contractAlias: "state-chain-gateway",
          event: event.fragment.name,
        });
      }
    });

    keyManagerContract
      .deployed()
      .then(() => logger.info("Key Manager contract added"));
    keyManagerContract.on("*", async (event: any) => {
      if (event.fragment?.name !== undefined) {
        await countContractEvents({
          ...context,
          contractAlias: "key-manager",
          event: event.fragment.name,
        });
      }
    });

    vaultContract.deployed().then(() => logger.info("Vault contract added"));
    vaultContract.on("*", async (event: any) => {
      if (event.fragment?.name !== undefined) {
        await countContractEvents({
          ...context,
          contractAlias: "vault",
          event: event.fragment.name,
        });
      }
    });
  } catch (e) {
    logger.error(`catch: ${e}`);
    setTimeout(() => {
      logger.debug("retrying...");
      startWatcher(context); // Retry after a delay
    }, 5000); // 5s
  }
}