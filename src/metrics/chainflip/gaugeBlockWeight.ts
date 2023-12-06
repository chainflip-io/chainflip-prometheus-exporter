import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

// Currently unused. Need to understand how to properly calculate the percentage.

const metricName: string = 'cf_block_weight';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Latest block weight.',
    registers: [],
});

export const gaugeBlockWeight = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metricFailure.labels({ metric: metricName }).set(0);

    logger.debug(`Scraping ${metricName}`);

    try {
        const systemBlockWeights = await api.consts.system.blockWeights;
        logger.debug(systemBlockWeights.toJSON());

        const currentBlockWeight = await api.query.system.blockWeight();
        logger.debug(currentBlockWeight.toJSON());
    } catch (e) {
        logger.error(e);
    }
};
