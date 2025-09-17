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

const DOT_WS_ENDPOINT: string = process.env.DOT_WS_ENDPOINT || 'ws://localhost:9947';

const ETH_WS_ENDPOINT: string = process.env.ETH_WS_ENDPOINT || 'ws://localhost:8546';
const ETH_HTTP_ENDPOINT: string = process.env.ETH_HTTP_ENDPOINT || 'http://localhost:8545';

const ARB_WS_ENDPOINT: string = process.env.ARB_WS_ENDPOINT || 'ws://localhost:8548';
const ARB_HTTP_ENDPOINT: string = process.env.ARB_HTTP_ENDPOINT || 'http://localhost:8547';

const SOL_HTTP_ENDPOINT: string = process.env.SOL_HTTP_ENDPOINT || 'http://localhost:8899';

const SOL_WS_ENDPOINT: string = process.env.SOL_WS_ENDPOINT || 'ws://localhost:9000';

const CACHE_ENDPOINT: string = process.env.CACHE_ENDPOINT || '';

const HUB_WS_ENDPOINT: string = process.env.HUB_WS_ENDPOINT || 'ws://localhost:9955';

export interface Env {
    CONFIG_PATH: string;
    BTC_HTTP_ENDPOINT: string;
    CF_NETWORK: string;
    NETWORK_EXPORTER_PORT: number;
    CF_WS_ENDPOINT: string;
    DOT_WS_ENDPOINT: string;
    ETH_WS_ENDPOINT: string;
    ETH_HTTP_ENDPOINT: string;
    CACHE_ENDPOINT: string;
    ARB_WS_ENDPOINT: string;
    ARB_HTTP_ENDPOINT: string;
    SOL_HTTP_ENDPOINT: string;
    SOL_WS_ENDPOINT: string;
    HUB_WS_ENDPOINT: string;
}

export const env: Env = {
    CONFIG_PATH,
    BTC_HTTP_ENDPOINT,
    CF_NETWORK,
    NETWORK_EXPORTER_PORT,
    CF_WS_ENDPOINT,
    DOT_WS_ENDPOINT,
    ETH_WS_ENDPOINT,
    ETH_HTTP_ENDPOINT,
    CACHE_ENDPOINT,
    ARB_WS_ENDPOINT,
    ARB_HTTP_ENDPOINT,
    SOL_HTTP_ENDPOINT,
    SOL_WS_ENDPOINT,
    HUB_WS_ENDPOINT,
};

export default function getConfig(logger: Logger): any {
    logger.info(`Loading production config at ${CONFIG_PATH}`);
    try {
        const networkExporterConfig: any = fs.readFileSync(CONFIG_PATH);
        const config: Config = JSON.parse(networkExporterConfig.toString());
        let result = jsonvalidator.validate(config.flip, schema.definitions.FlipConfig);
        if (!result.valid) {
            logger.error(`Invalid Flip config: ${result.errors}`);
            process.exit(1);
        }
        result = jsonvalidator.validate(config.arb, schema.definitions.ArbConfig);
        if (!result.valid) {
            logger.error(`Invalid Arb config: ${result.errors}`);
            process.exit(1);
        }
        result = jsonvalidator.validate(config.eth, schema.definitions.EthConfig);
        if (!result.valid) {
            logger.error(`Invalid Eth config: ${result.errors}`);
            process.exit(1);
        }
        result = jsonvalidator.validate(config.btc, schema.definitions.BtcConfig);
        if (!result.valid) {
            logger.error(`Invalid Btc config: ${result.errors}`);
            process.exit(1);
        }
        result = jsonvalidator.validate(config.dot, schema.definitions.DotConfig);
        if (!result.valid) {
            logger.error(`Invalid Dot config: ${result.errors}`);
            process.exit(1);
        }
        result = jsonvalidator.validate(config.sol, schema.definitions.SolConfig);
        if (!result.valid) {
            logger.error(`Invalid Sol config: ${result.errors}`);
            process.exit(1);
        }
        result = jsonvalidator.validate(config.hub, schema.definitions.HubConfig);
        if (!result.valid) {
            logger.error(`Invalid Hub config: ${result.errors}`);
            process.exit(1);
        }
        return config;
    } catch (err) {
        logger.error('Error reading production config', err);
        process.exit(1);
    }
}
