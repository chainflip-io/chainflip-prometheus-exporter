import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import makeRpcRequest from '../../utils/makeRpcRequest';
import { FlipConfig } from '../../config/interfaces';
import { chunk } from '../../utils/utils';

const metricNameValidatorOnline: string = 'cf_validator_online';
const metricAuthorityOnline: Gauge = new promClient.Gauge({
    name: metricNameValidatorOnline,
    help: 'Tracked validator is online',
    registers: [],
    labelNames: ['ss58Address', 'alias'],
});
const metricNameValidatorAuthority: string = 'cf_validator_authority';
const metricAuthority: Gauge = new promClient.Gauge({
    name: metricNameValidatorAuthority,
    help: 'Tracked validator is authority',
    registers: [],
    labelNames: ['ss58Address', 'alias'],
});
const metricNameValidatorBackup: string = 'cf_validator_backup';
const metricBackup: Gauge = new promClient.Gauge({
    name: metricNameValidatorBackup,
    help: 'Tracked validator is backup',
    registers: [],
    labelNames: ['ss58Address', 'alias'],
});
const metricNameValidatorQualified: string = 'cf_validator_qualified';
const metricQualified: Gauge = new promClient.Gauge({
    name: metricNameValidatorQualified,
    help: 'Tracked validator is qualified',
    registers: [],
    labelNames: ['ss58Address', 'alias'],
});
const metricNameValidatorBidding: string = 'cf_validator_bidding';
const metricBidding: Gauge = new promClient.Gauge({
    name: metricNameValidatorBidding,
    help: 'Tracked validator is bidding',
    registers: [],
    labelNames: ['ss58Address', 'alias'],
});
const metricNameValidatorBalance: string = 'cf_validator_balance';
const metricBalance: Gauge = new promClient.Gauge({
    name: metricNameValidatorBalance,
    help: 'Validator balance amount (bidding amount)',
    registers: [],
    labelNames: ['ss58Address', 'alias'],
});
const metricNameReputation: string = 'cf_reputation';
const metricReputation: Gauge = new promClient.Gauge({
    name: metricNameReputation,
    help: 'The reputation of a validator',
    labelNames: ['ss58', 'alias'],
    registers: [],
});
export const gaugeValidatorStatus = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_validator')) {
        return;
    }
    const { logger, api, registry, metricFailure } = context;
    const config = context.config as FlipConfig;
    if (config.accounts.length === 0) {
        logger.debug('No validator accounts are tracked.');
        return;
    }

    logger.debug(
        `Scraping ${metricNameValidatorOnline}, ${metricNameValidatorAuthority}, ${metricNameValidatorBackup}, ${metricNameValidatorQualified}, ${metricNameReputation}`,
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
    if (registry.getSingleMetric(metricNameReputation) === undefined)
        registry.registerMetric(metricReputation);

    metricFailure.labels({ metric: metricNameValidatorOnline }).set(0);
    metricFailure.labels({ metric: metricNameValidatorAuthority }).set(0);
    metricFailure.labels({ metric: metricNameValidatorBackup }).set(0);
    metricFailure.labels({ metric: metricNameValidatorQualified }).set(0);
    metricFailure.labels({ metric: metricNameValidatorBidding }).set(0);
    metricFailure.labels({ metric: metricNameValidatorBalance }).set(0);
    metricFailure.labels({ metric: metricNameReputation }).set(0);

    const accounts = [];
    const vanityNames = [];
    for (const { ss58Address, alias } of config.accounts) {
        accounts.push(ss58Address);
        vanityNames.push(alias);
    }
    // monitoring_accounts_info support up to 10 accounts
    const accountsChunked = chunk(accounts, 10);
    const vanityNamesChunked = chunk(vanityNames, 10);
    try {
        let j = 0;
        for (const chunk of accountsChunked) {
            const result = await makeRpcRequest(
                api,
                'monitoring_accounts_info',
                chunk,
                context.blockHash,
            );
            for (const [i, validatorInfo] of result.entries()) {
                const {
                    balance,
                    is_current_authority,
                    is_current_backup,
                    is_online,
                    is_bidding,
                    is_qualified,
                    reputation_points,
                } = validatorInfo;

                metricAuthorityOnline
                    .labels(chunk[i], vanityNamesChunked[j][i])
                    .set(is_online ? 1 : 0);
                metricAuthority
                    .labels(chunk[i], vanityNamesChunked[j][i])
                    .set(is_current_authority ? 1 : 0);
                metricBackup
                    .labels(chunk[i], vanityNamesChunked[j][i])
                    .set(is_current_backup ? 1 : 0);
                metricQualified
                    .labels(chunk[i], vanityNamesChunked[j][i])
                    .set(is_qualified ? 1 : 0);
                metricBidding.labels(chunk[i], vanityNamesChunked[j][i]).set(is_bidding ? 1 : 0);
                metricReputation.labels(chunk[i], vanityNamesChunked[j][i]).set(reputation_points);
                const balanceValue: number = Number(Number(balance) / 10 ** 18);
                metricBalance.labels(chunk[i], vanityNamesChunked[j][i]).set(balanceValue || 0);
            }
            j++;
        }
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricNameValidatorOnline }).set(1);
        metricFailure.labels({ metric: metricNameValidatorAuthority }).set(1);
        metricFailure.labels({ metric: metricNameValidatorBackup }).set(1);
        metricFailure.labels({ metric: metricNameValidatorQualified }).set(1);
        metricFailure.labels({ metric: metricNameValidatorBidding }).set(1);
        metricFailure.labels({ metric: metricNameValidatorBalance }).set(1);
        metricFailure.labels({ metric: metricNameReputation }).set(1);
    }
};
