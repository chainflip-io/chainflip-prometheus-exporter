import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'sol_block_height';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Solana block height',
    registers: [],
});
export const gaugeSolBlockHeight = async (context: Context) => {
    if (context.config.skipMetrics.includes('sol_balance')) {
        return;
    }
    const { logger, registry, connection, metricFailure } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    try {
        const latestBlock = await connection.getSlot({ commitment: `finalized` });
        metric.set(latestBlock);
        metricFailure.labels({ metric: metricName }).set(0);
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
