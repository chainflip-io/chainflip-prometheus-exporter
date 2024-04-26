import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { hex2bin, insertOrReplace } from '../../utils/utils';
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

export const gaugeWitnessCount = async (context: Context): Promise<void> => {
    if (global.epochIndex) {
        const { logger, api, registry, metricFailure, header } = context;
        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
        if (registry.getSingleMetric(metricFailureName) === undefined)
            registry.registerMetric(metricWitnessFailure);

        metricFailure.labels({ metric: metricName }).set(0);
        try {
            const signedBlock = await api.rpc.chain.getBlock();
            const currentBlockNumber = Number(
                signedBlock.block.header.number.toHuman().replace(/,/g, ''),
            );
            toDelete.forEach((block, labels) => {
                if (block <= currentBlockNumber) {
                    const values = JSON.parse(labels);
                    metricWitnessFailure.remove(
                        values.extrinsic,
                        values.validators,
                        values.witnessedBy,
                    );
                    toDelete.delete(labels);
                }
            });
            for (const [blockNumber, set] of witnessExtrinsicHash10) {
                if (currentBlockNumber - blockNumber > 10) {
                    const tmpSet = new Set(set);
                    witnessExtrinsicHash10.delete(blockNumber);
                    for (const hash of tmpSet) {
                        const parsedObj = JSON.parse(hash);
                        makeRpcRequest(api, 'witness_count', parsedObj.hash).then(
                            async (result: any) => {
                                if (global.currentBlock === currentBlockNumber && result) {
                                    const total = global.currentAuthorities - result.failing_count;
                                    metric.labels(parsedObj.type, '10').set(total);
                                    // log the hash if not all the validator witnessed it so we can quickly look up the hash and check which validator failed to do so
                                    if (total < global.currentAuthorities) {
                                        const validators: string[] = [];
                                        result.validators.forEach(
                                            ([ss58address, vanity, witness]: [
                                                string,
                                                string,
                                                boolean,
                                            ]) => {
                                                if (!witness) {
                                                    validators.push(ss58address);
                                                }
                                            },
                                        );
                                        logger.info(
                                            `Block ${blockNumber}: ${parsedObj.type} hash ${parsedObj.hash} witnesssed by ${total} validators after 10 blocks!
                                        Validators: [${validators}]`,
                                        );
                                        // in case less than 90% witnessed it
                                        // create a temporary metric so that we can fetch the list of validators in our alerting system
                                        if (total <= global.currentAuthorities * 0.67) {
                                            metricWitnessFailure
                                                .labels(
                                                    `${parsedObj.type}`,
                                                    `${validators}`,
                                                    `${total}`,
                                                )
                                                .set(1);
                                            toDelete.set(
                                                JSON.stringify({
                                                    extrinsic: `${parsedObj.type}`,
                                                    validators: `${validators}`,
                                                    witnessedBy: `${total}`,
                                                }),
                                                currentBlockNumber + 10,
                                            );
                                        }
                                    }
                                }
                            },
                        );
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
                            .then((votes: { toJSON: () => any }) => {
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
