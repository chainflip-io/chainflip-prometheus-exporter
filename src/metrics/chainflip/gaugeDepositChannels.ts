import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { FlipConfig } from '../../config/interfaces';

const metricName: string = 'cf_open_deposit_channels';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The number of open deposit channels',
    labelNames: ["deposit_chain"],
    registers: [],
});

export const gaugeDepositChannels = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);
    const config = context.config as FlipConfig;
    const { accounts } = config;

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metricFailure.labels({ metric: metricName }).set(0);

    try {
        // BITCOIN CHANNELS
        if (global.btcHeight) {
            const channels = await api.query.bitcoinIngressEgress.depositChannelLookup.entries();
            let numberOfChannels = 0;
            channels.forEach(([key, element]: [any, any]) => {
                let channel = element.toJSON();
                if (channel.expiresAt >= global.btcHeight) {
                    numberOfChannels++;
                }
            });
            metric.labels("bitcoin").set(numberOfChannels);
        }

        // The API is not able to correctly decode polkadot and ethereum IngressEgress depositChannelLookup
        // ETHEREUM CHANNELS
        // if (global.ethHeight) {
        //     const channels = await api.query.ethereumIngressEgress.depositChannelLookup.entries();
        //     let numberOfChannels = 0;
        //     channels.forEach(([key, element]: [any, any]) => {
        //         let channel = element.toJSON();
        //         console.log(channel)
        //         console.log("\n\n");
        //         if (channel.expiresAt >= global.ethHeight) {
        //             numberOfChannels++;
        //         }
        //         // totalRedemptionBalance += parseFloat(element.toHuman().total.replace(/,/g, '')) / 1e18;
        //     });
        //     console.log(numberOfChannels);
        //     metric.labels("ethereum").set(numberOfChannels);
        // }

        // POLKADOT CHANNELS
        // if (global.dotHeight) {
        //     const channels = await api.query.polkadotIngressEgress.depositChannelLookup.entries();
        //     let numberOfChannels = 0;
        //     channels.forEach(([key, element]: [any, any]) => {
        //         let channel = element.toJSON();
        //         console.log(channel)
        //         console.log("\n\n");
        //         if (channel.expiresAt >= global.dotHeight) {
        //             numberOfChannels++;
        //         }
        //         // totalRedemptionBalance += parseFloat(element.toHuman().total.replace(/,/g, '')) / 1e18;
        //     });
        //     console.log(numberOfChannels);
        //     metric.labels("polkadot").set(numberOfChannels);
        // }

    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
