import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

// Currently unused. Need to understand how to properly calculate the percentage.

const metricName: string = 'cf_block_weight';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Latest block weight.',
    registers: [],
});

export const gaugeBlockWeight = async (context: Context, data: ProtocolData): Promise<void> => {
    const { logger, apiLatest, registry, metricFailure } = context;
    const api = await apiLatest.at(data.blockHash);
    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    logger.debug(`Scraping ${metricName}`);

    try {
        const currentBlockWeight = (await api.query.system.blockWeight()).toJSON();
        const totalWeight: number =
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            currentBlockWeight.mandatory.refTime +
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            currentBlockWeight.normal.refTime +
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            currentBlockWeight.operational.refTime;
        metric.set(totalWeight);
        metricFailure.labels({ metric: metricName }).set(0);
    } catch (e) {
        metricFailure.labels({ metric: metricName }).set(1);
        logger.error(e);
    }
};
