import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'cf_suspended_validators';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The number of validators who have been suspended for a particular offence',
    labelNames: ['offence'],
    registers: [],
});

export const gaugeSuspendedValidator = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    metricFailure.labels({ metric: metricName }).set(0);

    try {
        const suspensionList: any = await api.query.reputation.suspensions.entries();
        suspensionList.forEach(([key, element]: [any, any]) => {
            metric.labels({ offence: key.toHuman() }).set(element.length);
        });
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
