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
let loggerCopy: Logger;
let mainRegistry: promClient.Registry;
let wsProvider: ethers.providers.WebSocketProvider;
let mainContext: Context;
export default async function startEthereumService(context: Context) {
  const { logger, registry } = context;
  logger.info("Starting Ethereum listeners");
  loggerCopy = logger;
  mainRegistry = registry;
  mainContext = context;
  await startWatcher(mainContext);
}

process.on("uncaughtException", async err => {
  loggerCopy.error(`Error opening ETH ws connection: ${err}`);
  loggerCopy.info(`retrying in 15s`);
  setTimeout(() => {
    startWatcher(mainContext); // Retry after a delay
  }, 15000); // 15s
  metric.set(1);
});

async function startWatcher(context: Context) {
  const { logger, env } = context;
  context = {...context, metricFailure}
  const config = context.config as EthConfig;
  try {

    if (mainRegistry.getSingleMetric(metricName) === undefined)
      mainRegistry.registerMetric(metric);
    if (mainRegistry.getSingleMetric(metricFailureName) === undefined)
      mainRegistry.registerMetric(metricFailure);

    wsProvider = new ethers.providers.WebSocketProvider(env.ETH_WS_ENDPOINT);
    await wsProvider.ready;
    metric.set(0);

    wsProvider._websocket.on("close", async (err: any, origin: any) => {
      logger.error(`ETH ws connection closed ${err} ${origin}`);
      logger.info(`retrying in 5s`)
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

    context.provider = new ethers.providers.JsonRpcProvider(env.ETH_HTTP_ENDPOINT);

    wsProvider.on("block", async (blockNumber: number) => {
      await gaugeEthBalance(context);
      await gaugeTokenBalance({ ...context, contract: flipContract }, "FLIP");
      await gaugeTokenBalance({ ...context, contract: usdcContract }, "USDC");
      await gaugeBlockHeight({ ...context, blockNumber });
      await gaugeBlockTime({ ...context, blockNumber });
      // await gaugeReorgSize({...context, blockNumber}); //TODO fix metric
    });

    flipContract.deployed().then(() => logger.info("Flip contract added"));
    flipContract.on("*", async (event: any) => {
      if (event?.event !== undefined) {
        await countContractEvents({
          ...context,
          contractAlias: "flip",
          event: event.event,
        });
      }
    });

    stateChainGatewayContract
      .deployed()
      .then(() => logger.info("Stake manager contract added"));
    stateChainGatewayContract.on("*", async (event: any) => {
      if (event?.event !== undefined) {
        await countContractEvents({
          ...context,
          contractAlias: "state-chain-gateway",
          event: event.event,
        });
      }
    });

    keyManagerContract
      .deployed()
      .then(() => logger.info("Key Manager contract added"));
    keyManagerContract.on("*", async (event: any) => {
      if (event?.event !== undefined) {
        await countContractEvents({
          ...context,
          contractAlias: "key-manager",
          event: event.event,
        });
      }
    });

    vaultContract.deployed().then(() => logger.info("Vault contract added"));
    vaultContract.on("*", async (event: any) => {
      if (event?.event !== undefined) {
        await countContractEvents({
          ...context,
          contractAlias: "vault",
          event: event.event,
        });
      }
    });
  } catch (e) {
    logger.error(`catch: ${e}`);
    await wsProvider.destroy();
  }
}