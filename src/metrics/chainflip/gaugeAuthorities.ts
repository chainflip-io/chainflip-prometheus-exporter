import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import makeRpcRequest from '../../utils/makeRpcRequest';

const metricName: string = 'cf_authorities';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The number of validator in the active set',
    registers: [],
});

const metricNameOnline: string = 'cf_authorities_online';
const metricOnline: Gauge = new promClient.Gauge({
    name: metricNameOnline,
    help: 'The number of validator in the active set who are online',
    registers: [],
});

export const gaugeAuthorities = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_authorities')) {
        return;
    }
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricNameOnline) === undefined)
        registry.registerMetric(metricOnline);

    metricFailure.labels({ metric: metricName }).set(0);

    try {
        metric.set(context.data.authorities.authorities);
        global.currentAuthorities = context.data.authorities.authorities;
        metricOnline.set(context.data.authorities.online_authorities);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
