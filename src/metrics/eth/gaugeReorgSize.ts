import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'eth_reorg_size';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Ethereum reorganization size in blocks',
    registers: [],
});

const lastBlocks: string[] = [];

export const gaugeReorgSize = async (context: Context) => {
    const { logger, registry, blockNumber, provider, env } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    let reorgSize = 0;
    const blockHash = (await provider.getBlock(blockNumber)).hash;
    if (lastBlocks.length < env.MAX_REORG_SIZE) {
        lastBlocks.push(blockHash);
    } else {
        for (let i = env.MAX_REORG_SIZE - 1; i--; i >= 0) {
            const oldBlockHash = (await provider.getBlock(blockNumber - (env.MAX_REORG_SIZE - i)))
                .hash;
            if (oldBlockHash === lastBlocks[i]) {
                lastBlocks.shift();
                lastBlocks.push(blockHash);
                break;
            } else {
                reorgSize++;
                lastBlocks[i] = oldBlockHash;
            }
        }
    }
    metric.set(reorgSize);
};
