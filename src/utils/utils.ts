import { ApiPromise } from '@polkadot/api';
import { Metadata, TypeRegistry } from '@polkadot/types';
import { BN } from '@polkadot/util';

export function chunk(arr: any[], n: number) {
    const r = Array(Math.ceil(arr.length / n)).fill(0);
    return r.map((e, i) => arr.slice(i * n, i * n + n));
}

export function insertOrReplace(
    map: Map<number, Set<string>>,
    elem: string,
    blockNumber: number,
    callData: string,
) {
    if (map.has(blockNumber)) {
        const set = map.get(blockNumber);
        // if it has already elements we need to check and delete the one sharing the chainTracking
        // we want only 1 extrinsic for each chain max (the one with the latest block reported)
        set?.forEach((element) => {
            const parsedObj = JSON.parse(element);
            if (parsedObj.type === callData) {
                set?.delete(element);
            }
        });
        set?.add(elem);
    } else {
        const tmpSet = new Set<string>();
        tmpSet.add(elem);
        map.set(blockNumber, tmpSet);
    }
}

export function hex2bin(hex: string) {
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

const getMetadata = async (api: ApiPromise) => {
    const metadataString = await api.rpc.state.getMetadata();
    return metadataString;
};

let metadata: any;
export const getStateChainError = async (
    api: ApiPromise,
    value: { error: `0x${string}`; index: number },
) => {
    // convert LE hex encoded number (e.g. "0x06000000") to BN (6)
    const error = new BN(value.error.slice(2), 'hex', 'le');
    const errorIndex = error.toNumber();
    // const specVersion = parseSpecNumber(block.specId);
    const palletIndex = value.index;

    if (!metadata) {
        metadata = await getMetadata(api);
    }

    const registryError = metadata.registry.findMetaError({
        index: new BN(palletIndex),
        error,
    });

    return {
        data: {
            palletIndex,
            errorIndex,
            name: `${registryError.section}:${registryError.name}`,
            docs: registryError.docs.join('\n').trim(),
        },
    };
};
