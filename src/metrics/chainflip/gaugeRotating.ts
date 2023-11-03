import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName: string = "cf_rotating";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "Is the Network in a rotation",
  registers: [],
});

export const gaugeRotating = async (context: Context): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  metricFailure.labels({ metric: metricName }).set(0);

  try {
    const rotationPhase: any = await api.query.validator.currentRotationPhase();
    const keys: any = Object.keys(rotationPhase.toJSON());
    let metricValue: number;
    keys.includes("idle") ? (metricValue = 0) : (metricValue = 1);
    metric.set(metricValue);
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
