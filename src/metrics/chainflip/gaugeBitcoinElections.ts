import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricNameWitnessFrom: string = 'cf_bhw_witness_from';
const metricWitnessFrom: Gauge = new promClient.Gauge({
    name: metricNameWitnessFrom,
    help: 'BHW Witness from',
    labelNames: ['tracked_chain'],
    registers: [],
});

const metricNameSeenHeightsBelow: string = 'cf_bw_seen_heights_below';
const metricSeenHeightsBelow: Gauge = new promClient.Gauge({
    name: metricNameSeenHeightsBelow,
    help: 'BW Seen heights below',
    labelNames: ['tracked_chain', 'bw_instance'],
    registers: [],
});

const metricNameHighestEverOngoing: string = 'cf_bw_highest_ever_ongoing';
const metricHighestEverOngoing: Gauge = new promClient.Gauge({
    name: metricNameHighestEverOngoing,
    help: 'BW Highest ever ongoing',
    labelNames: ['tracked_chain', 'bw_instance'],
    registers: [],
});

const metricNameQueuedHash: string = 'cf_bw_queued_hash_elections';
const metricQueuedHash: Gauge = new promClient.Gauge({
    name: metricNameQueuedHash,
    help: 'BW number of queued hash elections',
    labelNames: ['tracked_chain', 'bw_instance'],
    registers: [],
});

const metricNameQueuedSafe: string = 'cf_bw_queued_safe_elections';
const metricQueuedSafe: Gauge = new promClient.Gauge({
    name: metricNameQueuedSafe,
    help: 'BW number of queued safe elections',
    labelNames: ['tracked_chain', 'bw_instance'],
    registers: [],
});

const metricNameOngoing: string = 'cf_bw_ongoing_elections';
const metricOngoing: Gauge = new promClient.Gauge({
    name: metricNameOngoing,
    help: 'BW number of ongoing elections',
    labelNames: ['tracked_chain', 'bw_instance'],
    registers: [],
});

export const gaugeBitcoinElections = async (
    context: Context,
    data: ProtocolData,
): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_bitcoin_elections')) {
        return;
    }
    const { logger, registry, metricFailure, apiLatest } = context;

    if (registry.getSingleMetric(metricNameWitnessFrom) === undefined) {
        registry.registerMetric(metricWitnessFrom);
    }
    if (registry.getSingleMetric(metricNameSeenHeightsBelow) === undefined) {
        registry.registerMetric(metricSeenHeightsBelow);
    }
    if (registry.getSingleMetric(metricNameHighestEverOngoing) === undefined) {
        registry.registerMetric(metricHighestEverOngoing);
    }
    if (registry.getSingleMetric(metricNameQueuedHash) === undefined) {
        registry.registerMetric(metricQueuedHash);
    }
    if (registry.getSingleMetric(metricNameQueuedSafe) === undefined) {
        registry.registerMetric(metricQueuedSafe);
    }
    if (registry.getSingleMetric(metricNameOngoing) === undefined) {
        registry.registerMetric(metricOngoing);
    }

    try {
        const api = await apiLatest.at(data.blockHash);
        const unsync_state = (
            await api.query.bitcoinElections.electoralUnsynchronisedState()
        ).toJSON();

        const bhw_witnessFrom = unsync_state[0].phase.runningBitcoin.witnessFrom;
        metricWitnessFrom.labels('bitcoin').set(bhw_witnessFrom);

        // Block Height Witnesser
        logger.info('Bitcoin_BHW_state', {
            block: data.header,
            data: {
                bhw_witnessFrom,
                bhw_headers: unsync_state[0].phase.runningBitcoin.headers,
            },
        });

        // Deposit channels
        const bw_deposit_channels = unsync_state[1];
        const bw_deposit_channels_seen_heights_below =
            bw_deposit_channels.elections.seenHeightsBelow;
        const bw_deposit_channels_highest_ever_ongoing =
            bw_deposit_channels.elections.highestEverOngoingElection;
        const bw_deposit_channels_queued_hash = bw_deposit_channels.elections.queuedHashElections;
        const bw_deposit_channels_queued_safe =
            bw_deposit_channels.elections.queuedSafeElections.elections;
        const bw_deposit_channels_queued_safe_count = Object.entries(
            bw_deposit_channels_queued_safe,
        ).reduce((sum, [key, value]) => sum + (Number(value) - Number(key)), 0);
        const bw_deposit_channels_ongoing = bw_deposit_channels.elections.ongoing;
        metricSeenHeightsBelow
            .labels('bitcoin', 'deposit_channels')
            .set(bw_deposit_channels_seen_heights_below);
        metricHighestEverOngoing
            .labels('bitcoin', 'deposit_channels')
            .set(bw_deposit_channels_highest_ever_ongoing);
        metricQueuedHash
            .labels('bitcoin', 'deposit_channels')
            .set(Object.keys(bw_deposit_channels_queued_hash).length);
        metricQueuedSafe
            .labels('bitcoin', 'deposit_channels')
            .set(bw_deposit_channels_queued_safe_count);
        metricOngoing
            .labels('bitcoin', 'deposit_channels')
            .set(Object.keys(bw_deposit_channels_ongoing).length);
        logger.info('Bitcoin_BW_deposit_channels_state', {
            block: data.header,
            data: {
                bw_deposit_channels_seen_heights_below,
                bw_deposit_channels_highest_ever_ongoing,
                bw_deposit_channels_ongoing,
                bw_deposit_channels_queued_safe,
                bw_deposit_channels_queued_hash,
                bw_blocks_data: bw_deposit_channels.blockProcessor.blocksData,
                bw_processed_events: bw_deposit_channels.blockProcessor.processedEvents,
            },
        });

        // Vaults
        const bw_vaults = unsync_state[2];
        const bw_vaults_seen_heights_below = bw_vaults.elections.seenHeightsBelow;
        const bw_vaults_highest_ever_ongoing = bw_vaults.elections.highestEverOngoingElection;
        const bw_vaults_queued_hash = bw_vaults.elections.queuedHashElections;
        const bw_vaults_queued_safe = bw_vaults.elections.queuedSafeElections.elections;
        const bw_vaults_queued_safe_count = Object.entries(bw_vaults_queued_safe).reduce(
            (sum, [key, value]) => sum + (Number(value) - Number(key)),
            0,
        );
        const bw_vaults_ongoing = bw_vaults.elections.ongoing;
        metricSeenHeightsBelow.labels('bitcoin', 'vaults').set(bw_vaults_seen_heights_below);
        metricHighestEverOngoing.labels('bitcoin', 'vaults').set(bw_vaults_highest_ever_ongoing);
        metricQueuedHash.labels('bitcoin', 'vaults').set(Object.keys(bw_vaults_queued_hash).length);
        metricQueuedSafe
            .labels('bitcoin', 'vaults')
            .set(Object.keys(bw_vaults_queued_safe_count).length);
        metricOngoing.labels('bitcoin', 'vaults').set(Object.keys(bw_vaults_ongoing).length);
        logger.info('Bitcoin_BW_vaults_state', {
            block: data.header,
            data: {
                bw_vaults_seen_heights_below,
                bw_vaults_highest_ever_ongoing,
                bw_vaults_ongoing,
                bw_vaults_queued_safe,
                bw_vaults_queued_hash,
                bw_blocks_data: bw_vaults.blockProcessor.blocksData,
                bw_processed_events: bw_vaults.blockProcessor.processedEvents,
            },
        });

        // Egresses
        const bw_egresses = unsync_state[3];
        const bw_egresses_seen_heights_below = bw_egresses.elections.seenHeightsBelow;
        const bw_egresses_highest_ever_ongoing = bw_egresses.elections.highestEverOngoingElection;
        const bw_egresses_queued_hash = bw_egresses.elections.queuedHashElections;
        const bw_egresses_queued_safe = bw_egresses.elections.queuedSafeElections.elections;
        const bw_egresses_queued_safe_count = Object.entries(bw_egresses_queued_safe).reduce(
            (sum, [key, value]) => sum + (Number(value) - Number(key)),
            0,
        );
        const bw_egresses_ongoing = bw_egresses.elections.ongoing;
        metricSeenHeightsBelow.labels('bitcoin', 'egresses').set(bw_egresses_seen_heights_below);
        metricHighestEverOngoing
            .labels('bitcoin', 'egresses')
            .set(bw_egresses_highest_ever_ongoing);
        metricQueuedHash
            .labels('bitcoin', 'egresses')
            .set(Object.keys(bw_egresses_queued_hash).length);
        metricQueuedSafe
            .labels('bitcoin', 'egresses')
            .set(Object.keys(bw_egresses_queued_safe_count).length);
        metricOngoing.labels('bitcoin', 'egresses').set(Object.keys(bw_egresses_ongoing).length);
        logger.info('Bitcoin_BW_egresses_state', {
            block: data.header,
            data: {
                bw_egresses_seen_heights_below,
                bw_egresses_highest_ever_ongoing,
                bw_egresses_ongoing,
                bw_egresses_queued_safe,
                bw_egresses_queued_hash,
                bw_blocks_data: bw_egresses.blockProcessor.blocksData,
                bw_processed_events: bw_egresses.blockProcessor.processedEvents,
            },
        });

        metricFailure.labels('cf_bitcoin_elections').set(0);
    } catch (e) {
        logger.error(e);
        metricFailure.labels('cf_bitcoin_elections').set(1);
    }
};
