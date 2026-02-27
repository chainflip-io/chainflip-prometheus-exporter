import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

type ElectionInstance = {
    index: number;
    instanceLabel: string;
};

type ChainElectionConfig = {
    chainName: string;
    palletName: string;
    bhwFieldPath: string;
    electionInstances: ElectionInstance[];
    skipMetricKey: string;
};

const CHAIN_CONFIGS: ChainElectionConfig[] = [
    {
        chainName: 'bitcoin',
        palletName: 'bitcoinElections',
        bhwFieldPath: 'runningBitcoin',
        electionInstances: [
            { index: 1, instanceLabel: 'deposit_channels' },
            { index: 2, instanceLabel: 'vaults' },
            { index: 3, instanceLabel: 'egresses' },
        ],
        skipMetricKey: 'cf_bitcoin_elections',
    },
    {
        chainName: 'ethereum',
        palletName: 'ethereumElections',
        bhwFieldPath: 'runningEthereum',
        electionInstances: [
            { index: 1, instanceLabel: 'deposit_channels' },
            { index: 2, instanceLabel: 'vaults' },
            { index: 3, instanceLabel: 'key_manager' },
            // index 4: FeeTracking - skipped
            // index 5: Liveness - skipped
            { index: 6, instanceLabel: 'state_chain_gateway' },
            { index: 7, instanceLabel: 'sc_utils' },
        ],
        skipMetricKey: 'cf_ethereum_elections',
    },
    {
        chainName: 'arbitrum',
        palletName: 'arbitrumElections',
        bhwFieldPath: 'runningArbitrum',
        electionInstances: [
            { index: 1, instanceLabel: 'deposit_channels' },
            { index: 2, instanceLabel: 'vaults' },
            { index: 3, instanceLabel: 'key_manager' },
            // index 4: FeeTracking - skipped
            // index 5: Liveness - skipped
        ],
        skipMetricKey: 'cf_arbitrum_elections',
    },
];

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

const metricNameBtcFees: string = 'cf_btc_fee_info';
const metricBtcFees: Gauge = new promClient.Gauge({
    name: metricNameBtcFees,
    help: 'Tracked Fee value for BTC in sats/KB',
    registers: [],
});

function toNumber(value: any): number {
    if (typeof value === 'object' && value !== null && 'root' in value) {
        return Number(value.root);
    }
    return Number(value);
}

function processBHW(
    unsyncState: any,
    config: ChainElectionConfig,
    blockNumber: number,
    logger: any,
): void {
    const bhwEntry = unsyncState[0];
    const witnessFrom = toNumber(bhwEntry.phase[config.bhwFieldPath].witnessFrom);
    metricWitnessFrom.labels(config.chainName).set(witnessFrom);

    const chainCapitalized = config.chainName.charAt(0).toUpperCase() + config.chainName.slice(1);
    logger.info(`${chainCapitalized}_BHW_state`, {
        block: blockNumber,
        data: {
            bhw_witnessFrom: witnessFrom,
            bhw_headers: bhwEntry.phase[config.bhwFieldPath].headers,
        },
    });
}

function processElectionInstance(
    unsyncState: any,
    instance: ElectionInstance,
    chainName: string,
    blockNumber: number,
    logger: any,
): void {
    const stateEntry = unsyncState[instance.index];
    const elections = stateEntry.elections;

    const seenHeightsBelow = toNumber(elections.seenHeightsBelow);
    const highestEverOngoing = toNumber(elections.highestEverOngoingElection);
    const queuedHash = elections.queuedHashElections;
    const queuedSafe = elections.queuedSafeElections.elections;
    const queuedSafeCount = Object.entries(queuedSafe).reduce(
        (sum, [key, value]) => sum + (Number(value) - Number(key)),
        0,
    );
    const ongoing = elections.ongoing;

    metricSeenHeightsBelow.labels(chainName, instance.instanceLabel).set(seenHeightsBelow);
    metricHighestEverOngoing.labels(chainName, instance.instanceLabel).set(highestEverOngoing);
    metricQueuedHash.labels(chainName, instance.instanceLabel).set(Object.keys(queuedHash).length);
    metricQueuedSafe.labels(chainName, instance.instanceLabel).set(queuedSafeCount);
    metricOngoing.labels(chainName, instance.instanceLabel).set(Object.keys(ongoing).length);

    const chainCapitalized = chainName.charAt(0).toUpperCase() + chainName.slice(1);
    logger.info(`${chainCapitalized}_BW_${instance.instanceLabel}_state`, {
        block: blockNumber,
        data: {
            [`bw_${instance.instanceLabel}_seen_heights_below`]: seenHeightsBelow,
            [`bw_${instance.instanceLabel}_highest_ever_ongoing`]: highestEverOngoing,
            [`bw_${instance.instanceLabel}_ongoing`]: ongoing,
            [`bw_${instance.instanceLabel}_queued_safe`]: queuedSafe,
            [`bw_${instance.instanceLabel}_queued_hash`]: queuedHash,
            bw_blocks_data: stateEntry.blockProcessor.blocksData,
            bw_processed_events: stateEntry.blockProcessor.processedEvents,
        },
    });
}

export const gaugeElections = async (context: Context, data: ProtocolData): Promise<void> => {
    const { logger, registry, metricFailure } = context;

    if (registry.getSingleMetric(metricNameWitnessFrom) === undefined)
        registry.registerMetric(metricWitnessFrom);
    if (registry.getSingleMetric(metricNameSeenHeightsBelow) === undefined)
        registry.registerMetric(metricSeenHeightsBelow);
    if (registry.getSingleMetric(metricNameHighestEverOngoing) === undefined)
        registry.registerMetric(metricHighestEverOngoing);
    if (registry.getSingleMetric(metricNameQueuedHash) === undefined)
        registry.registerMetric(metricQueuedHash);
    if (registry.getSingleMetric(metricNameQueuedSafe) === undefined)
        registry.registerMetric(metricQueuedSafe);
    if (registry.getSingleMetric(metricNameOngoing) === undefined)
        registry.registerMetric(metricOngoing);
    if (registry.getSingleMetric(metricNameBtcFees) === undefined)
        registry.registerMetric(metricBtcFees);

    const api = data.blockApi;

    for (const chainConfig of CHAIN_CONFIGS) {
        if (context.config.skipMetrics.includes(chainConfig.skipMetricKey)) {
            continue;
        }

        logger.debug(`Scraping ${chainConfig.skipMetricKey}`);

        try {
            const unsyncState = (
                await api.query[chainConfig.palletName].electoralUnsynchronisedState()
            ).toJSON();

            processBHW(unsyncState, chainConfig, data.blockNumber, logger);

            for (const instance of chainConfig.electionInstances) {
                processElectionInstance(
                    unsyncState,
                    instance,
                    chainConfig.chainName,
                    data.blockNumber,
                    logger,
                );
            }

            metricFailure.labels(chainConfig.skipMetricKey).set(0);
        } catch (e) {
            logger.error(e);
            metricFailure.labels(chainConfig.skipMetricKey).set(1);
        }
    }

    // BTC-specific: fee tracking
    if (!context.config.skipMetrics.includes('cf_bitcoin_elections')) {
        try {
            const chainState = (await api.query.bitcoinChainTracking.currentChainState()).toJSON();
            metricBtcFees.set(Number(chainState.trackedData.btcFeeInfo.satsPerKilobyte));
        } catch (e) {
            logger.error(e);
        }
    }
};
