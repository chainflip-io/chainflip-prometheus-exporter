import promClient, { Counter, Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { FlipConfig } from '../../config/interfaces';
import { decodeAddress } from '@polkadot/util-crypto';
import { getStateChainError } from '../../utils/utils';

const metricName: string = 'cf_events_count_total';
const metric: Counter = new promClient.Counter({
    name: metricName,
    help: 'Count of extrinsics on chain',
    labelNames: ['event'],
    registers: [],
});

const metricExtrinsicFailedName: string = 'cf_event_extrinsic_failed';
const metricExtrinsicFailed: Counter = new promClient.Counter({
    name: metricExtrinsicFailedName,
    help: 'Count of failed extrinsics on chain',
    labelNames: ['pallet', 'error'],
    registers: [],
});

const metricNameSlashing: string = 'cf_node_slashed';
const metricSlash: Counter = new promClient.Counter({
    name: metricNameSlashing,
    help: 'Number of time ss58 has been slashed',
    labelNames: ['event', 'ss58', 'publicKey', 'alias'],
    registers: [],
});

export const countEvents = async (context: Context): Promise<void> => {
    const { logger, registry, events, api } = context;
    const config = context.config as FlipConfig;
    const { accounts, skipEvents } = config;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricExtrinsicFailedName) === undefined)
        registry.registerMetric(metricExtrinsicFailed);
    if (registry.getSingleMetric(metricNameSlashing) === undefined)
        registry.registerMetric(metricSlash);

    for (const { event } of events) {
        let skip = false;
        for (const { section, method } of skipEvents) {
            if (event.section === section && event.method === method) {
                skip = true;
                continue;
            }
        }
        if (skip) {
            continue;
        }
        metric.labels(`${event.section}:${event.method}`).inc(1);

        let error;
        if (event.method === 'ExtrinsicFailed') {
            error = await getStateChainError(api, event.data.toJSON()[0].module);
            const parsedError = error.data.name.split(':');
            metricExtrinsicFailed.labels(`${parsedError[0]}`, `${parsedError[1]}`).inc();
        }

        if (config.eventLog) {
            if (event.data.dispatchError) {
                logger.info('event_log', {
                    error,
                    event: `${event.section}:${event.method}`,
                    data: event.data.toHuman(),
                });
            } else {
                logger.info('event_log', {
                    event: `${event.section}:${event.method}`,
                    data: event.data.toHuman(),
                });
            }
        }
        if (event.method === 'SlashingPerformed') {
            for (const { ss58Address, alias } of accounts) {
                const hex = `0x${Buffer.from(decodeAddress(ss58Address)).toString('hex')}`;
                if (event.data.who.toString() === ss58Address) {
                    metricSlash
                        .labels(`${event.section}:${event.method}`, ss58Address, hex, alias)
                        .inc(1);
                }
            }
        }
    }
};
