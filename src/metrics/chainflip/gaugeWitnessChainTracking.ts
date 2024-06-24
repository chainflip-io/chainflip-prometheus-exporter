import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { blake2AsHex } from '@polkadot/util-crypto';
import { hex2bin, insertOrReplace } from '../../utils/utils';
import makeRpcRequest from '../../utils/makeRpcRequest';

const witnessHash10 = new Map<number, Set<string>>();
const witnessHash50 = new Map<number, Set<string>>();
const toDelete = new Map<string, number>();

const metricName: string = 'cf_chain_tracking_witness_count';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Number of validator witnessing ChainStateUpdated for an external chain',
    labelNames: ['extrinsic', 'marginBlocks'],
    registers: [],
});

const metricFailureName: string = 'cf_chain_tracking_witness_failure';
const metricWitnessFailure: Gauge = new promClient.Gauge({
    name: metricFailureName,
    help: 'If 1 the number of witnesses is low, you can find the failing validators in the label `failing_validators`',
    labelNames: ['extrinsic', 'failing_validators', 'witnessed_by'],
    registers: [],
});

export const gaugeWitnessChainTracking = async (context: Context): Promise<void> => {
    console.log(witnessHash10);
    console.log(witnessHash50);
    console.log(toDelete);
    console.log('\n');
    if (global.epochIndex) {
        const { logger, api, registry, metricFailure } = context;
        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
        if (registry.getSingleMetric(metricFailureName) === undefined)
            registry.registerMetric(metricWitnessFailure);
        metricFailure.labels({ metric: metricName }).set(0);
        try {
            const signedBlock = await api.rpc.chain.getBlock();
            const currentBlockNumber = Number(signedBlock.toJSON().block.header.number);
            global.currentBlock = currentBlockNumber;
            deleteOldHashes(currentBlockNumber);
            await processHash10(currentBlockNumber, api, logger);
            await processHash50(currentBlockNumber, api, logger);
            let btcBlock = 0;
            let ethBlock = 0;
            let dotBlock = 0;
            let arbBlock = 0;
            signedBlock.block.extrinsics.forEach((ex: any, index: any) => {
                const blockNumber: number = Number(signedBlock.block.header.number);
                if (ex.toHuman().method.method === 'witnessAtEpoch') {
                    const callData = ex.toHuman().method.args.call;

                    if (callData && callData.section === 'ethereumChainTracking') {
                        ethBlock = ethereumChainTracking(callData, blockNumber, ethBlock, api);
                    }
                    if (callData && callData.section === 'bitcoinChainTracking') {
                        btcBlock = bitcoinChainTracking(callData, blockNumber, btcBlock, api);
                    }
                    if (callData && callData.section === 'polkadotChainTracking') {
                        dotBlock = polkadotChainTracking(callData, blockNumber, dotBlock, api);
                    }
                    if (callData && callData.section === 'arbitrumChainTracking') {
                        arbBlock = arbitrumChainTracking(callData, blockNumber, arbBlock, api);
                    }
                }
            });
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

function ethereumChainTracking(
    callData: any,
    blockNumber: number,
    ethBlock: number,
    api: any,
): number {
    const finalData = callData.args;
    // set priorityFee to 0, it is not kept into account for the chaintracking
    finalData.new_chain_state.trackedData.priorityFee = '0';
    const blockHeight = finalData.new_chain_state.blockHeight.replace(/,/g, '');
    const baseFee = finalData.new_chain_state.trackedData.baseFee.replace(/,/g, '');
    // parse the data and removed useless comas (damn polkadot api)
    finalData.new_chain_state.trackedData.baseFee = baseFee;
    finalData.new_chain_state.blockHeight = blockHeight;
    // create the extrinsic we need to witness (ETH chain tracking in this case)
    const extrinsic = api.tx.ethereumChainTracking.updateChainState(finalData.new_chain_state);
    // obtain the hash of the extrinsic call
    const blakeHash = blake2AsHex(extrinsic.method.toU8a(), 256);
    if (Number(blockHeight) > ethBlock) {
        insertOrReplace(
            witnessHash10,
            JSON.stringify({
                type: `${callData.section}:${callData.method}`,
                hash: blakeHash,
            }),
            blockNumber,
            `${callData.section}:${callData.method}`,
        );
        insertOrReplace(
            witnessHash50,
            JSON.stringify({
                type: `${callData.section}:${callData.method}`,
                hash: blakeHash,
            }),
            blockNumber,
            `${callData.section}:${callData.method}`,
        );
        return Number(blockHeight || 0);
    }
    return ethBlock;
}

function polkadotChainTracking(
    callData: any,
    blockNumber: number,
    dotBlock: number,
    api: any,
): number {
    const finalData = callData.args;
    // set medianTip to 0, it is not kept into account for the chaintracking
    finalData.new_chain_state.trackedData.medianTip = '0';
    // parse the data and removed useless comas (damn polkadot api)
    const blockHeight = finalData.new_chain_state.blockHeight.replace(/,/g, '');
    const runtimeVersion = finalData.new_chain_state.trackedData.runtimeVersion.specVersion.replace(
        /,/g,
        '',
    );
    finalData.new_chain_state.trackedData.runtimeVersion.specVersion = runtimeVersion;
    finalData.new_chain_state.blockHeight = blockHeight;
    // create the extrinsic we need to witness (DOT chain tracking in this case)
    const extrinsic = api.tx.polkadotChainTracking.updateChainState(finalData.new_chain_state);
    // obtain the hash of the extrinsic call
    const blakeHash = blake2AsHex(extrinsic.method.toU8a(), 256);
    if (Number(blockHeight) > dotBlock) {
        insertOrReplace(
            witnessHash10,
            JSON.stringify({
                type: `${callData.section}:${callData.method}`,
                hash: blakeHash,
            }),
            blockNumber,
            `${callData.section}:${callData.method}`,
        );
        insertOrReplace(
            witnessHash50,
            JSON.stringify({
                type: `${callData.section}:${callData.method}`,
                hash: blakeHash,
            }),
            blockNumber,
            `${callData.section}:${callData.method}`,
        );
        return Number(blockHeight || 0);
    }
    return dotBlock;
}

function bitcoinChainTracking(
    callData: any,
    blockNumber: number,
    btcBlock: number,
    api: any,
): number {
    const finalData = callData.args;
    const blockHeight = finalData.new_chain_state.blockHeight.replace(/,/g, '');
    // parse the data and removed useless comas (damn polkadot api)
    finalData.new_chain_state.blockHeight = blockHeight;

    // set the default value for the fees (we use these values to witness)
    finalData.new_chain_state.trackedData.btcFeeInfo = {
        satsPerKilobyte: '100000',
    };

    // create the extrinsic we need to witness (ETH chain tracking in this case)
    const extrinsic = api.tx.bitcoinChainTracking.updateChainState(finalData.new_chain_state);

    // obtain the hash of the extrinsic call
    const blakeHash = blake2AsHex(extrinsic.method.toU8a(), 256);
    if (Number(blockHeight) > btcBlock) {
        insertOrReplace(
            witnessHash10,
            JSON.stringify({
                type: `${callData.section}:${callData.method}`,
                hash: blakeHash,
            }),
            blockNumber,
            `${callData.section}:${callData.method}`,
        );
        insertOrReplace(
            witnessHash50,
            JSON.stringify({
                type: `${callData.section}:${callData.method}`,
                hash: blakeHash,
            }),
            blockNumber,
            `${callData.section}:${callData.method}`,
        );
        return Number(blockHeight || 0);
    }
    return btcBlock;
}

function arbitrumChainTracking(
    callData: any,
    blockNumber: number,
    arbBlock: number,
    api: any,
): number {
    const finalData = callData.args;
    // set priorityFee to 0, it is not kept into account for the chaintracking
    finalData.new_chain_state.trackedData.priorityFee = '0';
    const blockHeight = finalData.new_chain_state.blockHeight.replace(/,/g, '');
    const baseFee = finalData.new_chain_state.trackedData.baseFee.replace(/,/g, '');
    // parse the data and removed useless comas (damn polkadot api)
    finalData.new_chain_state.trackedData = {
        // Use the floor value of 0.01 gwei for Arbitrum One
        baseFee: 10000000,
        gasLimitMultiplier: 1000000000,
    };
    finalData.new_chain_state.blockHeight = blockHeight;
    // create the extrinsic we need to witness (ETH chain tracking in this case)
    const extrinsic = api.tx.arbitrumChainTracking.updateChainState(finalData.new_chain_state);
    // obtain the hash of the extrinsic call
    const blakeHash = blake2AsHex(extrinsic.method.toU8a(), 256);
    if (Number(blockHeight) > arbBlock) {
        insertOrReplace(
            witnessHash10,
            JSON.stringify({
                type: `${callData.section}:${callData.method}`,
                hash: blakeHash,
            }),
            blockNumber,
            `${callData.section}:${callData.method}`,
        );
        insertOrReplace(
            witnessHash50,
            JSON.stringify({
                type: `${callData.section}:${callData.method}`,
                hash: blakeHash,
            }),
            blockNumber,
            `${callData.section}:${callData.method}`,
        );
        return Number(blockHeight || 0);
    }
    return arbBlock;
}

async function processHash10(currentBlockNumber: number, api: any, logger: any) {
    for (const [blockNumber, set] of witnessHash10) {
        if (currentBlockNumber - blockNumber > 10) {
            const tmpSet = new Set(set);
            witnessHash10.delete(blockNumber);
            for (const hash of tmpSet) {
                const parsedObj = JSON.parse(hash);
                const [result, total] = await countWitnesses(parsedObj, currentBlockNumber, api);
                metric.labels(parsedObj.type, '10').set(total);
                // log the hash if not all the validator witnessed it so we can quickly look up the hash and check which validator failed to do so
                log(total, result, currentBlockNumber, blockNumber, parsedObj, logger);
            }
        }
    }
}

async function processHash50(currentBlockNumber: number, api: any, logger: any) {
    for (const [blockNumber, set] of witnessHash50) {
        if (currentBlockNumber - blockNumber > 50) {
            const tmpSet = new Set(set);
            witnessHash50.delete(blockNumber);
            for (const hash of tmpSet) {
                const parsedObj = JSON.parse(hash);
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
                    });
            }
        }
    }
}

async function countWitnesses(parsedObj: any, currentBlockNumber: number, api: any) {
    const result: any = await makeRpcRequest(api, 'witness_count', parsedObj.hash);
    let total = global.currentAuthorities;
    if (global.currentBlock === currentBlockNumber && result) {
        total = global.currentAuthorities - result.failing_count;
        // check the previous epoch as well! could be a false positive after rotation!
        if (total < global.currentAuthorities * 0.1) {
            const previousEpochVote = (
                await api.query.witnesser.votes(global.epochIndex - 1, parsedObj.hash)
            )?.toJSON();
            if (previousEpochVote) {
                total += hex2bin(previousEpochVote).match(/1/g)?.length || 0;
            }
        }
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
            `Block ${blockNumber}: ${parsedObj.type} hash ${parsedObj.hash} witnesssed by ${total} validators after 10 blocks!
        Validators: [${validators}]`,
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
                currentBlockNumber + 40,
            );
        }
    }
}
