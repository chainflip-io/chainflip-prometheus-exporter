import { Logger } from 'winston';
import { Registry } from 'prom-client';
import { Context } from './interfaces';
import { BtcConfig, DotConfig, EthConfig, FlipConfig, GithubConfig } from '../config/interfaces';
import { Env } from '../config/getConfig';

const createContext = (
    logger: Logger,
    registry: Registry,
    env: Env,
    config: FlipConfig | BtcConfig | EthConfig | DotConfig | GithubConfig,
): Context => {
    return {
        logger,
        registry,
        env,
        config,
    };
};

export default createContext;
