import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import base58 from 'bs58';
import { SolanaNonce } from '../../utils/utils';
import { hexToU8a } from '@polkadot/util';

const metricSolanaNoncesName: string = 'cf_solana_available_nonces_count';
const metricSolanaNonces: Gauge = new promClient.Gauge({
    name: metricSolanaNoncesName,
    help: 'The number of available nonces',
    registers: [],
});

const metricSolanaUnavailableNoncesName: string = 'cf_solana_unavailable_nonces';
const metricSolanaUnavailableNonces: Gauge = new promClient.Gauge({
    name: metricSolanaUnavailableNoncesName,
    help: 'If a nonce is unavailable',
    registers: [],
    labelNames: ['address', 'base58Address'],
});

export const gaugeSolanaNonces = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_solana_nonces')) {
        return;
    }
    const { logger, registry } = context;
    logger.debug(`Scraping ${metricSolanaNoncesName}`);

    if (registry.getSingleMetric(metricSolanaNoncesName) === undefined)
        registry.registerMetric(metricSolanaNonces);
    if (registry.getSingleMetric(metricSolanaUnavailableNoncesName) === undefined)
        registry.registerMetric(metricSolanaUnavailableNonces);

    const availableNonces = context.data.sol_nonces.available;
    const unavailableNonces = context.data.sol_nonces.unavailable;

    metricSolanaNonces.set(availableNonces.length);
    const nonces: SolanaNonce[] = [];
    availableNonces.forEach(([addressBase58, nonceBase58]: [string, string]) => {
        const address = '0x' + Buffer.from(base58.decode(addressBase58)).toString('hex');
        const nonce = '0x' + Buffer.from(base58.decode(nonceBase58)).toString('hex');
        metricSolanaUnavailableNonces.labels(address, addressBase58).set(0);

        nonces.push({
            address,
            nonce,
            base58address: addressBase58,
            base58nonce: nonceBase58,
        });
    });
    global.availableSolanaNonces = nonces;

    unavailableNonces.forEach(([addressBase58, blockHash]: [string, string]) => {
        const address = '0x' + Buffer.from(base58.decode(addressBase58)).toString('hex');
        metricSolanaUnavailableNonces.labels(address, addressBase58).set(1);
    });
};
