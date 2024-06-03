import { Logger } from 'winston';
import * as fs from 'fs';
import { config } from 'dotenv';
import { Network } from './interfaces';

config();

const BTC_HTTP_ENDPOINT: string =
    process.env.BTC_HTTP_ENDPOINT || 'http://flip:flip@localhost:8332';

const CF_NETWORK: string = process.env.CF_NETWORK || 'localnet';
const NETWORK_EXPORTER_PORT: number = Number(process.env.NETWORK_EXPORTER_PORT) || 9000;

const CF_WS_ENDPOINT: string = process.env.CF_WS_ENDPOINT || 'ws://localhost:9944';

const CONFIG_PATH: string = process.env.CONFIG_PATH || `config/${CF_NETWORK}.json`;

const DOT_WS_ENDPOINT: string = process.env.DOT_WS_ENDPOINT || 'ws://localhost:9947';

const ETH_WS_ENDPOINT: string = process.env.ETH_WS_ENDPOINT || 'ws://localhost:8546';

const ARB_WS_ENDPOINT: string = process.env.ARB_WS_ENDPOINT || 'ws://localhost:8548';

const CACHE_ENDPOINT: string = process.env.CACHE_ENDPOINT || '';

const PROCESSOR_ENDPOINT: string = process.env.PROCESSOR_ENDPOINT || '';

export interface Env {
    CONFIG_PATH: string;
    BTC_HTTP_ENDPOINT: string;
    CF_NETWORK: string;
    NETWORK_EXPORTER_PORT: number;
    CF_WS_ENDPOINT: string;
    DOT_WS_ENDPOINT: string;
    ETH_WS_ENDPOINT: string;
    CACHE_ENDPOINT: string;
    PROCESSOR_ENDPOINT: string;
    ARB_WS_ENDPOINT: string;
}

export const env: Env = {
    CONFIG_PATH,
    BTC_HTTP_ENDPOINT,
    CF_NETWORK,
    NETWORK_EXPORTER_PORT,
    CF_WS_ENDPOINT,
    DOT_WS_ENDPOINT,
    ETH_WS_ENDPOINT,
    CACHE_ENDPOINT,
    PROCESSOR_ENDPOINT,
    ARB_WS_ENDPOINT,
};

export default function getConfig(logger: Logger): any {
    logger.info(`Loading production config at ${CONFIG_PATH}`);
    try {
        const networkExporterConfig: any = fs.readFileSync(CONFIG_PATH);
        return JSON.parse(networkExporterConfig.toString());
    } catch (err) {
        logger.error('Error reading production config', err);
    }
    return;
}
