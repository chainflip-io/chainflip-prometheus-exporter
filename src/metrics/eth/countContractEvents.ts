import promClient from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName = "eth_contract_events_count";
const metric = new promClient.Counter({
  name: metricName,
  help: "Total of contract events",
  labelNames: ["event", "alias"],
  registers: [],
});

export const countContractEvents = async (context: Context) => {
  const { logger, registry, event, contractAlias } = context;

  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);

  metric.labels("ethereum", event, contractAlias).inc(1);
};
