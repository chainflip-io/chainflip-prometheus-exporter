import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'cf_btc_utxos';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The total number of btc utxos we currently have',
    registers: [],
});

export const gaugeBtcUtxos = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_btc_utxos')) {
        return;
    }
    const { logger, api, registry, metricFailure } = context;

    logger.debug(`Scraping ${metricName}`);
    metricFailure.labels({ metric: metricName }).set(0);
    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    try {
        const utxos: any = context.data.btc_utxos.count;
        metric.set(utxos);
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
