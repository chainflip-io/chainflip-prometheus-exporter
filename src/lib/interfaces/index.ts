import { Registry } from 'prom-client';
import { Logger } from 'winston';
import { ChainConfig } from '../../config/interfaces';

export interface Context {
    logger: Logger;
    registry: Registry;
    config: ChainConfig;

    [key: string]: any;
}
