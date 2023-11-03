import { Context } from "../lib/interfaces";
import promClient from "prom-client";
import { releaseCount } from "../metrics/github";
import axios from "axios";

const metricFailureName: string = "metric_scrape_failure";
const metricFailure: promClient.Gauge = new promClient.Gauge({
  name: metricFailureName,
  help: "Metric is failing to report",
  labelNames: ["metric", "repo"],
  registers: [],
});

export default async (context: Context): Promise<void> => {
  const { logger } = context;
  logger.info("Starting Github listeners");
  startWatcher(context);
};

async function startWatcher(context: Context) {
  const { logger, registry } = context;

  if (registry.getSingleMetric(metricFailureName) === undefined)
    registry.registerMetric(metricFailure);

  const axiosInstance = axios.create()
  context = { ...context, metricFailure, axiosInstance };

  try{
    await releaseCount(context);

    setInterval(async () => {
      await releaseCount(context);
    }, 3600e3); // once every hour
  }catch(err) {
    logger.error(err)
    setTimeout(() => {
      startWatcher(context);
    }, 3600e3) // if there is an error try to spin up again after 1h
  }
}
