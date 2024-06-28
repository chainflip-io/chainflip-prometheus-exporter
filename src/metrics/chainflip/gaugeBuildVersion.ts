import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import makeRpcRequest from '../../utils/makeRpcRequest';

const metricName: string = 'cf_build_version';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Current version of the runtime and node.',
    registers: [],
    labelNames: ['runtime', 'node'],
});

export const gaugeBuildVersion = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_build_version')) {
        return;
    }
    const { logger, api, registry } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    let runtime = '';
    let node = '';
    try {
        node = await api.rpc.system.version();
        const getRuntime = await api.query.system.lastRuntimeUpgrade();
        runtime = getRuntime.toJSON().specVersion;

        metric.set({ runtime, node }, 1);
    } catch (e) {
        logger.error(e);
    }
};
