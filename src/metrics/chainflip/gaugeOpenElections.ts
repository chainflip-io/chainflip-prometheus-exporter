import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricNameOpenElection: string = 'cf_open_elections';
const metricOpenElection: Gauge = new promClient.Gauge({
    name: metricNameOpenElection,
    help: 'The number of open elections',
    labelNames: ['for_chain', 'electoral_system'],
    registers: [],
});

type ChainElectionOpenConfig = {
    chainName: string;
    palletName: string;
    electoralSystems: Map<string, string>;
};

const CHAIN_CONFIGS: ChainElectionOpenConfig[] = [
    {
        chainName: 'solana',
        palletName: 'solanaElections',
        electoralSystems: new Map([
            ['A', 'SolanaBlockHeightTracking'],
            ['B', 'SolanaIngressTracking'],
            ['C', 'SolanaNonceTracking'],
            ['D', 'SolanaEgressWitnessing'],
            ['EE', 'SolanaLiveness'],
            ['FF', 'SolanaVaultSwapTracking'],
            ['G', 'SolanaAltWitnessing'],
        ]),
    },
    {
        chainName: 'bitcoin',
        palletName: 'bitcoinElections',
        electoralSystems: new Map([
            ['A', 'BitcoinBlockHeightWitnesser'],
            ['B', 'BitcoinDepositChannelWitnessing'],
            ['C', 'BitcoinVaultDepositWitnessing'],
            ['D', 'BitcoinEgressWitnessing'],
            ['EE', 'BitcoinFeeTracking'],
            ['FF', 'BitcoinLiveness'],
        ]),
    },
    {
        chainName: 'ethereum',
        palletName: 'ethereumElections',
        electoralSystems: new Map([
            ['A', 'EthereumBlockHeightWitnesser'],
            ['B', 'EthereumDepositChannelWitnessing'],
            ['C', 'EthereumVaultDepositWitnessing'],
            ['D', 'EthereumKeyManagerWitnessing'],
            ['EE', 'EthereumFeeTracking'],
            ['FF', 'EthereumLiveness'],
            ['G', 'EthereumStateChainGatewayWitnessing'],
            ['HH', 'EthereumScUtilsWitnessing'],
        ]),
    },
    {
        chainName: 'arbitrum',
        palletName: 'arbitrumElections',
        electoralSystems: new Map([
            ['A', 'ArbitrumBlockHeightWitnesser'],
            ['B', 'ArbitrumDepositChannelWitnessing'],
            ['C', 'ArbitrumVaultDepositWitnessing'],
            ['D', 'ArbitrumKeyManagerWitnessing'],
            ['EE', 'ArbitrumFeeTracking'],
            ['FF', 'ArbitrumLiveness'],
        ]),
    },
    {
        chainName: 'tron',
        palletName: 'tronElections',
        electoralSystems: new Map([
            ['A', 'TronBlockHeightWitnesser'],
            ['B', 'TronDepositChannelWitnessing'],
            ['C', 'TronVaultDepositWitnessing'],
            ['D', 'TronKeyManagerWitnessing'],
            ['EE', 'TronLiveness'],
        ]),
    },
    {
        chainName: 'assethub',
        palletName: 'assethubElections',
        electoralSystems: new Map([
            ['A', 'AssethubBlockHeightWitnesser'],
            ['B', 'AssethubDepositChannelWitnessing'],
            ['C', 'AssethubEgressWitnessing'],
            ['D', 'AssethubFeeTracking'],
            ['EE', 'AssethubLiveness'],
        ]),
    },
    {
        chainName: 'bsc',
        palletName: 'bscElections',
        electoralSystems: new Map([
            ['A', 'BscBlockHeightWitnesser'],
            ['B', 'BscDepositChannelWitnessing'],
            ['C', 'BscVaultDepositWitnessing'],
            ['D', 'BscKeyManagerWitnessing'],
            ['EE', 'BscFeeTracking'],
            ['FF', 'BscLiveness'],
        ]),
    },
];

export const gaugeOpenElections = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_open_elections')) {
        return;
    }
    const { logger, registry, metricFailure } = context;

    logger.debug('scraping', { metric: metricNameOpenElection, blockNumber: data.blockNumber });

    try {
        if (registry.getSingleMetric(metricNameOpenElection) === undefined)
            registry.registerMetric(metricOpenElection);

        const api = data.blockApi;

        for (const chainConfig of CHAIN_CONFIGS) {
            const counts: Record<string, number> = {};
            for (const key of chainConfig.electoralSystems.keys()) {
                counts[key] = 0;
            }

            const keys = await api.query[chainConfig.palletName].electionProperties.keys();
            keys.forEach((storageKey: any) => {
                const identifier = storageKey.args[0].toJSON() as any[];
                let tag: any = identifier[1];
                if (tag && typeof tag === 'object') tag = Object.keys(tag)[0];
                const electoral_system = String(tag).toUpperCase();
                if (electoral_system in counts) {
                    counts[electoral_system] += 1;
                }
            });

            for (const [key, count] of Object.entries(counts)) {
                const full_name = chainConfig.electoralSystems.get(key) as string;
                metricOpenElection
                    .labels(chainConfig.chainName, key.concat('_', full_name))
                    .set(count);
            }
        }
        metricFailure.labels({ metric: metricNameOpenElection }).set(0);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricNameOpenElection }).set(1);
    }
};
