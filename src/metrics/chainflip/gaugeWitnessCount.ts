import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { blake2AsHex } from '@polkadot/util-crypto';

const witnessHash = new Map<number, Set<string>>();
type innerCall = {
    type: string,
    hash: string,
}

const metricName: string = 'cf_witness_count';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Is the Network in a rotation',
    labelNames: ['extrinsic'],
    registers: [],
});

export const gaugeWitnessCount = async (context: Context): Promise<void> => {
    if (global.epochIndex) {
        const { logger, api, registry, metricFailure, header } = context;
        console.log("\n\n")
        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
        metricFailure.labels({ metric: metricName }).set(0);
        try {

            const signedBlock = await api.rpc.chain.getBlock();

            for (const elem of witnessHash){
                if(signedBlock.block.header.number - elem[0] > 3){
                    console.log(Number(signedBlock.block.header.number))
                    // console.log(elem);
                    console.log(elem[0]) //key  = blockNumber
                    // console.log(elem[1]) //set containing the hashes
                    for (const hash of elem[1]){
                        let parsedObj = JSON.parse(hash)
                        const votes: string = (
                            await api.query.witnesser.votes(global.epochIndex, parsedObj.hash)
                        ).toHuman();
                        if(votes) {
                            console.log(parsedObj)
                            console.log(votes)
                            const binary = hex2bin(votes);
                            const number = binary.match(/1/g)?.length;
                            console.log(number)
                        }
                    }
                    witnessHash.delete(elem[0]);
                }
            }
            // console.log(witnessHash)
            signedBlock.block.extrinsics.forEach((ex: any, index: any) => {
                const blockNumber:number = Number(signedBlock.block.header.number);
                // console.log(blockNumber)
                if (ex.toHuman().method.method === 'witnessAtEpoch') {
                    const callData = ex.toHuman().method.args.call;
                    // console.log(callData)
                    if(callData.method != "updateChainState"){
                        // console.log(callData)
                        // console.log('\n\n');
                        // console.log(callData)
                        // console.log(ex.method.args[0].hash.toHex())
                        const hashToCheck = ex.method.args[0].hash.toHex();
                        if(witnessHash.has(blockNumber)){
                            witnessHash.get(blockNumber).add(JSON.stringify({type: callData.section + ":" + callData.method, hash: hashToCheck}));
                        } else {
                            let tmpSet = new Set<string>();
                            tmpSet.add(JSON.stringify({type: callData.section + ":" + callData.method, hash: hashToCheck}))
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
