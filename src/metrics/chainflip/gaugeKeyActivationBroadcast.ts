import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricKeyBroadcastName: string = 'cf_key_activation_broadcast';
const metricKeyBroadcast: Gauge = new promClient.Gauge({
    name: metricKeyBroadcastName,
    help: 'The broadcastId of the activatingKey transaction',
    labelNames: ['external_chain'],
    registers: [],
});

let deleted = false;

export const gaugeKeyActivationBroadcast = async (
    context: Context,
    data: ProtocolData,
): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_key_activation_broadcast')) {
        return;
    }
    const { logger, registry } = context;
    logger.debug(`Scraping ${metricKeyBroadcastName}`);

    if (registry.getSingleMetric(metricKeyBroadcastName) === undefined)
        registry.registerMetric(metricKeyBroadcast);

    // Arbitrum
    const arbitrumBroadcastId = data.data.activating_key_broadcast_ids.arbitrum;
    if (arbitrumBroadcastId == null) {
        metricKeyBroadcast.labels('arbitrum').set(0);
    } else {
        metricKeyBroadcast.labels('arbitrum').set(arbitrumBroadcastId);
    }

    // Ethereum
    const ethereumBroadcastId = data.data.activating_key_broadcast_ids.ethereum;
    if (ethereumBroadcastId == null) {
        metricKeyBroadcast.labels('ethereum').set(0);
    } else {
        metricKeyBroadcast.labels('ethereum').set(ethereumBroadcastId);
    }

    // Bitcoin
    const bitcoinBroadcastId = data.data.activating_key_broadcast_ids.bitcoin;
    if (bitcoinBroadcastId == null) {
        metricKeyBroadcast.labels('bitcoin').set(0);
    } else {
        metricKeyBroadcast.labels('bitcoin').set(bitcoinBroadcastId);
    }

    // AssetHub
    const assetHubBroadcastId = data.data.activating_key_broadcast_ids.assethub;
    if (assetHubBroadcastId == null) {
        metricKeyBroadcast.labels('assethub').set(0);
    } else {
        metricKeyBroadcast.labels('assethub').set(assetHubBroadcastId);
    }

    // Solana
    // solana transaction are witnessed as succefull even if they revert!! We should also check that the signature contained in broadcast success
    // didn't revert on-chain
    const solanaBroadcastInfo = data.data.activating_key_broadcast_ids.solana;
    if (solanaBroadcastInfo[0] == null || solanaBroadcastInfo[1] == null) {
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
