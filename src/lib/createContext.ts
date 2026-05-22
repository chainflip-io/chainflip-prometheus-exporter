import { Logger } from 'winston';
import { Registry } from 'prom-client';
import { Context } from './interfaces';
import { ChainConfig } from '../config/interfaces';
import { Env } from '../config/getConfig';

const createContext = (
    logger: Logger,
    registry: Registry,
    env: Env,
    config: ChainConfig,
): Context => {
    return {
        logger,
        registry,
        env,
        config,
    };
};

export default createContext;
