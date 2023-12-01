import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";
import makeRpcRequest from "../../utils/makeRpcRequest";
import { FlipConfig } from "../../config/interfaces";

const metricNameValidatorOnline: string = "cf_validator_online";
const metricAuthorityOnline: Gauge = new promClient.Gauge({
  name: metricNameValidatorOnline,
  help: "Tracked validator is online",
  registers: [],
  labelNames: ["ss58Address", "alias"],
});
const metricNameValidatorAuthority: string = "cf_validator_authority";
const metricAuthority: Gauge = new promClient.Gauge({
  name: metricNameValidatorAuthority,
  help: "Tracked validator is authority",
  registers: [],
  labelNames: ["ss58Address", "alias"],
});
const metricNameValidatorBackup: string = "cf_validator_backup";
const metricBackup: Gauge = new promClient.Gauge({
  name: metricNameValidatorBackup,
  help: "Tracked validator is backup",
  registers: [],
  labelNames: ["ss58Address", "alias"],
});
const metricNameValidatorQualified: string = "cf_validator_qualified";
const metricQualified: Gauge = new promClient.Gauge({
  name: metricNameValidatorQualified,
  help: "Tracked validator is qualified",
  registers: [],
  labelNames: ["ss58Address", "alias"],
});
const metricNameValidatorBidding: string = "cf_validator_bidding";
const metricBidding: Gauge = new promClient.Gauge({
  name: metricNameValidatorBidding,
  help: "Tracked validator is bidding",
  registers: [],
  labelNames: ["ss58Address", "alias"],
});
const metricNameValidatorBalance: string = "cf_validator_balance";
const metricBalance: Gauge = new promClient.Gauge({
  name: metricNameValidatorBalance,
  help: "Validator balance amount (bidding amount)",
  registers: [],
  labelNames: ["ss58Address", "alias"],
});

export const gaugeValidatorStatus = async (context: Context): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  const config = context.config as FlipConfig;
  if (config.accounts.length === 0) {
    logger.debug("No validator accounts are tracked.");
    return;
  }

  logger.debug(
    `Scraping ${metricNameValidatorOnline}, ${metricNameValidatorAuthority}, ${metricNameValidatorBackup}, ${metricNameValidatorQualified}`
  );

  if (registry.getSingleMetric(metricNameValidatorOnline) === undefined)
    registry.registerMetric(metricAuthorityOnline);
  if (registry.getSingleMetric(metricNameValidatorAuthority) === undefined)
    registry.registerMetric(metricAuthority);
  if (registry.getSingleMetric(metricNameValidatorBackup) === undefined)
    registry.registerMetric(metricBackup);
  if (registry.getSingleMetric(metricNameValidatorQualified) === undefined)
    registry.registerMetric(metricQualified);
  if (registry.getSingleMetric(metricNameValidatorBidding) === undefined)
    registry.registerMetric(metricBidding);
  if (registry.getSingleMetric(metricNameValidatorBalance) === undefined)
    registry.registerMetric(metricBalance);

  metricFailure.labels({ metric: metricNameValidatorOnline }).set(0);
  metricFailure.labels({ metric: metricNameValidatorAuthority }).set(0);
  metricFailure.labels({ metric: metricNameValidatorBackup }).set(0);
  metricFailure.labels({ metric: metricNameValidatorQualified }).set(0);
  metricFailure.labels({ metric: metricNameValidatorBidding }).set(0);
  metricFailure.labels({ metric: metricNameValidatorBalance }).set(0);

  for (const { ss58Address, alias } of config.accounts) {
    try {
      const result = await makeRpcRequest(api, "account_info_v2", ss58Address);
      const {
        balance,
        is_current_authority,
        is_current_backup,
        is_online,
        is_bidding,
        is_qualified,
      } = result;
      metricAuthorityOnline
        .labels({ alias, ss58Address })
        .set(is_online ? 1 : 0);
      metricAuthority
        .labels({ alias, ss58Address })
        .set(is_current_authority ? 1 : 0);
      metricBackup
        .labels({ alias, ss58Address })
        .set(is_current_backup ? 1 : 0);
      metricQualified.labels({ alias, ss58Address }).set(is_qualified ? 1 : 0);
      metricBidding.labels({ alias, ss58Address }).set(is_bidding ? 1 : 0);

      const balanceValue: number = Number(Number(balance) / 10 ** 18);
      metricBalance
        .labels({ alias, ss58Address })
        .set(balanceValue || 0);
    } catch (e) {
      logger.error(e);
      metricFailure.labels({ metric: metricNameValidatorOnline }).set(1);
      metricFailure.labels({ metric: metricNameValidatorAuthority }).set(1);
      metricFailure.labels({ metric: metricNameValidatorBackup }).set(1);
      metricFailure.labels({ metric: metricNameValidatorQualified }).set(1);
      metricFailure.labels({ metric: metricNameValidatorBidding }).set(1);
      metricFailure.labels({ metric: metricNameValidatorBalance }).set(1);
    }
  }
};
