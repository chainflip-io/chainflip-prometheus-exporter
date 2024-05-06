import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'cf_dot_block_time';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Polkadot block time in ms through the chainflip blockchain',
    registers: [],
});

const metricNameError: string = 'cf_dot_not_updating';
const metricError: Gauge = new promClient.Gauge({
    name: metricNameError,
    help: 'Polkadot block height not updating',
    registers: [],
});

let previousBlock: number = 0;
let previousTimestamp: number = 0;

export const gaugeDotBlockTime = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricNameError) === undefined)
        registry.registerMetric(metricError);

    metricFailure.labels({ metric: metricName }).set(0);
    metricFailure.labels({ metric: metricNameError }).set(0);
    try {
        const timestamp: number = Number(await api.query.timestamp.now());
        const currentChainState: any = (
            await api.query.polkadotChainTracking.currentChainState()
        ).toJSON();
        if (currentChainState) {
            const currentDotBlock: number = currentChainState.blockHeight;
            if (previousTimestamp === 0) {
                previousTimestamp = Number(timestamp);
            }
            if (previousBlock === 0) {
                previousBlock = Number(currentDotBlock);
            }

            let metricValue: number = 0;

            if (previousTimestamp !== 0 && previousBlock !== 0) {
                if (previousBlock !== currentDotBlock) {
                    metricValue =
                        (timestamp - previousTimestamp) / (currentDotBlock - previousBlock);
                    previousBlock = currentDotBlock;
                    previousTimestamp = Number(timestamp);
                    metric.set(metricValue);
                    metricError.set(0);
                } else {
                    metricError.set(1);
                }
            }
        }
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
        metricFailure.labels({ metric: metricNameError }).set(1);
    }
};
