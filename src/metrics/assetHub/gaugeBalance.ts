import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { HubConfig } from '../../config/interfaces';

const metricNameAggKeyBalance: string = 'hub_agg_key_balance';
const metricAggKeyBalance: Gauge = new promClient.Gauge({
    name: metricNameAggKeyBalance,
    help: 'aggKey balance in DOT',
    registers: [],
    labelNames: ['aggKey'],
});

let lastAggKey: string;

export const gaugeBalance = async (context: Context) => {
    if (context.config.skipMetrics.includes('hub_balance')) {
        return;
    }
    const { logger, registry, api, metricFailure, config } = context;

    const { accounts } = config as HubConfig;

    logger.debug(`Scraping ${metricNameAggKeyBalance}`);

    if (registry.getSingleMetric(metricNameAggKeyBalance) === undefined)
        registry.registerMetric(metricAggKeyBalance);

    metricFailure.labels({ metric: metricNameAggKeyBalance }).set(0);

    try {
        for (const { alias, publicKey } of accounts) {
            const hubAccount: any = await api.query.system.account(publicKey);
            const metricValue = Number(hubAccount.data.free) / 10000000000;
            metricAggKeyBalance.set(metricValue);
        }
        if (global.dotAggKeyAddress) {
            if (!lastAggKey) {
                lastAggKey = global.dotAggKeyAddress;
            } else if (lastAggKey !== global.dotAggKeyAddress) {
                metricAggKeyBalance.remove(lastAggKey);
                lastAggKey = global.dotAggKeyAddress;
            }

            const hubAccount: any = await api.query.system.account(global.dotAggKeyAddress);
            const metricValue = Number(hubAccount.data.free) / 10000000000;
            metricAggKeyBalance.labels(global.dotAggKeyAddress).set(metricValue);
        }
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricNameAggKeyBalance }).set(1);
    }
};
