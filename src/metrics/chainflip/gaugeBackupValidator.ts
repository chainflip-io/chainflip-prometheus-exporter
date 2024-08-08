import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import makeRpcRequest from '../../utils/makeRpcRequest';

const metricName: string = 'cf_backup_validator';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The number of validator in the backup set',
    registers: [],
});

const metricNameOnline: string = 'cf_backup_validator_online';
const metricOnline: Gauge = new promClient.Gauge({
    name: metricNameOnline,
    help: 'The number of validator in the backup set who are online',
    registers: [],
});

export const gaugeBackupValidator = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_backup_validator')) {
        return;
    }
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricNameOnline) === undefined)
        registry.registerMetric(metricOnline);

    metricFailure.labels({ metric: metricName }).set(0);

    let currentBackups: any;
    try {
        metric.set(context.data.authorities.backups);
        metricOnline.set(context.data.authorities.online_backups);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
