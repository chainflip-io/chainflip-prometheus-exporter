import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { PublicKey, NonceAccount } from '@solana/web3.js';

const metricAvailableNoncesNotMatchingName: string = 'sol_available_nonce_not_matching';
const metricAvailableNoncesNotMatching: Gauge = new promClient.Gauge({
    name: metricAvailableNoncesNotMatchingName,
    help: 'If a durable nonce account on the state-chain contains a different nonce on solana',
    registers: [],
    labelNames: ['address', 'base58Address'],
});

export const gaugeSolNonces = async (context: Context) => {
    if (context.config.skipMetrics.includes('sol_nonces')) {
        return;
    }
    const { logger, registry, connection, metricFailure, config } = context;

    logger.debug(`Scraping ${metricAvailableNoncesNotMatchingName}`);

    if (registry.getSingleMetric(metricAvailableNoncesNotMatchingName) === undefined)
        registry.registerMetric(metricAvailableNoncesNotMatching);

    try {
        // only scrape the metric if we have some values for the nonces and also for the latest solana block height as seen from the state-chain
        if (global.availableSolanaNonces && global.solanaBlockHeight) {
            const accounts = global.availableSolanaNonces.map(
                (elem) => new PublicKey(elem.base58address),
            );
            // in case our solana node is behind we don't want the result, this can cause false positive otherwise
            const accountsInfo = await connection.getMultipleAccountsInfo(accounts, {
                minContextSlot: global.solanaBlockHeight,
            });

            for (let i = 0; i < accountsInfo?.length || 0; i++) {
                if (!accountsInfo[i]) {
                    continue;
                }
                if (
                    global.availableSolanaNonces[i].base58nonce !==
                    NonceAccount.fromAccountData(accountsInfo[i].data).nonce
                ) {
                    metricAvailableNoncesNotMatching
                        .labels(
                            global.availableSolanaNonces[i].address,
                            global.availableSolanaNonces[i].base58address,
                        )
                        .set(1);
                } else {
                    metricAvailableNoncesNotMatching
                        .labels(
                            global.availableSolanaNonces[i].address,
                            global.availableSolanaNonces[i].base58address,
                        )
                        .set(0);
                }
            }
        }
        metricFailure.labels({ metric: metricAvailableNoncesNotMatchingName }).set(0);
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricAvailableNoncesNotMatchingName }).set(1);
    }
};
