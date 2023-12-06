import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { FlipConfig } from '../../config/interfaces';
import makeRpcRequest from '../../utils/makeRpcRequest';

const metricName: string = 'cf_min_active_bid';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'the lowest winning bid',
    registers: [],
});

export const gaugeMinActiveBid = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metricFailure.labels({ metric: metricName }).set(0);

    try {
        const result = await makeRpcRequest(api, 'auction_state');
        const { min_active_bid } = result;

        const MAB: number = Number(Number(min_active_bid) / 10 ** 18);

        metric.set(MAB);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
