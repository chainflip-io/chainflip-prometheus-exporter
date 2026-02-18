import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';
import { makeUncheckedRpcRequest } from '../../utils/makeRpcRequest';

const metricNameSafeMode: string = 'cf_safe_mode';
const metricSafeMode: Gauge = new promClient.Gauge({
    name: metricNameSafeMode,
    help: 'Safe mode enabled for',
    labelNames: ['name'],
    registers: [],
});

export const gaugeSafeMode = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_safe_mode')) {
        return;
    }
    const { logger, apiLatest, registry, metricFailure } = context;

    logger.debug(`Scraping ${metricNameSafeMode}`);

    if (registry.getSingleMetric(metricNameSafeMode) === undefined)
        registry.registerMetric(metricSafeMode);

    metricFailure.labels({ metric: metricNameSafeMode }).set(0);

    try {
        const safeModeResponse = await makeUncheckedRpcRequest(
            apiLatest,
            'safe_mode_statuses',
            data.blockHash,
        );

        const flattenedStatuses = flattenObject(safeModeResponse);
        for (const [name, value] of flattenedStatuses) {
            const safeModeEnabled = getSafeModeStatus(name, value);
            if (safeModeEnabled !== null) {
                metricSafeMode.labels(name).set(safeModeEnabled);
            }
        }
    } catch (e) {
        metricFailure.labels({ metric: metricNameSafeMode }).set(1);
    }
};

function flattenObject(
    obj: Record<string, unknown>,
    parentKey = '',
): Array<[name: string, value: unknown]> {
    let result: Array<[name: string, value: unknown]> = [];

    for (const [key, value] of Object.entries(obj)) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;

        if (Array.isArray(value)) {
            continue;
        }

        if (value !== null && typeof value === 'object') {
            result = result.concat(flattenObject(value as Record<string, unknown>, newKey));
        } else {
            result.push([newKey, value]);
        }
    }

    return result;
}

function getSafeModeStatus(name: string, value: unknown): number | null {
    if (name === 'witnesser') {
        return value === 'CodeGreen' ? 0 : 1;
    }

    return value ? 0 : 1;
}
