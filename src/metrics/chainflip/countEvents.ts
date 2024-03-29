import promClient, { Counter, Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { FlipConfig } from '../../config/interfaces';
import { decodeAddress } from '@polkadot/util-crypto';

const metricName: string = 'cf_events_count_total';
const metric: Counter = new promClient.Counter({
    name: metricName,
    help: 'Count of extrinsics on chain',
    labelNames: ['event'],
    registers: [],
});

const metricNameBroadcast: string = 'cf_broadcast_timeout_count';
const metricBroadcast: Gauge = new promClient.Gauge({
    name: metricNameBroadcast,
    help: 'Count of the broadcastTimeout events, grouped by broadcastId',
    labelNames: ['event', 'broadcastId'],
    registers: [],
});

const metricNameSlashing: string = 'cf_node_slashed';
const metricSlash: Counter = new promClient.Counter({
    name: metricNameSlashing,
    help: 'Number of time ss58 has been slashed',
    labelNames: ['event', 'ss58', 'publicKey', 'alias'],
    registers: [],
});

const errorMap = new Map();
errorMap.set(
    `{"module":{"index":35,"error":"0x03000000"}}`,
    'liquidityPools.UnspecifiedOrderPrice',
);
errorMap.set(
    `{"module":{"index":31,"error":"0x00000000"}}`,
    `liquidityProvider.InsufficientBalance`,
);

export const countEvents = async (context: Context): Promise<void> => {
    const { logger, registry, events, api } = context;
    const config = context.config as FlipConfig;
    const { accounts, skipEvents } = config;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricNameBroadcast) === undefined)
        registry.registerMetric(metricBroadcast);
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

        if (config.eventLog) {
            if (event.data.dispatchError) {
                const metadata = errorMap.has(event.data.dispatchError.toString())
                    ? { error: errorMap.get(event.data.dispatchError.toString()) }
                    : { error: 'Error mapping not defined' };
                logger.info('event_log', {
                    metadata,
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

        // Set extra labels for specific events
        if (event.method === 'BroadcastAttemptTimeout') {
            metricBroadcast
                .labels(`${event.section}:${event.method}`, event.data.broadcastId)
                .set(event.data.attemptCount);
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
