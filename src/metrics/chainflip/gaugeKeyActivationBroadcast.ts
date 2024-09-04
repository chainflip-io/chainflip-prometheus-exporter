import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricKeyBroadcastName: string = 'cf_key_activation_broadcast';
const metricKeyBroadcast: Gauge = new promClient.Gauge({
    name: metricKeyBroadcastName,
    help: 'The current price delta from the given token and amount to USDC',
    labelNames: ['external_chain'],
    registers: [],
});

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
        const solanaBroadcastId = (
            await api.query.solanaBroadcaster.incomingKeyAndBroadcastId()
        ).toJSON();
        if (solanaBroadcastId === null) {
            metricKeyBroadcast.labels('solana').set(0);
        } else {
            metricKeyBroadcast.labels('solana').set(solanaBroadcastId[1]);
        }
    } catch (e: any) {
        logger.error(e);
    }
};
