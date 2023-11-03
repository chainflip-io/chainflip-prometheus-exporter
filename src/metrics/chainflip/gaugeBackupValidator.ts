import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";
import makeRpcRequest from "../../utils/makeRpcRequest";

const metricName: string = "cf_backup_validator";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "The number of validator in the backup set",
  registers: [],
});

const metricNameOnline: string = "cf_backup_validator_online";
const metricOnline: Gauge = new promClient.Gauge({
  name: metricNameOnline,
  help: "The number of validator in the backup set who are online",
  registers: [],
});

export const gaugeBackupValidator = async (context: Context): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  if (registry.getSingleMetric(metricNameOnline) === undefined)
    registry.registerMetric(metricOnline);

  metricFailure.labels({ metric: metricName }).set(0);

  let currentBackups: any;
  try {
    let onlineCounter = 0;
    let backupSetSize = 0;

    currentBackups = await api.query.validator.backups();
    const accountInfo: any[] = [];

    for (const idSs58 of currentBackups.keys()) {
      const result = await makeRpcRequest(api, "account_info_v2", idSs58);
      if (result.is_current_backup) {
        accountInfo.push(result);
      }
    }

    accountInfo.sort((a: any, b: any) => {
      return Number(BigInt(b.balance) - BigInt(a.balance));
    });
    const accounts = accountInfo.slice(0, 50);

    for (const account of accounts) {
      backupSetSize++;
      if (account.is_online) {
        onlineCounter++;
      }
    }

    metric.set(backupSetSize);
    metricOnline.set(onlineCounter);
  } catch (e) {
    logger.error(e);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
