import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';
import type { Registry } from '@polkadot/types/types';
import { Context } from '../lib/interfaces';
import { customRpcs } from './customRpcSpecification';
import { RpcReturnValue } from './makeRpcRequest';

declare global {
    var rotationInProgress: boolean;
    var epochIndex: number;
    var solAggKeyAddress: string;
    // This aggKey is shared between Dot and AssetHub
    var dotAggKeyAddress: string;
    var currentBlock: number;
    var currentAuthorities: number;
    var availableSolanaNonces: SolanaNonce[];
    var solanaRotationTx: string;
    var solanaCurrentOnChainKey: string;
    var prices: Map<string, number>;
    var oraclePrices: Map<string, number>;

    interface CustomApiPromise extends ApiPromise {
        rpc: ApiPromise['rpc'] & {
            cf: {
                [K in keyof typeof customRpcs.cf]: (...args: any[]) => Promise<any>;
            };
        };
    }

    type DeepMutable<T> = {
        -readonly [P in keyof T]: DeepMutable<T[P]>;
    };
}

// Explicit per-request timeout for every outbound RPC / state query the
// exporter makes (substrate ws, EVM JSON-RPC, solana, bitcoin, tron). Without
// this we inherit a different default per library (60s polkadot, 120s ethers,
// none at all for raw axios/fetch): a slow upstream must fail fast and loudly
// (metric_scrape_failure) instead of pinning the per-block pipeline.
export const RPC_TIMEOUT_MS = 30_000;

export type ProtocolData = {
    blockHash: string;
    blockNumber: number;
    data: RpcReturnValue['monitoring_data'];
    blockApi: any;
    signedBlock: any;
};

export type SolanaNonce = {
    address: string;
    nonce: string;
    base58address: string;
    base58nonce: string;
};

export async function pollEndpoint(
    func: any,
    context: Context,
    intervalSeconds: number,
): Promise<ReturnType<typeof setInterval>> {
    func(context);

    return setInterval(() => func(context), intervalSeconds * 1000);
}

export function chunk(arr: any[], n: number) {
    const r = Array(Math.ceil(arr.length / n)).fill(0);
    return r.map((e, i) => arr.slice(i * n, i * n + n));
}

type LogStructureSizeOptions = {
    everyBlocks?: number;
};

const structureSizeLogState = new Map<string, { lastBlock: number; maxSize: number }>();

export function logStructureSize(
    logger: { debug: (msg: string) => void; warn?: (msg: string) => void },
    key: string,
    size: number,
    blockNumber: number,
    options: LogStructureSizeOptions = {},
) {
    const everyBlocks = options.everyBlocks ?? 120;
    const normalizedSize = Number.isFinite(size) ? size : 0;
    const normalizedBlock = Number.isFinite(blockNumber) ? blockNumber : 0;

    const state = structureSizeLogState.get(key) ?? {
        lastBlock: Number.NEGATIVE_INFINITY,
        maxSize: 0,
    };
    const hasNewPeak = normalizedSize > state.maxSize;
    const shouldLog = hasNewPeak || normalizedBlock - state.lastBlock >= everyBlocks;
    const maxSize = Math.max(state.maxSize, normalizedSize);

    if (shouldLog) {
        logger.debug(
            `[growth] ${key}: size=${normalizedSize}, max=${maxSize}, block=${normalizedBlock}`,
        );
        state.lastBlock = normalizedBlock;
    }

    state.maxSize = maxSize;
    structureSizeLogState.set(key, state);
}

export const getStateChainError = (
    registry: Registry,
    value: { error: `0x${string}`; index: number },
) => {
    // convert LE hex encoded number (e.g. "0x06000000") to BN (6)
    const error = new BN(value.error.slice(2), 'hex', 'le');
    const errorIndex = error.toNumber();
    const palletIndex = value.index;

    // The registry belongs to `api.at(blockHash)`, so it already carries the correct
    // metadata for this block's runtime version (upgrade-safe) and findMetaError is a
    // pure in-memory lookup. Fetching metadata per ExtrinsicFailed event instead (via
    // api.rpc.state.getMetadata) is a heavy, event-loop-blocking decode that pins the
    // CPU during DuplicateWitness storms — do not reintroduce it.
    const registryError = registry.findMetaError({
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

export function toNumber(value: any): number {
    // Chains with a composite block height serialise it as an object (`{ root: 123 }`),
    // and as a JSON-encoded string when it is used as a map key (`'{"root":123}'`).
    let height = value;
    if (typeof height === 'string' && height.startsWith('{')) {
        try {
            height = JSON.parse(height);
        } catch {
            return Number(value);
        }
    }
    if (typeof height === 'object' && height !== null && 'root' in height) {
        return Number(height.root);
    }
    return Number(height);
}

// Used to remove the commas from numbers
export function parseEvent(event: JSON) {
    if (event === null || event === undefined) return;
    for (const [key, value] of Object.entries(event)) {
        if (typeof value === 'object') {
            parseEvent(value);
        } else {
            // @ts-expect-error "we are sure the key exists"
            event[key] = value.toString().replaceAll(',', '');
        }
    }
}
