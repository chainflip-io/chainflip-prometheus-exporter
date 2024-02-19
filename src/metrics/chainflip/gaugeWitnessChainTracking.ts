import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { blake2AsHex } from '@polkadot/util-crypto';
import { hex2bin, insertOrReplace } from '../../utils/utils';

const witnessHash10 = new Map<number, Set<string>>();
const witnessHash50 = new Map<number, Set<string>>();

const metricName: string = 'cf_chain_tracking_witness_count';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Number of validator witnessing ChainStateUpdated for an external chain',
    labelNames: ['extrinsic', 'marginBlocks'],
    registers: [],
});

export const gaugeWitnessChainTracking = async (context: Context): Promise<void> => {
    if (global.epochIndex) {
        const { logger, api, registry, metricFailure } = context;
        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
        metricFailure.labels({ metric: metricName }).set(0);
        try {
            const signedBlock = await api.rpc.chain.getBlock();
            const currentBlockNumber = Number(
                signedBlock.block.header.number.toHuman().replace(/,/g, ''),
            );
            global.currentBlock = currentBlockNumber;
            for (const [blockNumber, set] of witnessHash10) {
                if (currentBlockNumber - blockNumber > 10) {
                    const tmpSet = new Set(set);
                    witnessHash10.delete(blockNumber);
                    for (const hash of tmpSet) {
                        const parsedObj = JSON.parse(hash);
                        api.query.witnesser
                            .votes(global.epochIndex, parsedObj.hash)
                            .then((votes: { toHuman: () => any; }) => {
                                if (global.currentBlock === currentBlockNumber) {
                                    const vote = votes.toHuman();
                                    if (vote) {
                                        const binary = hex2bin(vote);
                                        const number = binary.match(/1/g)?.length || 0;

                                        metric.labels(parsedObj.type, '10').set(number);
                                        // log the hash if not all the validator witnessed it so we can quickly look up the hash and check which validator failed to do so
                                        if (number < global.currentAuthorities) {
                                            logger.info(
                                                `Block ${blockNumber}: ${parsedObj.type} hash ${parsedObj.hash} witnesssed by ${number} validators after 10 blocks!`,
                                            );
                                        }
                                    }
                                }
                            });
                    }
                }
            }
            for (const [blockNumber, set] of witnessHash50) {
                if (currentBlockNumber - blockNumber > 50) {
                    const tmpSet = new Set(set);
                    witnessHash50.delete(blockNumber);
                    for (const hash of tmpSet) {
                        const parsedObj = JSON.parse(hash);
                        api.query.witnesser
                            .votes(global.epochIndex, parsedObj.hash)
                            .then((votes: { toHuman: () => any; }) => {
                                if (global.currentBlock === currentBlockNumber) {
                                    const vote = votes.toHuman();
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
            let btcBlock = 0;
            let ethBlock = 0;
            let dotBlock = 0;
            signedBlock.block.extrinsics.forEach((ex: any, index: any) => {
                const blockNumber: number = Number(signedBlock.block.header.number);
                if (ex.toHuman().method.method === 'witnessAtEpoch') {
                    const callData = ex.toHuman().method.args.call;

                    if (callData && callData.section === 'ethereumChainTracking') {
                        const finalData = callData.args;
                        // set priorityFee to 0, it is not kept into account for the chaintracking
                        finalData.new_chain_state.trackedData.priorityFee = '0';
                        const blockHeight = finalData.new_chain_state.blockHeight.replace(/,/g, '');
                        const baseFee = finalData.new_chain_state.trackedData.baseFee.replace(
                            /,/g,
                            '',
                        );
                        // parse the data and removed useless comas (damn polkadot api)
                        finalData.new_chain_state.trackedData.baseFee = baseFee;
                        finalData.new_chain_state.blockHeight = blockHeight;
                        // create the extrinsic we need to witness (ETH chain tracking in this case)
                        const extrinsic = api.tx.ethereumChainTracking.updateChainState(
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
                            insertOrReplace(
                                witnessHash50,
                                JSON.stringify({
                                    type: `${callData.section}:${callData.method}`,
                                    hash: blakeHash,
                                }),
                                blockNumber,
                                `${callData.section}:${callData.method}`,
                            );
                            ethBlock = Number(blockHeight);
                        }
                    }
                    if (callData && callData.section === 'bitcoinChainTracking') {
                        const finalData = callData.args;

                        const blockHeight = finalData.new_chain_state.blockHeight.replace(/,/g, '');
                        // parse the data and removed useless comas (damn polkadot api)
                        finalData.new_chain_state.blockHeight = blockHeight;

                        // set the default value for the fees (we use these values to witness)
                        finalData.new_chain_state.trackedData.btcFeeInfo = {
                            feePerInputUtxo: '7500',
                            feePerOutputUtxo: '4300',
                            minFeeRequiredPerTx: '1200',
                        };

                        // create the extrinsic we need to witness (ETH chain tracking in this case)
                        const extrinsic = api.tx.bitcoinChainTracking.updateChainState(
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
                            insertOrReplace(
                                witnessHash50,
                                JSON.stringify({
                                    type: `${callData.section}:${callData.method}`,
                                    hash: blakeHash,
                                }),
                                blockNumber,
                                `${callData.section}:${callData.method}`,
                            );
                            btcBlock = Number(blockHeight);
                        }
                    }
                    if (callData && callData.section === 'polkadotChainTracking') {
                        const finalData = callData.args;
                        // set medianTip to 0, it is not kept into account for the chaintracking
                        finalData.new_chain_state.trackedData.medianTip = '0';
                        // parse the data and removed useless comas (damn polkadot api)
                        const blockHeight = finalData.new_chain_state.blockHeight.replace(/,/g, '');
                        const runtimeVersion =
                            finalData.new_chain_state.trackedData.runtimeVersion.specVersion.replace(
                                /,/g,
                                '',
                            );
                        finalData.new_chain_state.trackedData.runtimeVersion.specVersion =
                            runtimeVersion;
                        finalData.new_chain_state.blockHeight = blockHeight;
                        // create the extrinsic we need to witness (DOT chain tracking in this case)
                        const extrinsic = api.tx.polkadotChainTracking.updateChainState(
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
                            insertOrReplace(
                                witnessHash50,
                                JSON.stringify({
                                    type: `${callData.section}:${callData.method}`,
                                    hash: blakeHash,
                                }),
                                blockNumber,
                                `${callData.section}:${callData.method}`,
                            );
                            dotBlock = Number(blockHeight);
                        }
                    }
                }
            });
        } catch (err) {
            logger.error(err);
            metricFailure.labels({ metric: metricName }).set(1);
        }
    }
};
