import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { blake2AsHex } from '@polkadot/util-crypto';
import { hex2bin, insertOrReplace, logStructureSize, ProtocolData } from '../../utils/utils';
import makeRpcRequest from '../../utils/makeRpcRequest';

const witnessHash10 = new Map<number, Set<string>>();

const metricName: string = 'cf_chain_tracking_witness_count';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Number of validator witnessing ChainStateUpdated for an external chain',
    labelNames: ['extrinsic', 'marginBlocks'],
    registers: [],
});

export const gaugeWitnessChainTracking = async (
    context: Context,
    data: ProtocolData,
): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_chain_tracking_witness_count')) {
        return;
    }
    if (global.epochIndex) {
        const { logger, apiLatest, registry, metricFailure } = context;
        logger.debug('scraping', { metric: metricName, blockNumber: data.blockNumber });

        try {
            if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

            const signedBlock = data.signedBlock;
            const currentBlockNumber = data.blockNumber;
            logStructureSize(
                logger,
                'witnessChainTracking.witnessHash10',
                witnessHash10.size,
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
            let ethBlock = 0;
            let arbBlock = 0;
            let hubBlock = 0;
            signedBlock.block.extrinsics.forEach((ex: any, index: any) => {
                if (ex.toHuman().method.method === 'witnessAtEpoch') {
                    const callData = ex.toHuman().method.args.call;

                    if (callData && callData.section === 'ethereumChainTracking') {
                        ethBlock = ethereumChainTracking(
                            callData,
                            currentBlockNumber,
                            ethBlock,
                            apiLatest,
                        );
                    }
                    if (callData && callData.section === 'arbitrumChainTracking') {
                        arbBlock = arbitrumChainTracking(
                            callData,
                            currentBlockNumber,
                            arbBlock,
                            apiLatest,
                        );
                    }
                    if (callData && callData.section === 'assethubChainTracking') {
                        hubBlock = assetHubChainTracking(
                            callData,
                            currentBlockNumber,
                            hubBlock,
                            apiLatest,
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

function ethereumChainTracking(
    callData: any,
    blockNumber: number,
    ethBlock: number,
    apiLatest: any,
): number {
    const finalData = callData.args;
    // set priorityFee to 0, it is not kept into account for the chaintracking
    finalData.new_chain_state.trackedData.priorityFee = '0';
    const blockHeight = finalData.new_chain_state.blockHeight.replace(/,/g, '');
    const baseFee = finalData.new_chain_state.trackedData.baseFee.replace(/,/g, '');
    finalData.new_chain_state.trackedData.baseFee = baseFee;
    finalData.new_chain_state.blockHeight = blockHeight;
    // create the extrinsic we need to witness (ETH chain tracking in this case)
    const extrinsic = apiLatest.tx.ethereumChainTracking.updateChainState(
        finalData.new_chain_state,
    );
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
        return Number(blockHeight || 0);
    }
    return ethBlock;
}

function assetHubChainTracking(
    callData: any,
    blockNumber: number,
    hubBlock: number,
    apiLatest: any,
): number {
    const finalData = callData.args;
    // set medianTip to 0, it is not kept into account for the chaintracking
    finalData.new_chain_state.trackedData.medianTip = '0';
    const blockHeight = finalData.new_chain_state.blockHeight.replace(/,/g, '');
    const runtimeVersion = finalData.new_chain_state.trackedData.runtimeVersion.specVersion.replace(
        /,/g,
        '',
    );
    finalData.new_chain_state.trackedData.runtimeVersion.specVersion = runtimeVersion;
    finalData.new_chain_state.blockHeight = blockHeight;
    // create the extrinsic we need to witness (AssetHub chain tracking in this case)
    const extrinsic = apiLatest.tx.assethubChainTracking.updateChainState(
        finalData.new_chain_state,
    );
    // obtain the hash of the extrinsic call
    const blakeHash = blake2AsHex(extrinsic.method.toU8a(), 256);
    if (Number(blockHeight) > hubBlock) {
        insertOrReplace(
            witnessHash10,
            JSON.stringify({
                type: `${callData.section}:${callData.method}`,
                hash: blakeHash,
            }),
            blockNumber,
            `${callData.section}:${callData.method}`,
        );
        return Number(blockHeight || 0);
    }
    return hubBlock;
}

function arbitrumChainTracking(
    callData: any,
    blockNumber: number,
    arbBlock: number,
    apiLatest: any,
): number {
    const finalData = callData.args;
    // set priorityFee to 0, it is not kept into account for the chaintracking
    finalData.new_chain_state.trackedData.priorityFee = '0';
    const blockHeight = finalData.new_chain_state.blockHeight.replace(/,/g, '');
    const baseFee = finalData.new_chain_state.trackedData.baseFee.replace(/,/g, '');
    finalData.new_chain_state.trackedData = {
        // Use the floor value of 0.01 gwei for Arbitrum One
        baseFee: 10000000,
        l1BaseFeeEstimate: 1,
    };
    finalData.new_chain_state.blockHeight = blockHeight;
    // create the extrinsic we need to witness (ETH chain tracking in this case)
    const extrinsic = apiLatest.tx.arbitrumChainTracking.updateChainState(
        finalData.new_chain_state,
    );
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
        return Number(blockHeight || 0);
    }
    return arbBlock;
}

async function processHash10(
    currentBlockNumber: number,
    apiLatest: any,
    logger: any,
    blockHash: string,
    blockApi: any,
) {
    for (const [blockNumber, set] of witnessHash10) {
        if (currentBlockNumber - blockNumber > 10) {
            const tmpSet = new Set(set);
            witnessHash10.delete(blockNumber);
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
