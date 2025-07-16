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

const mapSolana = new Map([
    ['A', 'SolanaBlockHeightTracking'],
    ['B', 'SolanaIngressTracking'],
    ['C', 'SolanaNonceTracking'],
    ['D', 'SolanaEgressWitnessing'],
    ['EE', 'SolanaLiveness'],
    ['FF', 'SolanaVaultSwapTracking'],
    ['G', 'SolanaAltWitnessing'],
]);

const mapBitcoin = new Map([
    ['A', 'BitcoinBlockHeightWitnesserES'],
    ['B', 'BitcoinDepositChannelWitnessingES'],
    ['C', 'BitcoinVaultDepositWitnessingES'],
    ['D', 'BitcoinEgressWitnessingES'],
    ['EE', 'BitcoinFeeTracking'],
    ['FF', 'BitcoinLiveness'],
]);

type election_count_sol = {
    A: number;
    B: number;
    C: number;
    D: number;
    EE: number;
    FF: number;
    G: number;
};
type election_count_btc = {
    A: number;
    B: number;
    C: number;
    D: number;
    EE: number;
    FF: number;
};
export const gaugeOpenElections = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_open_elections')) {
        return;
    }
    const { logger, apiLatest, registry, metricFailure } = context;

    logger.debug(`Scraping ${metricNameOpenElection}`);

    if (registry.getSingleMetric(metricNameOpenElection) === undefined)
        registry.registerMetric(metricOpenElection);

    metricFailure.labels({ metric: metricNameOpenElection }).set(0);
    const countSolana: election_count_sol = {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        EE: 0,
        FF: 0,
        G: 0,
    };
    const countBitcoin: election_count_btc = {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        EE: 0,
        FF: 0,
    };
    try {
        const api = await apiLatest.at(data.blockHash);
        const result = await api.query.solanaElections.electionProperties.entries();
        result.forEach(([_, election_properties]: any[]) => {
            const value = election_properties.toJSON();
            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                const electoral_system = Object.keys(
                    value,
                )[0].toUpperCase() as keyof election_count_sol;
                countSolana[electoral_system] = countSolana[electoral_system] + 1;
            } else if (value !== null) {
                countSolana[value.toUpperCase() as keyof election_count_sol] =
                    countSolana[value.toUpperCase() as keyof election_count_sol] + 1;
            }
        });

        for (const [key, value] of Object.entries(countSolana)) {
            const full_name = mapSolana.get(key) as string;
            metricOpenElection.labels('solana', key.concat('_', full_name)).set(value);
        }

        const result2 = await api.query.bitcoinElections.electionProperties.entries();
        result2.forEach(([_, election_properties]: any[]) => {
            const value = election_properties.toJSON();
            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                const electoral_system = Object.keys(
                    value,
                )[0].toUpperCase() as keyof election_count_btc;
                countBitcoin[electoral_system] = countBitcoin[electoral_system] + 1;
            } else if (value !== null) {
                countBitcoin[value.toUpperCase() as keyof election_count_btc] =
                    countBitcoin[value.toUpperCase() as keyof election_count_btc] + 1;
            }
        });

        for (const [key, value] of Object.entries(countBitcoin)) {
            const full_name = mapBitcoin.get(key) as string;
            metricOpenElection.labels('bitcoin', key.concat('_', full_name)).set(value);
        }
    } catch (e) {
        metricFailure.labels({ metric: metricNameOpenElection }).set(1);
    }
};
