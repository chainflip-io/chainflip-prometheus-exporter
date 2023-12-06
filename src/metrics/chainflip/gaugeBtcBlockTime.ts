import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'cf_btc_block_time';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Bitcoin block time in ms through the chainflip blockchain',
    registers: [],
});

const metricNameError: string = 'cf_btc_not_updating';
const metricError: Gauge = new promClient.Gauge({
    name: metricNameError,
    help: 'Bitcoin block height not updating',
    registers: [],
});

let previousBlock: number = 0;
let previousTimestamp: number = 0;
// Btc block time in ms, used to be sure to update every 10m and not more frequently
// Used 1500000 to keep a bit of margin, 600s real blocktime (sometimes btc block can take up to 20min)
const btcBlockTime: number = 1500000;

export const gaugeBtcBlockTime = async (context: Context): Promise<void> => {
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
            await api.query.bitcoinChainTracking.currentChainState()
        ).toHuman();
        if (currentChainState) {
            const currentBtcBlock: number = currentChainState.blockHeight.replace(/,/g, '');
            if (previousTimestamp === 0) {
                previousTimestamp = Number(timestamp);
            }
            if (previousBlock === 0) {
                previousBlock = Number(currentBtcBlock);
            }

            let metricValue: number = 0;

            if (previousTimestamp !== 0 && previousBlock !== 0) {
                if (previousBlock !== currentBtcBlock) {
                    metricValue =
                        (timestamp - previousTimestamp) / (currentBtcBlock - previousBlock);
                    previousBlock = currentBtcBlock;
                    previousTimestamp = Number(timestamp);
                    metric.set(metricValue);
                    metricError.set(0);
                } else if (Number(timestamp) - previousTimestamp > btcBlockTime) {
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
