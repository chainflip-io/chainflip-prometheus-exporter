import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";
import makeRpcRequest from "../../utils/makeRpcRequest"

const metricName: string = "cf_authorities";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "The number of validator in the active set",
  registers: [],
});

const metricNameOnline: string = "cf_authorities_online";
const metricOnline: Gauge = new promClient.Gauge({
  name: metricNameOnline,
  help: "The number of validator in the active set who are online",
  registers: [],
});

export const gaugeAuthorities = async (context: Context): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  if (registry.getSingleMetric(metricNameOnline) === undefined)
    registry.registerMetric(metricOnline);


  metricFailure.labels({ metric: metricName }).set(0);

  let currentAuthorities: any;
  try {
    let onlineCounter = 0

    currentAuthorities = await api.query.validator.currentAuthorities();
    metric.set(currentAuthorities.toJSON().length);

    for(const idSs58 of currentAuthorities.toJSON()) {
      const result = await makeRpcRequest(api,'account_info_v2', idSs58)
      if(result.is_online) {
        onlineCounter++
      }
    };
    metricOnline.set(onlineCounter)
  } catch (e) {
    logger.error(e);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
