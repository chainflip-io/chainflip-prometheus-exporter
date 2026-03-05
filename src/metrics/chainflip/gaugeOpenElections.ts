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
];

export const gaugeOpenElections = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_open_elections')) {
        return;
    }
    const { logger, registry, metricFailure } = context;

    logger.debug(`Scraping ${metricNameOpenElection}`);

    if (registry.getSingleMetric(metricNameOpenElection) === undefined)
        registry.registerMetric(metricOpenElection);

    metricFailure.labels({ metric: metricNameOpenElection }).set(0);

    try {
        const api = data.blockApi;

        for (const chainConfig of CHAIN_CONFIGS) {
            const counts: Record<string, number> = {};
            for (const key of chainConfig.electoralSystems.keys()) {
                counts[key] = 0;
            }

            const result = await api.query[chainConfig.palletName].electionProperties.entries();
            result.forEach(([_, election_properties]: any[]) => {
                const value = election_properties.toJSON();
                if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                    const electoral_system = Object.keys(value)[0].toUpperCase();
                    if (electoral_system in counts) {
                        counts[electoral_system] = counts[electoral_system] + 1;
                    }
                } else if (value !== null) {
                    const key = value.toUpperCase();
                    if (key in counts) {
                        counts[key] = counts[key] + 1;
                    }
                }
            });

            for (const [key, count] of Object.entries(counts)) {
                const full_name = chainConfig.electoralSystems.get(key) as string;
                metricOpenElection
                    .labels(chainConfig.chainName, key.concat('_', full_name))
                    .set(count);
            }
        }
    } catch (e) {
        metricFailure.labels({ metric: metricNameOpenElection }).set(1);
    }
};
