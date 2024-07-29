import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { DotConfig } from '../../config/interfaces';

const metricName: string = 'dot_balance';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Polkadot balance in DOT',
    registers: [],
});

const metricNameAggKeyBalance: string = 'dot_agg_key_balance';
const metricAggKeyBalance: Gauge = new promClient.Gauge({
    name: metricNameAggKeyBalance,
    help: 'aggKey balance in DOT',
    registers: [],
    labelNames: ['aggKey'],
});

let lastAggKey: string;

export const gaugeDotBalance = async (context: Context) => {
    if (context.config.skipMetrics.includes('dot_balance')) {
        return;
    }
    const { logger, registry, api, metricFailure, config } = context;

    const { accounts } = config as DotConfig;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricNameAggKeyBalance) === undefined)
        registry.registerMetric(metricAggKeyBalance);

    metricFailure.labels({ metric: metricName }).set(0);

    try {
        for (const { alias, publicKey } of accounts) {
            const dotAccount: any = await api.query.system.account(publicKey);
            const metricValue = Number(dotAccount.data.free) / 10000000000;
            metric.set(metricValue);
        }
        if (global.dotAggKeyAddress) {
            if (!lastAggKey) {
                lastAggKey = global.dotAggKeyAddress;
            } else if (lastAggKey !== global.dotAggKeyAddress) {
                metricAggKeyBalance.remove(lastAggKey);
                lastAggKey = global.dotAggKeyAddress;
            }

            const dotAccount: any = await api.query.system.account(global.dotAggKeyAddress);
            const metricValue = Number(dotAccount.data.free) / 10000000000;
            metricAggKeyBalance.labels(global.dotAggKeyAddress).set(metricValue);
        }
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
