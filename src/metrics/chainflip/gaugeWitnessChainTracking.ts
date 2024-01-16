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
            for (const elem of witnessHash10) {
                if (signedBlock.block.header.number - elem[0] > 10) {
                    for (const hash of elem[1]) {
                        const parsedObj = JSON.parse(hash);
                        const votes: string = (
                            await api.query.witnesser.votes(global.epochIndex, parsedObj.hash)
                        ).toHuman();
                        if (votes) {
                            const binary = hex2bin(votes);
                            const number = binary.match(/1/g)?.length || 0;

                            metric.labels(parsedObj.type, '10').set(number);
                            // log the hash if not all the validator witnessed it so we can quickly look up the hash and check which validator failed to do so
                            if (number < 150) {
                                logger.info(
                                    `${parsedObj.type} hash ${parsedObj.hash} witnesssed by ${number} validators after 10 blocks!`,
                                );
                            }
                        }
                    }
                    witnessHash10.delete(elem[0]);
                }
            }
            for (const elem of witnessHash50) {
                if (signedBlock.block.header.number - elem[0] > 50) {
                    for (const hash of elem[1]) {
                        const parsedObj = JSON.parse(hash);
                        const votes: string = (
                            await api.query.witnesser.votes(global.epochIndex, parsedObj.hash)
                        ).toHuman();
                        if (votes) {
                            const binary = hex2bin(votes);
                            const number = binary.match(/1/g)?.length || 0;

                            metric.labels(parsedObj.type, '50').set(number);
                            // log the hash if not all the validator witnessed it so we can quickly look up the hash and check which validator failed to do so
                            if (number < 150) {
                                logger.info(
                                    `${parsedObj.type} hash ${parsedObj.hash} witnesssed by ${number} validators after 50 blocks!`,
                                );
                            }
                        }
                    }
                    witnessHash50.delete(elem[0]);
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
                        if (blockHeight > ethBlock) {
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
                            ethBlock = blockHeight;
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
                        if (blockHeight > btcBlock) {
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
                            btcBlock = blockHeight;
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
                        if (blockHeight > dotBlock) {
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
                            dotBlock = blockHeight;
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
