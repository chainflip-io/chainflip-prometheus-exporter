import { Logger } from 'winston';
import * as fs from 'fs';
import { config } from 'dotenv';
import { Network } from './interfaces';

config();

const BTC_HTTP_ENDPOINT: string =
    process.env.BTC_HTTP_ENDPOINT || 'http://flip:flip@localhost:8332';

const CF_NETWORK: string = process.env.CF_NETWORK || 'localnet';
const NETWORK_EXPORTER_PORT: number = Number(process.env.NETWORK_EXPORTER_PORT) || 9000;
const CF_WATCHER_PORT: number = Number(process.env.CF_WATCHER_PORT) || 9001;
const DOT_WATCHER_PORT: number = Number(process.env.DOT_WATCHER_PORT) || 9002;
const ETH_WATCHER_PORT: number = Number(process.env.ETH_WATCHER_PORT) || 9003;
const BTC_WATCHER_PORT: number = Number(process.env.BTC_WATCHER_PORT) || 9004;
const MAX_REORG_SIZE: number = Number(process.env.MAX_REORG_SIZE) || 5;

const CF_WS_ENDPOINT: string = process.env.CF_WS_ENDPOINT || 'ws://localhost:9944';

const CONFIG_PATH: string = process.env.CONFIG_PATH || `config/${CF_NETWORK}.json`;

const DOT_WS_ENDPOINT: string = process.env.DOT_WS_ENDPOINT || 'ws://localhost:9947';

const ETH_WS_ENDPOINT: string = process.env.ETH_WS_ENDPOINT || 'ws://localhost:8546';

export interface Env {
    CONFIG_PATH: string;
    BTC_HTTP_ENDPOINT: string;
    CF_NETWORK: string;
    NETWORK_EXPORTER_PORT: number;
    CF_WATCHER_PORT: number;
    DOT_WATCHER_PORT: number;
    ETH_WATCHER_PORT: number;
    BTC_WATCHER_PORT: number;
    MAX_REORG_SIZE: number;
    CF_WS_ENDPOINT: string;
    DOT_WS_ENDPOINT: string;
    ETH_WS_ENDPOINT: string;
}

export const env: Env = {
    CONFIG_PATH,
    BTC_HTTP_ENDPOINT,
    CF_NETWORK,
    NETWORK_EXPORTER_PORT,
    CF_WATCHER_PORT,
    DOT_WATCHER_PORT,
    ETH_WATCHER_PORT,
    BTC_WATCHER_PORT,
    MAX_REORG_SIZE,
    CF_WS_ENDPOINT,
    DOT_WS_ENDPOINT,
    ETH_WS_ENDPOINT,
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
