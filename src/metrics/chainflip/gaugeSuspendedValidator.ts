import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricName: string = 'cf_suspended_validators';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The number of validators who have been suspended for a particular offence',
    labelNames: ['offence'],
    registers: [],
});

export const gaugeSuspendedValidator = async (
    context: Context,
    data: ProtocolData,
): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_suspended_validators')) {
        return;
    }
    const { logger, registry } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    const suspensionList: any = data.data.suspended_validators;
    suspensionList.forEach(([offence, count]: [any, any]) => {
        metric.labels(offence).set(count);
    });
};
