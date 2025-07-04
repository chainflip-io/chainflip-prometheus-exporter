import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { FlipConfig } from '../../config/interfaces';
import { decodeAddress } from '@polkadot/util-crypto';
import { getStateChainError, parseEvent, ProtocolData } from '../../utils/utils';
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

const ccmBroadcasts: Set<number> = new Set<number>();

export const countEvents = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_events_count_total')) {
        return;
    }
    const { logger, registry, apiLatest, metricFailure } = context;
    const api = await apiLatest.at(data.blockHash);
    const config = context.config as FlipConfig;
    const { accounts, skipEvents } = config;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) {
        registry.registerMetric(metric);
        metric.labels('governance:Approved').set(0);
        metric.labels('governance:Executed').set(0);
        metric.labels('governance:Proposed').set(0);
        metric.labels('ethereumBroadcaster:BroadcastAborted').set(0);
        metric.labels('polkadotBroadcaster:BroadcastAborted').set(0);
        metric.labels('arbitrumBroadcaster:BroadcastAborted').set(0);
        metric.labels('bitcoinBroadcaster:BroadcastAborted').set(0);
        metric.labels('solanaBroadcaster:BroadcastAborted').set(0);
        metric.labels('bitcoinBroadcaster:BroadcastTimeout').set(0);
        metric.labels('ethereumBroadcaster:BroadcastTimeout').set(0);
        metric.labels('polkadotBroadcaster:BroadcastTimeout').set(0);
        metric.labels('arbitrumBroadcaster:BroadcastTimeout').set(0);
        metric.labels('solanaBroadcaster:BroadcastTimeout').set(0);
        metric.labels('evmThresholdSigner:RetryRequested').set(0);
        metric.labels('bitcoinThresholdSigner:RetryRequested').set(0);
        metric.labels('polkadotThresholdSigner:RetryRequested').set(0);
        metric.labels('solanaThresholdSigner:RetryRequested').set(0);
        metric.labels('evmThresholdSigner:KeygenFailure').set(0);
        metric.labels('bitcoinThresholdSigner:KeygenFailure').set(0);
        metric.labels('polkadotThresholdSigner:KeygenFailure').set(0);
        metric.labels('solanaThresholdSigner:KeygenFailure').set(0);
        metric.labels('solanaIngressEgress:ChannelOpeningFeePaid').set(0);
        metric.labels('bitcoinIngressEgress:ChannelOpeningFeePaid').set(0);
        metric.labels('ethereumIngressEgress:ChannelOpeningFeePaid').set(0);
        metric.labels('polkadotIngressEgress:ChannelOpeningFeePaid').set(0);
        metric.labels('arbitrumIngressEgress:ChannelOpeningFeePaid').set(0);
        metric.labels('flip:SlashingPerformed').set(0);
        metric.labels('ethereumChainTracking:ChainStateUpdated').set(0);
        metric.labels('bitcoinChainTracking:ChainStateUpdated').set(0);
        metric.labels('polkadotChainTracking:ChainStateUpdated').set(0);
        metric.labels('arbitrumChainTracking:ChainStateUpdated').set(0);
        metric.labels('bitcoinIngressEgress:BoostedDepositLost').set(0);
    }
    if (registry.getSingleMetric(metricExtrinsicFailedName) === undefined)
        registry.registerMetric(metricExtrinsicFailed);
    if (registry.getSingleMetric(metricNameSlashing) === undefined) {
        registry.registerMetric(metricSlash);
        for (const { ss58Address, alias } of accounts) {
            const hex = `0x${Buffer.from(decodeAddress(ss58Address)).toString('hex')}`;
            metricSlash.labels(ss58Address, hex, alias).set(0);
        }
    }
    if (registry.getSingleMetric(metricNameCcmBroadcastAborted) === undefined) {
        registry.registerMetric(metricCcmBroadcastAborted);
        metricCcmBroadcastAborted.labels('arbitrumBroadcaster').set(0);
        metricCcmBroadcastAborted.labels('bitcoinBroadcaster').set(0);
        metricCcmBroadcastAborted.labels('ethereumBroadcaster').set(0);
        metricCcmBroadcastAborted.labels('polkadotBroadcaster').set(0);
        metricCcmBroadcastAborted.labels('solanaBroadcaster').set(0);
    }
    if (registry.getSingleMetric(metricNameBroadcastAborted) === undefined) {
        registry.registerMetric(metricBroadcastAborted);
        metricBroadcastAborted.labels('arbitrumBroadcaster').set(0);
        metricBroadcastAborted.labels('bitcoinBroadcaster').set(0);
        metricBroadcastAborted.labels('ethereumBroadcaster').set(0);
        metricBroadcastAborted.labels('polkadotBroadcaster').set(0);
        metricBroadcastAborted.labels('solanaBroadcaster').set(0);
    }
    if (registry.getSingleMetric(metricNameReorgDetected) === undefined) {
        registry.registerMetric(metricReorgDetected);
    }
    try {
        const events = await api.query.system.events();
        let foundReorg = false;
        eventsRotationInfo(context, data, events);
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
                    metricCcmBroadcastAborted.labels(event.section).inc();
                } else {
                    // this is a normal broadcast aborted!
                    metricBroadcastAborted.labels(event.section).inc();
                }
            }
            // Remove it on broadcast success to avoid saving the broadcast_id indefinitely
            if (event.method === 'BroadcastSuccess') {
                const broacastId = event.data.toJSON()[0];
                ccmBroadcasts.delete(broacastId);
            }

            let error;
            if (event.method === 'ExtrinsicFailed') {
                error = await getStateChainError(
                    apiLatest,
                    event.data.toJSON()[0].module,
                    data.blockHash,
                );
                const parsedError = error.data.name.split(':');
                metricExtrinsicFailed.labels(`${parsedError[0]}`, `${parsedError[1]}`).inc();
            }

            if (config.eventLog) {
                if (event.data.dispatchError) {
                    logger.info('event_log', {
                        error,
                        event: `${event.section}:${event.method}`,
                        data: event.data.toHuman(),
                        block: data.header,
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
                        block: data.header,
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

            if (event.method === 'ElectoralEvent') {
                foundReorg = true;
                const blocks = event.data.toJSON()[0].reorgDetected.reorgedBlocks;
                metricReorgDetected.labels('bitcoin').set(blocks[1] - blocks[0] + 1);
            }
        }
        if (!foundReorg) {
            metricReorgDetected.labels('bitcoin').set(0);
        }

        metricFailure.labels('events_metrics').set(0);
    } catch (e) {
        logger.error(e);
        metricFailure.labels('events_metrics').set(1);
    }
};
