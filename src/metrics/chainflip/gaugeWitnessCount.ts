import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { hex2bin, insertOrReplace, ProtocolData } from '../../utils/utils';
import makeRpcRequest from '../../utils/makeRpcRequest';

const witnessExtrinsicHash10 = new Map<number, Set<string>>();
const witnessExtrinsicHash50 = new Map<number, Set<string>>();
const toDelete = new Map<string, number>();

const metricName: string = 'cf_witness_count';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Number of validator witnessing an extrinsic',
    labelNames: ['extrinsic', 'marginBlocks'],
    registers: [],
});

const metricFailureName: string = 'cf_witness_count_failure';
const metricWitnessFailure: Gauge = new promClient.Gauge({
    name: metricFailureName,
    help: 'If 1 the number of witnesses is low, you can find the failing validators in the label `failing_validators`',
    labelNames: ['extrinsic', 'failing_validators', 'witnessed_by'],
    registers: [],
});

export const gaugeWitnessCount = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_witness_count')) {
        return;
    }
    if (global.epochIndex) {
        const { logger, apiLatest, registry, metricFailure, header } = context;
        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
        if (registry.getSingleMetric(metricFailureName) === undefined)
            registry.registerMetric(metricWitnessFailure);

        try {
            const signedBlock = await apiLatest.rpc.chain.getBlock(data.blockHash);
            const currentBlockNumber = data.header;
            deleteOldHashes(currentBlockNumber);
            processHash10(currentBlockNumber, apiLatest, logger, data.blockHash);
            processHash50(currentBlockNumber, apiLatest, logger, data.blockHash);
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
                        insertOrReplace(
                            witnessExtrinsicHash50,
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

function deleteOldHashes(currentBlockNumber: number) {
    toDelete.forEach((block, labels) => {
        if (block <= currentBlockNumber) {
            const values = JSON.parse(labels);
            metricWitnessFailure.remove(values.extrinsic, values.validators, values.witnessedBy);
            toDelete.delete(labels);
        }
    });
}

async function processHash10(
    currentBlockNumber: number,
    apiLatest: any,
    logger: any,
    blockHash: string,
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
                );
                if (total > 0) {
                    metric.labels(parsedObj.type, '10').set(total);
                }
                // log the hash if not all the validator witnessed it so we can quickly look up the hash and check which validator failed to do so
                if (result && total > 0)
                    log(total, result, currentBlockNumber, blockNumber, parsedObj, logger);
            }
        }
    }
}

async function countWitnesses(
    parsedObj: any,
    currentBlockNumber: number,
    apiLatest: any,
    blockHash: string,
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
            const api = await apiLatest.at(blockHash);
            const previousEpochVote = (
                await api.query.witnesser.votes(global.epochIndex - 1, parsedObj.hash)
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

function log(
    total: number,
    result: any,
    currentBlockNumber: number,
    blockNumber: number,
    parsedObj: any,
    logger: any,
) {
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
        // in case less than 90% witnessed it
        // create a temporary metric so that we can fetch the list of validators in our alerting system
        if (total <= global.currentAuthorities * 0.9) {
            metricWitnessFailure.labels(`${parsedObj.type}`, `${validators}`, `${total}`).set(1);
            toDelete.set(
                JSON.stringify({
                    extrinsic: `${parsedObj.type}`,
                    validators: `${validators}`,
                    witnessedBy: `${total}`,
                }),
                currentBlockNumber + 100,
            );
        }
    }
}

async function processHash50(
    currentBlockNumber: number,
    apiLatest: any,
    logger: any,
    blockHash: string,
) {
    for (const [blockNumber, set] of witnessExtrinsicHash50) {
        if (currentBlockNumber - blockNumber > 50) {
            const tmpSet = new Set(set);
            witnessExtrinsicHash50.delete(blockNumber);
            for (const hash of tmpSet) {
                const parsedObj = JSON.parse(hash);
                const api = await apiLatest.at(blockHash);
                api.query.witnesser
                    .votes(global.epochIndex, parsedObj.hash)
                    .then((votes: { toJSON: () => any }) => {
                        if (global.currentBlock === currentBlockNumber) {
                            const vote = votes.toJSON();
                            if (vote) {
                                const binary = hex2bin(vote);
                                const number = binary.match(/1/g)?.length || 0;

                                metric.labels(parsedObj.type, '50').set(number);
                                // log the hash if not all the validator witnessed it so we can quickly look up the hash and check which validator failed to do so
                                if (number < global.currentAuthorities) {
                                    logger.info(
                                        `Block ${blockNumber}: ${parsedObj.type} hash ${parsedObj.hash} witnesssed by ${number} validators after 50 blocks!`,
                                    );
                                }
                            }
                        }
                    })
                    .catch((err: any) => {
                        logger.warn(`Promise rejected ${err}`);
                    });
            }
        }
    }
}
