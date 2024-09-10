import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import base58 from 'bs58';
import { hexToU8a } from '@polkadot/util';

const metricKeyBroadcastName: string = 'cf_key_activation_broadcast';
const metricKeyBroadcast: Gauge = new promClient.Gauge({
    name: metricKeyBroadcastName,
    help: 'The broadcastId of the activatingKey transaction',
    labelNames: ['external_chain'],
    registers: [],
});

let deleted = false;

export const gaugeKeyActivationBroadcast = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_key_activation_broadcast')) {
        return;
    }
    const { logger, api, registry } = context;
    logger.debug(`Scraping ${metricKeyBroadcastName}`);

    if (registry.getSingleMetric(metricKeyBroadcastName) === undefined)
        registry.registerMetric(metricKeyBroadcast);

    try {
        // Arbitrum
        const arbitrumBroadcastId = (
            await api.query.arbitrumBroadcaster.incomingKeyAndBroadcastId()
        ).toJSON();
        if (arbitrumBroadcastId === null) {
            metricKeyBroadcast.labels('arbitrum').set(0);
        } else {
            metricKeyBroadcast.labels('arbitrum').set(arbitrumBroadcastId[1]);
        }

        // Ethereum
        const ethereumBroadcastId = (
            await api.query.ethereumBroadcaster.incomingKeyAndBroadcastId()
        ).toJSON();
        if (ethereumBroadcastId === null) {
            metricKeyBroadcast.labels('ethereum').set(0);
        } else {
            metricKeyBroadcast.labels('ethereum').set(ethereumBroadcastId[1]);
        }

        // Bitcoin
        const bitcoinBroadcastId = (
            await api.query.bitcoinBroadcaster.incomingKeyAndBroadcastId()
        ).toJSON();
        if (bitcoinBroadcastId === null) {
            metricKeyBroadcast.labels('bitcoin').set(0);
        } else {
            metricKeyBroadcast.labels('bitcoin').set(bitcoinBroadcastId[1]);
        }

        // Polkadot
        const polkadotBroadcastId = (
            await api.query.polkadotBroadcaster.incomingKeyAndBroadcastId()
        ).toJSON();
        if (polkadotBroadcastId === null) {
            metricKeyBroadcast.labels('polkadot').set(0);
        } else {
            metricKeyBroadcast.labels('polkadot').set(polkadotBroadcastId[1]);
        }

        // Solana
        // solana transaction are witnessed as succefull even if they revert!! We should also check that the signature contained in broadcast success
        // didn't revert on-chain
        const solanaBroadcastId = (
            await api.query.solanaBroadcaster.incomingKeyAndBroadcastId()
        ).toJSON();
        if (solanaBroadcastId === null) {
            metricKeyBroadcast.labels('solana').set(0);
            if (global.solanaRotationTx && !deleted) {
                setTimeout(() => {
                    global.solanaRotationTx = '';
                    deleted = false;
                }, 60000); // 60s
                deleted = true;
            }
        } else {
            metricKeyBroadcast.labels('solana').set(solanaBroadcastId[1]);
            const broadcastData = (
                await api.query.solanaBroadcaster.awaitingBroadcast(solanaBroadcastId[1])
            ).toJSON();
            if (broadcastData !== null) {
                global.solanaRotationTx = base58.encode(hexToU8a(broadcastData.transactionOutId));
            }
        }
    } catch (e: any) {
        logger.error(e);
    }
};
