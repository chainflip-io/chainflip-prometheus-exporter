import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { hex2bin, insertOrReplace } from '../../utils/utils';

const witnessHash10 = new Map<number, Set<string>>();
const witnessHash50 = new Map<number, Set<string>>();

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
                                    `Block ${elem[0]}: ${parsedObj.type} hash ${parsedObj.hash} witnesssed by ${number} validators after 10 blocks!`,
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
                                    `Block ${elem[0]}: ${parsedObj.type} hash ${parsedObj.hash} witnesssed by ${number} validators after 50 blocks!`,
                                );
                            }
                        }
                    }
                    witnessHash50.delete(elem[0]);
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
                            witnessHash10,
                            JSON.stringify({
                                type: `${callData.section}:${callData.method}`,
                                hash: hashToCheck,
                            }),
                            blockNumber,
                            ``,
                        );
                        insertOrReplace(
                            witnessHash50,
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
