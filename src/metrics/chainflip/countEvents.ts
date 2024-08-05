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

const metricNameCcmBroadcastAborted: string = 'cf_ccm_broadcast_aborted';
const metricCcmBroadcastAborted: Counter = new promClient.Counter({
    name: metricNameCcmBroadcastAborted,
    help: 'Count of CCM broadcast aborted events',
    registers: [],
});

const metricNameBroadcastAborted: string = 'cf_broadcast_aborted';
const metricBroadcastAborted: Counter = new promClient.Counter({
    name: metricNameBroadcastAborted,
    help: 'Count of NON-CCM broadcast aborted events',
    registers: [],
});

const ccmBroadcasts: Set<number> = new Set<number>();

export const countEvents = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_events_count_total')) {
        return;
    }
    const { logger, registry, events, api } = context;
    const config = context.config as FlipConfig;
    const { accounts, skipEvents } = config;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) {
        registry.registerMetric(metric);
        metric.labels('governance:Approved').inc();
        metric.labels('governance:Executed').inc();
        metric.labels('governance:Proposed').inc();
        metric.labels('ethereumBroadcaster:BroadcastAborted').inc();
        metric.labels('polkadotBroadcaster:BroadcastAborted').inc();
        metric.labels('arbitrumBroadcaster:BroadcastAborted').inc();
        metric.labels('bitcoinBroadcaster:BroadcastAborted').inc();
        metric.labels('solanaBroadcaster:BroadcastAborted').inc();
        metric.labels('bitcoinBroadcaster:BroadcastTimeout').inc();
        metric.labels('ethereumBroadcaster:BroadcastTimeout').inc();
        metric.labels('polkadotBroadcaster:BroadcastTimeout').inc();
        metric.labels('arbitrumBroadcaster:BroadcastTimeout').inc();
        metric.labels('solanaBroadcaster:BroadcastTimeout').inc();
        metric.labels('evmThresholdSigner:RetryRequested').inc();
        metric.labels('bitcoinThresholdSigner:RetryRequested').inc();
        metric.labels('polkadotThresholdSigner:RetryRequested').inc();
        metric.labels('solanaThresholdSigner:RetryRequested').inc();
        metric.labels('evmThresholdSigner:KeygenFailure').inc();
        metric.labels('bitcoinThresholdSigner:KeygenFailure').inc();
        metric.labels('polkadotThresholdSigner:KeygenFailure').inc();
        metric.labels('solanaThresholdSigner:KeygenFailure').inc();
    }
    if (registry.getSingleMetric(metricExtrinsicFailedName) === undefined)
        registry.registerMetric(metricExtrinsicFailed);
    if (registry.getSingleMetric(metricNameSlashing) === undefined)
        registry.registerMetric(metricSlash);
    if (registry.getSingleMetric(metricNameCcmBroadcastAborted) === undefined) {
        registry.registerMetric(metricCcmBroadcastAborted);
        metricCcmBroadcastAborted.inc();
    }
    if (registry.getSingleMetric(metricNameBroadcastAborted) === undefined) {
        registry.registerMetric(metricBroadcastAborted);
        metricBroadcastAborted.inc();
    }

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

        // Save the list of broadcastId for CCM
        if (event.method === 'CcmBroadcastRequested') {
            const broacastId = event.data.toJSON()[0];
            ccmBroadcasts.add(broacastId);
        }

        // Whenever a broadcast aborted is received we check if the broadcastId is in the list and if so we remove it
        // and increase the metric ccmBroadcastAborted
        if (event.method === 'BroadcastAborted') {
            const broacastId = event.data.toJSON()[0];
            if (ccmBroadcasts.delete(broacastId)) {
                // this is a ccm broadcast aborted!
                metricCcmBroadcastAborted.inc();
            } else {
                // this is a normal broadcast aborted!
                metricBroadcastAborted.inc();
            }
        }
        // Remove it on broadcast success to avoid saving the broadcast_id indefinitely
        if (event.method === 'BroadcastSuccess') {
            const broacastId = event.data.toJSON()[0];
            ccmBroadcasts.delete(broacastId);
        }

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
                    block: global.currentBlock,
                });
            } else {
                logger.info('event_log', {
                    event: `${event.section}:${event.method}`,
                    data: event.data.toHuman(),
                    block: global.currentBlock,
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
