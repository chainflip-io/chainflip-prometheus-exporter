import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { FlipConfig } from '../../config/interfaces';
import { decodeAddress } from '@polkadot/util-crypto';
import {
    getStateChainError,
    logStructureSize,
    parseEvent,
    ProtocolData,
    toNumber,
} from '../../utils/utils';
import { eventsRotationInfo } from './eventsRotationInfo';

const metricName: string = 'cf_events_count_total';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Count of extrinsics on chain',
    labelNames: ['event'],
    registers: [],
});

const metricExtrinsicFailedName: string = 'cf_event_extrinsic_failed';
const metricExtrinsicFailed: Gauge = new promClient.Gauge({
    name: metricExtrinsicFailedName,
    help: 'Count of failed extrinsics on chain',
    labelNames: ['pallet', 'error'],
    registers: [],
});

const metricNameSlashing: string = 'cf_node_slashed';
const metricSlash: Gauge = new promClient.Gauge({
    name: metricNameSlashing,
    help: 'Number of time ss58 has been slashed',
    labelNames: ['ss58', 'publicKey', 'alias'],
    registers: [],
});

const metricNameCcmBroadcastAborted: string = 'cf_ccm_broadcast_aborted';
const metricCcmBroadcastAborted: Gauge = new promClient.Gauge({
    name: metricNameCcmBroadcastAborted,
    help: 'Count of CCM broadcast aborted events',
    labelNames: ['broadcaster'],
    registers: [],
});

const metricNameBroadcastAborted: string = 'cf_broadcast_aborted';
const metricBroadcastAborted: Gauge = new promClient.Gauge({
    name: metricNameBroadcastAborted,
    help: 'Count of NON-CCM broadcast aborted events',
    labelNames: ['broadcaster'],
    registers: [],
});

const metricNameReorgDetected: string = 'cf_reorg_detected';
const metricReorgDetected: Gauge = new promClient.Gauge({
    name: metricNameReorgDetected,
    help: 'Depth in block of a detected reorg',
    labelNames: ['tracked_chain'],
    registers: [],
});

const FOREIGN_CHAINS = [
    'ethereum',
    'bitcoin',
    'arbitrum',
    'solana',
    'assethub',
    'tron',
    'bsc',
] as const;

// EVM is shared by Ethereum, Arbitrum, Tron, and BSC. AssetHub uses the Polkadot signer.
const THRESHOLD_SIGNERS = ['evm', 'polkadot', 'bitcoin', 'solana'] as const;

// These are the election pallets whose ElectoralEvent can contain ReorgDetected in runtime 2.3.
const REORG_CHAINS = FOREIGN_CHAINS.filter((chain) => chain !== 'solana');

// Track which chains have had reorg events so we can reset them to 0 when no reorg is detected
let activeReorgChains: Set<string> = new Set<string>();

// Track CCM broadcasts with their block numbers for TTL cleanup
const ccmBroadcasts: Map<string, number> = new Map<string, number>();
const CCM_BROADCAST_TTL_BLOCKS = 1000; // Clean up after 1000 blocks (~2 hours)

function cleanupStaleCcmBroadcasts(currentBlock: number, logger: any) {
    for (const [broadcastKey, blockNumber] of ccmBroadcasts.entries()) {
        if (currentBlock - blockNumber > CCM_BROADCAST_TTL_BLOCKS) {
            ccmBroadcasts.delete(broadcastKey);
        }
    }
}

function ccmBroadcastKey(eventSection: string, broadcastId: unknown): string {
    const chain = eventSection.replace(/(?:IngressEgress|Broadcaster)$/, '');
    return `${chain}:${String(broadcastId)}`;
}

export const resetEventCountMetrics = (config: FlipConfig): void => {
    metric.reset();
    metricExtrinsicFailed.reset();
    metricSlash.reset();
    metricCcmBroadcastAborted.reset();
    metricBroadcastAborted.reset();
    metricReorgDetected.reset();
    activeReorgChains.clear();
    ccmBroadcasts.clear();

    metric.labels('governance:Approved').set(0);
    metric.labels('governance:Executed').set(0);
    metric.labels('governance:Proposed').set(0);
    metric.labels('flip:SlashingPerformed').set(0);

    for (const chain of FOREIGN_CHAINS) {
        const broadcaster = `${chain}Broadcaster`;
        const ingressEgress = `${chain}IngressEgress`;

        metric.labels(`${broadcaster}:BroadcastAborted`).set(0);
        metric.labels(`${broadcaster}:BroadcastTimeout`).set(0);
        metric.labels(`${ingressEgress}:ChannelOpeningFeePaid`).set(0);
        metric.labels(`${ingressEgress}:BoostedDepositLost`).set(0);
        metric.labels(`${ingressEgress}:TransferFallbackRequested`).set(0);
        metric.labels(`${chain}ChainTracking:ChainStateUpdated`).set(0);
        metricCcmBroadcastAborted.labels(broadcaster).set(0);
        metricBroadcastAborted.labels(broadcaster).set(0);
    }

    for (const signer of THRESHOLD_SIGNERS) {
        metric.labels(`${signer}ThresholdSigner:RetryRequested`).set(0);
        metric.labels(`${signer}ThresholdSigner:KeygenFailure`).set(0);
    }

    for (const chain of REORG_CHAINS) {
        metricReorgDetected.labels(chain).set(0);
    }

    for (const { ss58Address, alias } of config.accounts) {
        const hex = `0x${Buffer.from(decodeAddress(ss58Address)).toString('hex')}`;
        metricSlash.labels(ss58Address, hex, alias).set(0);
    }
};

export const countEvents = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_events_count_total')) {
        return;
    }
    const { logger, registry, metricFailure } = context;
    const api = data.blockApi;
    const config = context.config as FlipConfig;
    const { accounts, skipEvents } = config;

    logger.debug('scraping', { metric: metricName, blockNumber: data.blockNumber });

    try {
        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
        if (registry.getSingleMetric(metricExtrinsicFailedName) === undefined)
            registry.registerMetric(metricExtrinsicFailed);
        if (registry.getSingleMetric(metricNameSlashing) === undefined)
            registry.registerMetric(metricSlash);
        if (registry.getSingleMetric(metricNameCcmBroadcastAborted) === undefined)
            registry.registerMetric(metricCcmBroadcastAborted);
        if (registry.getSingleMetric(metricNameBroadcastAborted) === undefined)
            registry.registerMetric(metricBroadcastAborted);
        if (registry.getSingleMetric(metricNameReorgDetected) === undefined)
            registry.registerMetric(metricReorgDetected);
        cleanupStaleCcmBroadcasts(data.blockNumber, logger);
        logStructureSize(
            logger,
            'countEvents.ccmBroadcasts',
            ccmBroadcasts.size,
            data.blockNumber,
            {
                everyBlocks: 100,
            },
        );

        const events = await api.query.system.events();
        const reorgChains: Set<string> = new Set<string>();
        await eventsRotationInfo(context, data, events);
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

            // Save the list of broadcastId for CCM with current block number
            if (event.method === 'CcmBroadcastRequested') {
                const broadcastId = event.data.toJSON()[0];
                ccmBroadcasts.set(ccmBroadcastKey(event.section, broadcastId), data.blockNumber);
            }

            // Whenever a broadcast aborted is received we check if the broadcastId is in the list and if so we remove it
            // and increase the metric ccmBroadcastAborted
            if (event.method === 'BroadcastAborted') {
                const broadcastId = event.data.toJSON()[0];
                if (ccmBroadcasts.delete(ccmBroadcastKey(event.section, broadcastId))) {
                    // this is a ccm broadcast aborted!
                    metricCcmBroadcastAborted.labels(event.section).inc();
                } else {
                    // this is a normal broadcast aborted!
                    metricBroadcastAborted.labels(event.section).inc();
                }
            }
            // Remove it on broadcast success to avoid saving the broadcast_id indefinitely
            if (event.method === 'BroadcastSuccess') {
                const broadcastId = event.data.toJSON()[0];
                ccmBroadcasts.delete(ccmBroadcastKey(event.section, broadcastId));
            }

            let error;
            if (event.method === 'ExtrinsicFailed') {
                error = getStateChainError(api.registry, event.data.toJSON()[0].module);
                const parsedError = error.data.name.split(':');
                metricExtrinsicFailed.labels(`${parsedError[0]}`, `${parsedError[1]}`).inc();
            }

            if (config.eventLog) {
                if (event.data.dispatchError) {
                    logger.info('event_log', {
                        error,
                        event: `${event.section}:${event.method}`,
                        data: event.data.toHuman(),
                        block: data.blockNumber,
                    });
                } else {
                    const eventHumanized = event.data.toHuman();
                    parseEvent(eventHumanized);
                    if (typeof eventHumanized?.offence === 'object') {
                        eventHumanized.offence = Object.keys(eventHumanized.offence)[0].concat(
                            eventHumanized.offence[Object.keys(eventHumanized.offence)[0]],
                        );
                    }
                    logger.info('event_log', {
                        event: `${event.section}:${event.method}`,
                        data: eventHumanized,
                        block: data.blockNumber,
                    });
                }
            }
            if (event.method === 'SlashingPerformed') {
                for (const { ss58Address, alias } of accounts) {
                    const hex = `0x${Buffer.from(decodeAddress(ss58Address)).toString('hex')}`;
                    if (event.data.who.toString() === ss58Address) {
                        metricSlash.labels(ss58Address, hex, alias).inc(1);
                    }
                }
            }

            // Reorged events are custom event that not all eletions pallet instances have, if they do these are part of the ElectoralEvent
            if (event.method === 'ElectoralEvent') {
                const parsedEvent = event.data.toJSON()[0];
                if (parsedEvent?.reorgDetected) {
                    const chain = event.section.replace('Elections', '');
                    reorgChains.add(chain);
                    const blocks = parsedEvent.reorgDetected.reorgedBlocks;
                    const startBlock = toNumber(blocks[0]);
                    const endBlock = toNumber(blocks[1]);
                    logger.info('reorg_log', {
                        event: `reorgDetected`,
                        chain,
                        start_block: startBlock,
                        end_block: endBlock,
                        depth: endBlock - startBlock + 1,
                        block: data.blockNumber,
                    });
                    metricReorgDetected.labels(chain).set(endBlock - startBlock + 1);
                }
            }
        }
        for (const chain of activeReorgChains) {
            if (!reorgChains.has(chain)) {
                metricReorgDetected.labels(chain).set(0);
            }
        }
        activeReorgChains = reorgChains;

        metricFailure.labels('events_metrics').set(0);
    } catch (e) {
        logger.error(e);
        metricFailure.labels('events_metrics').set(1);
    }
};
