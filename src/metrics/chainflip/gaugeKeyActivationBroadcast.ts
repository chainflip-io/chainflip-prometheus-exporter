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
    const { logger, registry } = context;
    logger.debug(`Scraping ${metricKeyBroadcastName}`);

    if (registry.getSingleMetric(metricKeyBroadcastName) === undefined)
        registry.registerMetric(metricKeyBroadcast);

    // Arbitrum
    const arbitrumBroadcastId = context.data.activating_key_broadcast_ids.arbitrum;
    if (arbitrumBroadcastId === null) {
        metricKeyBroadcast.labels('arbitrum').set(0);
    } else {
        metricKeyBroadcast.labels('arbitrum').set(arbitrumBroadcastId);
    }

    // Ethereum
    const ethereumBroadcastId = context.data.activating_key_broadcast_ids.ethereum;
    if (ethereumBroadcastId === null) {
        metricKeyBroadcast.labels('ethereum').set(0);
    } else {
        metricKeyBroadcast.labels('ethereum').set(ethereumBroadcastId);
    }

    // Bitcoin
    const bitcoinBroadcastId = context.data.activating_key_broadcast_ids.bitcoin;
    if (bitcoinBroadcastId === null) {
        metricKeyBroadcast.labels('bitcoin').set(0);
    } else {
        metricKeyBroadcast.labels('bitcoin').set(bitcoinBroadcastId);
    }

    // Polkadot
    const polkadotBroadcastId = context.data.activating_key_broadcast_ids.polkadot;
    if (polkadotBroadcastId === null) {
        metricKeyBroadcast.labels('polkadot').set(0);
    } else {
        metricKeyBroadcast.labels('polkadot').set(polkadotBroadcastId);
    }

    // Solana
    // solana transaction are witnessed as succefull even if they revert!! We should also check that the signature contained in broadcast success
    // didn't revert on-chain
    const solanaBroadcastInfo = context.data.activating_key_broadcast_ids.solana;
    if (solanaBroadcastInfo[0] === null) {
        metricKeyBroadcast.labels('solana').set(0);
        if (global.solanaRotationTx && !deleted) {
            setTimeout(() => {
                global.solanaRotationTx = '';
                deleted = false;
            }, 60000); // 60s
            deleted = true;
        }
    } else {
        metricKeyBroadcast.labels('solana').set(solanaBroadcastInfo[0]);
        global.solanaRotationTx = solanaBroadcastInfo[1];
    }
};
