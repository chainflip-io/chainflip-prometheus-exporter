import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';
import { makeUncheckedRpcRequest } from '../../utils/makeRpcRequest';

const metricNameSafeMode: string = 'cf_safe_mode';
const metricSafeMode: Gauge = new promClient.Gauge({
    name: metricNameSafeMode,
    help: 'The reputation of a validator',
    labelNames: ['name'],
    registers: [],
});

export const gaugeSafeMode = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_validator')) {
        return;
    }
    const { logger, apiLatest, registry, metricFailure } = context;

    logger.debug(`Scraping ${metricNameSafeMode}`);

    if (registry.getSingleMetric(metricNameSafeMode) === undefined)
        registry.registerMetric(metricSafeMode);

    metricFailure.labels({ metric: metricNameSafeMode }).set(0);

    try {
        const safe_modes = await makeUncheckedRpcRequest(
            apiLatest,
            'safe_mode_statuses',
            context.blockHash,
        );
        const flatten = flattenObject(safe_modes);
        for (const elem of flatten) {
            if (elem[0] === 'witnesser') {
                const status = elem[1] === 'CodeGreen' ? 0 : 1;
                metricSafeMode.labels(elem[0]).set(status);
            } else {
                metricSafeMode.labels(elem[0]).set(elem[1] === 'true' ? 1 : 0);
            }
        }
    } catch (e) {
        metricFailure.labels({ metric: metricNameSafeMode }).set(1);
    }
};

function flattenObject(obj: Record<string, unknown>, parentKey = ''): any[] {
    let result: any[] = [];
    for (const key in obj) {
        // eslint-disable-next-line no-prototype-builtins
        if (obj.hasOwnProperty(key)) {
            const newKey = parentKey ? `${parentKey}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                // @ts-expect-error Ingore
                result = result.concat(flattenObject(obj[key], newKey));
            } else {
                result.push([newKey, obj[key]]);
            }
        }
    }
    return result;
}
