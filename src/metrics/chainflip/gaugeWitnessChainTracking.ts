import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { blake2AsHex } from '@polkadot/util-crypto';

const witnessHash = new Map<number, Set<string>>();

const metricName: string = 'cf_chain_tracking_witness_count';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Number of validator witnessing ChainStateUpdated for an external chain',
    labelNames: ['extrinsic'],
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
            console.log(witnessHash)
            for (const elem of witnessHash) {
                if (signedBlock.block.header.number - elem[0] > 5) {
                    for (const hash of elem[1]) {
                        const parsedObj = JSON.parse(hash);
                        const votes: string = (
                            await api.query.witnesser.votes(global.epochIndex, parsedObj.hash)
                        ).toHuman();
                        if (votes) {
                            const binary = hex2bin(votes);
                            const number = binary.match(/1/g)?.length || 0;

                            metric.labels(parsedObj.type).set(number);
                            // log the hash if not all the validator witnessed it so we can quickly look up the hash and check which validator failed to do so
                            if (number < 150) {
                                console.log(parsedObj.type);
                                console.log(
                                    `${parsedObj.hash} witnesssed by ${number} validators!`,
                                );
                            }
                        }
                    }
                    witnessHash.delete(elem[0]);
                }
            }

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
                        if(witnessHash.has(blockNumber)){
                            witnessHash.get(blockNumber)?.add(JSON.stringify({
                                type: `${callData.section}:${callData.method}`,
                                hash: blakeHash,
                                })
                            );
                        } else {
                            const tmpSet = new Set<string>();
                            tmpSet.add(
                                JSON.stringify({
                                    type: `${callData.section}:${callData.method}`,
                                    hash: blakeHash,
                                }),
                            );
                            witnessHash.set(blockNumber, tmpSet);
                        }
                    }
                    // TODO: fix btc chainTracking, hash returned is not correct
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
                        if(witnessHash.has(blockNumber)){
                            witnessHash.get(blockNumber)?.add(JSON.stringify({
                                type: `${callData.section}:${callData.method}`,
                                hash: blakeHash,
                                })
                            );
                        } else {
                            const tmpSet = new Set<string>();
                            tmpSet.add(
                                JSON.stringify({
                                    type: `${callData.section}:${callData.method}`,
                                    hash: blakeHash,
                                }),
                            );
                            witnessHash.set(blockNumber, tmpSet);
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
                        if(witnessHash.has(blockNumber)){
                            witnessHash.get(blockNumber)?.add(JSON.stringify({
                                type: `${callData.section}:${callData.method}`,
                                hash: blakeHash,
                                })
                            );
                        } else {
                            const tmpSet = new Set<string>();
                            tmpSet.add(
                                JSON.stringify({
                                    type: `${callData.section}:${callData.method}`,
                                    hash: blakeHash,
                                }),
                            );
                            witnessHash.set(blockNumber, tmpSet);
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

function hex2bin(hex: string) {
    hex = hex.replace('0x', '').toLowerCase();
    var out = '';
    for (var c of hex) {
        switch (c) {
            case '0':
                out += '0000';
                break;
            case '1':
                out += '0001';
                break;
            case '2':
                out += '0010';
                break;
            case '3':
                out += '0011';
                break;
            case '4':
                out += '0100';
                break;
            case '5':
                out += '0101';
                break;
            case '6':
                out += '0110';
                break;
            case '7':
                out += '0111';
                break;
            case '8':
                out += '1000';
                break;
            case '9':
                out += '1001';
                break;
            case 'a':
                out += '1010';
                break;
            case 'b':
                out += '1011';
                break;
            case 'c':
                out += '1100';
                break;
            case 'd':
                out += '1101';
                break;
            case 'e':
                out += '1110';
                break;
            case 'f':
                out += '1111';
                break;
            default:
                return '';
        }
    }

    return out;
}
