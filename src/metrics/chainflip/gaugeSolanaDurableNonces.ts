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
    const { logger, api, registry } = context;
    logger.debug(`Scraping ${metricSolanaNoncesName}`);

    if (registry.getSingleMetric(metricSolanaNoncesName) === undefined)
        registry.registerMetric(metricSolanaNonces);
    if (registry.getSingleMetric(metricSolanaUnavailableNoncesName) === undefined)
        registry.registerMetric(metricSolanaUnavailableNonces);

    try {
        const availableNonces = await api.query.environment.solanaAvailableNonceAccounts();
        const unavailableNonces =
            await api.query.environment.solanaUnavailableNonceAccounts.entries();

        metricSolanaNonces.set(availableNonces.length);
        const nonces: SolanaNonce[] = [];
        availableNonces.forEach(([address, nonce]: [any, any]) => {
            const addressBase58 = base58.encode(hexToU8a(address.toJSON()));
            const nonceBase58 = base58.encode(hexToU8a(nonce.toJSON()));
            metricSolanaUnavailableNonces.labels(address.toJSON(), addressBase58).set(0);

            nonces.push({
                address: address.toJSON(),
                nonce: nonce.toJSON(),
                base58address: addressBase58,
                base58nonce: nonceBase58,
            });
        });
        global.availableSolanaNonces = nonces;

        unavailableNonces.forEach(([address, blockHash]: [any, any]) => {
            // polka js is broken, toU8a and toJSON don't work as expected, same state-chain type is decoded differently
            // hence we have to use toHuman()
            const addressBase58 = base58.encode(hexToU8a(address.toHuman()[0]));
            metricSolanaUnavailableNonces.labels(address.toHuman()[0], addressBase58).set(1);
        });
    } catch (e: any) {
        logger.error(e);
    }
};
