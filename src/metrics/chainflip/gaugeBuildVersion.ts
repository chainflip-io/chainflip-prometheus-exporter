import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricName: string = 'cf_build_version';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Current version of the runtime and node.',
    registers: [],
    labelNames: ['runtime', 'node'],
});

export const gaugeBuildVersion = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_build_version')) {
        return;
    }
    const { logger, registry, metricFailure, apiLatest } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    let runtime = '';
    let node = '';
    try {
        node = await apiLatest.rpc.system.version();
        const api = await apiLatest.at(data.blockHash);
        const getRuntime = await api.query.system.lastRuntimeUpgrade();
        runtime = getRuntime.toJSON().specVersion;

        metric.set({ runtime, node }, 1);
        metricFailure.labels('cf_build_version').set(0);
    } catch (e) {
        logger.error(e);
        metricFailure.labels('cf_build_version').set(1);
    }
};
