import { Registry } from 'prom-client';
import { Logger } from 'winston';
import { ArbConfig, BtcConfig, DotConfig, EthConfig, FlipConfig } from '../../config/interfaces';

export interface Context {
    logger: Logger;
    registry: Registry;
    config: FlipConfig | BtcConfig | EthConfig | DotConfig | ArbConfig;

    [key: string]: any;
}
