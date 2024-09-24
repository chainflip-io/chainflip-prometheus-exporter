import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { PublicKey, NonceAccount } from '@solana/web3.js';

const metricAvailableNoncesMatchingName: string = 'sol_available_nonce_not_matching';
const metricAvailableNoncesMatching: Gauge = new promClient.Gauge({
    name: metricAvailableNoncesMatchingName,
    help: 'If a durable nonce account contain the same nonce both on the state-chain and on solana',
    registers: [],
    labelNames: ['address', 'base58Address'],
});

export const gaugeSolNonces = async (context: Context) => {
    if (context.config.skipMetrics.includes('sol_nonces')) {
        return;
    }
    const { logger, registry, connection, metricFailure, config } = context;

    logger.debug(`Scraping ${metricAvailableNoncesMatchingName}`);

    if (registry.getSingleMetric(metricAvailableNoncesMatchingName) === undefined)
        registry.registerMetric(metricAvailableNoncesMatching);

    metricFailure.labels({ metric: metricAvailableNoncesMatchingName }).set(0);

    try {
        if (global.availableSolanaNonces) {
            const accounts = global.availableSolanaNonces.map(
                (elem) => new PublicKey(elem.base58address),
            );
            const accountsInfo = await connection.getMultipleAccountsInfo(accounts);

            for (let i = 0; i < accounts.length; i++) {
                if (!accountsInfo[i]) {
                    continue;
                }
                if (
                    global.availableSolanaNonces[i].base58nonce !==
                    NonceAccount.fromAccountData(accountsInfo[i].data).nonce
                ) {
                    metricAvailableNoncesMatching
                        .labels(
                            global.availableSolanaNonces[i].address,
                            global.availableSolanaNonces[i].base58address,
                        )
                        .set(1);
                } else {
                    metricAvailableNoncesMatching
                        .labels(
                            global.availableSolanaNonces[i].address,
                            global.availableSolanaNonces[i].base58address,
                        )
                        .set(0);
                }
            }
        }
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricAvailableNoncesMatchingName }).set(1);
    }
};
