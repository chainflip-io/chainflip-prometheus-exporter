import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricNameAuthorities: string = 'cf_authorities';
const metricAuthorities: Gauge = new promClient.Gauge({
    name: metricNameAuthorities,
    help: 'The number of validator in the active set',
    registers: [],
});

const metricNameOnlineAuthorities: string = 'cf_authorities_online';
const metricOnlineAuthorities: Gauge = new promClient.Gauge({
    name: metricNameOnlineAuthorities,
    help: 'The number of validator in the active set who are online',
    registers: [],
});

const metricNameBackups: string = 'cf_backup_validator';
const metricBackups: Gauge = new promClient.Gauge({
    name: metricNameBackups,
    help: 'The number of validator in the backup set',
    registers: [],
});

const metricNameOnlineBackups: string = 'cf_backup_validator_online';
const metricOnlineBackups: Gauge = new promClient.Gauge({
    name: metricNameOnlineBackups,
    help: 'The number of validator in the backup set who are online',
    registers: [],
});

export const gaugeAuthorities = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_authorities')) {
        return;
    }
    const { logger, registry } = context;
    logger.debug(
        `Scraping ${metricNameAuthorities}, ${metricNameOnlineAuthorities}, ${metricNameBackups}, ${metricNameOnlineBackups}`,
    );

    if (registry.getSingleMetric(metricNameAuthorities) === undefined)
        registry.registerMetric(metricAuthorities);
    if (registry.getSingleMetric(metricNameOnlineAuthorities) === undefined)
        registry.registerMetric(metricOnlineAuthorities);
    if (registry.getSingleMetric(metricNameBackups) === undefined)
        registry.registerMetric(metricBackups);
    if (registry.getSingleMetric(metricNameOnlineBackups) === undefined)
        registry.registerMetric(metricOnlineBackups);

    metricAuthorities.set(data.data.authorities.authorities);
    global.currentAuthorities = data.data.authorities.authorities;
    metricOnlineAuthorities.set(data.data.authorities.online_authorities);

    metricBackups.set(data.data.authorities.backups);
    metricOnlineBackups.set(data.data.authorities.online_backups);
};
