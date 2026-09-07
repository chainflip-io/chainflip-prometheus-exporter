import { Logger } from 'winston';
import * as fs from 'fs';
import { config } from 'dotenv';
import { Config, Network } from './interfaces';
import jsonvalidator from 'jsonschema';
import schema from '../../config/schema.json';

config();

const BTC_HTTP_ENDPOINT: string =
    process.env.BTC_HTTP_ENDPOINT || 'http://flip:flip@localhost:8332';

const CF_NETWORK: string = process.env.CF_NETWORK || 'localnet';
const NETWORK_EXPORTER_PORT: number = Number(process.env.NETWORK_EXPORTER_PORT) || 9000;

const CF_WS_ENDPOINT: string = process.env.CF_WS_ENDPOINT || 'ws://localhost:9944';

const CONFIG_PATH: string = process.env.CONFIG_PATH || `config/${CF_NETWORK}.json`;

const ETH_HTTP_ENDPOINT: string = process.env.ETH_HTTP_ENDPOINT || 'http://localhost:8545';

const ARB_HTTP_ENDPOINT: string = process.env.ARB_HTTP_ENDPOINT || 'http://localhost:8547';

const BSC_HTTP_ENDPOINT: string = process.env.BSC_HTTP_ENDPOINT || 'http://localhost:8645';

const SOL_HTTP_ENDPOINT: string = process.env.SOL_HTTP_ENDPOINT || 'http://localhost:8899';

const SOL_WS_ENDPOINT: string = process.env.SOL_WS_ENDPOINT || 'ws://localhost:9000';

const CACHE_ENDPOINT: string = process.env.CACHE_ENDPOINT || '';

const HUB_WS_ENDPOINT: string = process.env.HUB_WS_ENDPOINT || 'ws://localhost:9955';

const TRON_HTTP_ENDPOINT: string = process.env.TRON_HTTP_ENDPOINT || 'http://localhost:8090';

export interface Env {
    CONFIG_PATH: string;
    BTC_HTTP_ENDPOINT: string;
    CF_NETWORK: string;
    NETWORK_EXPORTER_PORT: number;
    CF_WS_ENDPOINT: string;
    ETH_HTTP_ENDPOINT: string;
    CACHE_ENDPOINT: string;
    ARB_HTTP_ENDPOINT: string;
    BSC_HTTP_ENDPOINT: string;
    SOL_HTTP_ENDPOINT: string;
    SOL_WS_ENDPOINT: string;
    HUB_WS_ENDPOINT: string;
    TRON_HTTP_ENDPOINT: string;
}

export const env: Env = {
    CONFIG_PATH,
    BTC_HTTP_ENDPOINT,
    CF_NETWORK,
    NETWORK_EXPORTER_PORT,
    CF_WS_ENDPOINT,
    ETH_HTTP_ENDPOINT,
    CACHE_ENDPOINT,
    ARB_HTTP_ENDPOINT,
    BSC_HTTP_ENDPOINT,
    SOL_HTTP_ENDPOINT,
    SOL_WS_ENDPOINT,
    HUB_WS_ENDPOINT,
    TRON_HTTP_ENDPOINT,
};

const configSections = [
    { name: 'Flip', key: 'flip', definition: schema.definitions.FlipConfig },
    { name: 'Arb', key: 'arb', definition: schema.definitions.ArbConfig },
    { name: 'Bsc', key: 'bsc', definition: schema.definitions.BscConfig },
    { name: 'Eth', key: 'eth', definition: schema.definitions.EthConfig },
    { name: 'Btc', key: 'btc', definition: schema.definitions.BtcConfig },
    { name: 'Sol', key: 'sol', definition: schema.definitions.SolConfig },
    { name: 'Hub', key: 'hub', definition: schema.definitions.HubConfig },
    { name: 'Tron', key: 'tron', definition: schema.definitions.TronConfig },
] as const;

export function validateConfig(candidate: unknown): Config {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
        throw new Error('Invalid exporter config: expected a top-level object');
    }

    const config = candidate as Record<string, unknown>;
    for (const { name, key, definition } of configSections) {
        // jsonschema considers `undefined` valid, so detect absent top-level sections
        // before validating their contents.
        if (!Object.prototype.hasOwnProperty.call(config, key)) {
            throw new Error(`Invalid exporter config: missing required top-level field "${key}"`);
        }

        const result = jsonvalidator.validate(config[key], definition);
        if (!result.valid) {
            const details = result.errors.map((error) => error.stack).join('; ');
            throw new Error(`Invalid ${name} config: ${details}`);
        }
    }

    return candidate as Config;
}

export function loadConfigFile(path: string): Config {
    const contents = fs.readFileSync(path, 'utf8');
    return validateConfig(JSON.parse(contents));
}

export default function getConfig(logger: Logger): Config {
    logger.info(`Loading production config at ${CONFIG_PATH}`);
    try {
        return loadConfigFile(CONFIG_PATH);
    } catch (err) {
        const details = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to load production config at ${CONFIG_PATH}: ${details}`);
        process.exit(1);
    }
}
