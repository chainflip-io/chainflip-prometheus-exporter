import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { hex2bin, insertOrReplace } from '../../utils/utils';

const witnessExtrinsicHash10 = new Map<number, Set<string>>();
const witnessExtrinsicHash50 = new Map<number, Set<string>>();

const metricName: string = 'cf_witness_count';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Number of validator witnessing an extrinsic',
    labelNames: ['extrinsic', 'marginBlocks'],
    registers: [],
});

export const gaugeWitnessCount = async (context: Context): Promise<void> => {
    if (global.epochIndex) {
        const { logger, api, registry, metricFailure, header } = context;
        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
        metricFailure.labels({ metric: metricName }).set(0);
        try {
            const signedBlock = await api.rpc.chain.getBlock();
            const currentBlockNumber = Number(
                signedBlock.block.header.number.toHuman().replace(/,/g, ''),
            );
            for (const [blockNumber, set] of witnessExtrinsicHash10) {
                if (currentBlockNumber - blockNumber > 10) {
                    const tmpSet = new Set(set);
                    witnessExtrinsicHash10.delete(blockNumber);
                    for (const hash of tmpSet) {
                        const parsedObj = JSON.parse(hash);
                        api.query.witnesser
                            .votes(global.epochIndex, parsedObj.hash)
                            .then((votes: { toHuman: () => any }) => {
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
                            });
                    }
                }
            }
            for (const [blockNumber, set] of witnessExtrinsicHash50) {
                if (currentBlockNumber - blockNumber > 50) {
                    const tmpSet = new Set(set);
                    witnessExtrinsicHash50.delete(blockNumber);
                    for (const hash of tmpSet) {
                        const parsedObj = JSON.parse(hash);
                        api.query.witnesser
                            .votes(global.epochIndex, parsedObj.hash)
                            .then((votes: { toHuman: () => any }) => {
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
                            });
                    }
                }
            }
            // chech the witnessAtEpoch extrinsics in a block and save the encoded callHash to check later
            signedBlock.block.extrinsics.forEach((ex: any, index: any) => {
                const blockNumber: number = Number(signedBlock.block.header.number);
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
                            blockNumber,
                            ``,
                        );
                        insertOrReplace(
                            witnessExtrinsicHash50,
                            JSON.stringify({
                                type: `${callData.section}:${callData.method}`,
                                hash: hashToCheck,
                            }),
                            blockNumber,
                            ``,
                        );
                    }
                }
            });
        } catch (err) {
            logger.error(err);
            metricFailure.labels({ metric: metricName }).set(1);
        }
    }
};
