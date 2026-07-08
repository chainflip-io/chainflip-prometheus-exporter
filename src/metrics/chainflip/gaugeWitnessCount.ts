import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { hex2bin, insertOrReplace, logStructureSize, ProtocolData } from '../../utils/utils';
import makeRpcRequest from '../../utils/makeRpcRequest';

const witnessExtrinsicHash10 = new Map<number, Set<string>>();

const metricName: string = 'cf_witness_count';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Number of validator witnessing an extrinsic',
    labelNames: ['extrinsic', 'marginBlocks'],
    registers: [],
});

export const gaugeWitnessCount = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_witness_count')) {
        return;
    }
    if (global.epochIndex) {
        const { logger, apiLatest, registry, metricFailure, header } = context;
        logger.debug('scraping', { metric: metricName, blockNumber: data.blockNumber });

        try {
            if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

            const signedBlock = data.signedBlock;
            const currentBlockNumber = data.blockNumber;
            logStructureSize(
                logger,
                'witnessCount.witnessExtrinsicHash10',
                witnessExtrinsicHash10.size,
                currentBlockNumber,
                { everyBlocks: 50 },
            );
            await processHash10(
                currentBlockNumber,
                apiLatest,
                logger,
                data.blockHash,
                data.blockApi,
            );
            // chech the witnessAtEpoch extrinsics in a block and save the encoded callHash to check later
            signedBlock.block.extrinsics.forEach((ex: any, index: any) => {
                if (ex.toHuman().method.method === 'witnessAtEpoch') {
                    const callData = ex.toHuman().method.args.call;
                    if (callData.method !== 'updateChainState') {
                        const hashToCheck = ex.method.args[0].hash.toHex();
                        insertOrReplace(
                            witnessExtrinsicHash10,
                            JSON.stringify({
                                type: `${callData.section}:${callData.method}`,
                                hash: hashToCheck,
                            }),
                            currentBlockNumber,
                            ``,
                        );
                    }
                }
            });
            metricFailure.labels({ metric: metricName }).set(0);
        } catch (err) {
            logger.error(err);
            metricFailure.labels({ metric: metricName }).set(1);
        }
    }
};

async function processHash10(
    currentBlockNumber: number,
    apiLatest: any,
    logger: any,
    blockHash: string,
    blockApi: any,
) {
    for (const [blockNumber, set] of witnessExtrinsicHash10) {
        if (currentBlockNumber - blockNumber > 10) {
            const tmpSet = new Set(set);
            witnessExtrinsicHash10.delete(blockNumber);
            for (const hash of tmpSet) {
                const parsedObj = JSON.parse(hash);
                const [result, total] = await countWitnesses(
                    parsedObj,
                    currentBlockNumber,
                    apiLatest,
                    blockHash,
                    blockApi,
                );
                if (total > 0) {
                    metric.labels(parsedObj.type, '10').set(total);
                }
                // log the hash if not all the validator witnessed it so we can quickly look up the hash and check which validator failed to do so
                if (result && total > 0) log(total, result, blockNumber, parsedObj, logger);
            }
        }
    }
}

async function countWitnesses(
    parsedObj: any,
    currentBlockNumber: number,
    apiLatest: any,
    blockHash: string,
    blockApi: any,
) {
    const result: any = await makeRpcRequest(
        apiLatest,
        'witness_count',
        parsedObj.hash,
        undefined,
        blockHash,
    );
    let total = global.currentAuthorities;
    if (global.currentBlock === currentBlockNumber && result) {
        total = global.currentAuthorities - result.failing_count;
        // check the previous epoch as well! could be a false positive after rotation!
        if (total < global.currentAuthorities * 0.1) {
            const previousEpochVote = (
                await blockApi.query.witnesser.votes(global.epochIndex - 1, parsedObj.hash)
            )?.toJSON();
            if (previousEpochVote) {
                total += hex2bin(previousEpochVote).match(/1/g)?.length || 0;
            }
        }
    } else {
        return [result, -1];
    }
    return [result, total];
}

function log(total: number, result: any, blockNumber: number, parsedObj: any, logger: any) {
    if (total < global.currentAuthorities) {
        const validators: string[] = [];
        result.validators.forEach(([ss58address, vanity, witness]: [string, string, boolean]) => {
            if (!witness) {
                validators.push(ss58address);
            }
        });
        logger.info(
            `Block ${blockNumber}: ${parsedObj.type} hash ${parsedObj.hash} witnessed by ${total} validators after 10 blocks!
            Failing validators: [${validators}]`,
        );
    }
}
