import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricNameBlocksPerEpoch: string = 'cf_block_per_epoch';
const metricBlocksPerEpoch: Gauge = new promClient.Gauge({
    name: metricNameBlocksPerEpoch,
    help: 'Number of blocks between each epoch',
    registers: [],
});

const metricNameMAB: string = 'cf_min_active_bid';
const metricMAB: Gauge = new promClient.Gauge({
    name: metricNameMAB,
    help: 'the lowest winning bid',
    registers: [],
});

const metricNameEpochDuration: string = 'cf_current_epoch_duration_blocks';
const metricEpochDuration: Gauge = new promClient.Gauge({
    name: metricNameEpochDuration,
    help: 'How long has the current epoch lasted',
    registers: [],
});

const metricNameRotating: string = 'cf_rotating';
const metricRotating: Gauge = new promClient.Gauge({
    name: metricNameRotating,
    help: 'Is the Network in a rotation',
    registers: [],
});

export const gaugeEpoch = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_epoch')) {
        return;
    }
    const { logger, registry } = context;
    logger.debug(
        `Scraping ${metricNameBlocksPerEpoch}, ${metricNameMAB}, ${metricNameEpochDuration}`,
    );

    if (registry.getSingleMetric(metricNameBlocksPerEpoch) === undefined)
        registry.registerMetric(metricBlocksPerEpoch);
    if (registry.getSingleMetric(metricNameMAB) === undefined) registry.registerMetric(metricMAB);
    if (registry.getSingleMetric(metricNameEpochDuration) === undefined)
        registry.registerMetric(metricEpochDuration);
    if (registry.getSingleMetric(metricNameRotating) === undefined)
        registry.registerMetric(metricRotating);

    metricBlocksPerEpoch.set(data.data.epoch.blocks_per_epoch);

    const MAB: number = Number(Number(data.data.epoch.min_active_bid) / 10 ** 18);
    metricMAB.set(MAB);

    const currentEpochDurationBlocks: number =
        data.header - data.data.epoch.current_epoch_started_at;
    metricEpochDuration.set(currentEpochDurationBlocks);

    let metricValue: number;
    if (data.data.epoch.rotation_phase === 'Idle') {
        global.rotationInProgress = false;
        metricValue = 0;
    } else {
        global.rotationInProgress = true;
        metricValue = 1;
    }
    metricRotating.set(metricValue);
};
