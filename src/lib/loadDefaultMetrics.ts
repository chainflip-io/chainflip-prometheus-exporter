import promClient from 'prom-client';
import { Context } from './interfaces';
import { BtcConfig, DotConfig, EthConfig, FlipConfig } from '../config/interfaces';

export default function loadDefaultMetrics(context: Context): any {
    const { logger, registry } = context;
    const config = context.config as EthConfig | BtcConfig | DotConfig | FlipConfig;
    if (config.defaultMetrics.length === 0) return logger.info(`No default metrics to load`);
    logger.info(`Loading default metrics`);
    for (const defaultMetric of config.defaultMetrics) {
        logger.debug(`${defaultMetric.name} = ${defaultMetric.value}`);
        new promClient.Gauge({
            name: defaultMetric.name,
            help: 'Default metric',
            registers: [registry],
        }).set(defaultMetric.value);
    }
}
