import { Context } from "../lib/interfaces";
import Client from "bitcoin-core";
import { gaugeBlockHeight, gaugeBlockTime } from "../metrics/btc";
import promClient from "prom-client";
import { BtcConfig } from "../config/interfaces";

const metricFailureName: string = "metric_scrape_failure";
const metricFailure: promClient.Gauge = new promClient.Gauge({
  name: metricFailureName,
  help: "Metric is failing to report",
  labelNames: ["metric"],
  registers: [],
});

async function pollEndpoint(
  func: any,
  context: Context,
  intervalSeconds: number
): Promise<void> {
  const { logger } = context;
  func(context);

  setInterval(() => func(context), intervalSeconds * 1000);
}

const startBitcoinService = async (context: Context) => {
  const { logger } = context;
  logger.debug("Starting Bitcoin listeners");
  await startWatcher(context);
};

async function startWatcher(context: Context) {
  const { env, registry } = context;
  context = { ...context, metricFailure };
  const config = context.config as BtcConfig;

  if (registry.getSingleMetric(metricFailureName) === undefined)
    registry.registerMetric(metricFailure);
  const bitcoinHostParts = new URL(env.BTC_HTTP_ENDPOINT);
  const { hostname, port, username, password, protocol } = bitcoinHostParts;
  const bitcoinClient = new Client({
    username,
    password,
    host: hostname,
    port: protocol === "https:" ? 443 : Number(port),
    ssl: { enabled: protocol === "https:" },
    network: config.network,
  });

  pollEndpoint(gaugeBlockHeight, { ...context, bitcoinClient }, 5);
  pollEndpoint(gaugeBlockTime, { ...context, bitcoinClient }, 5);
}

export default startBitcoinService;
