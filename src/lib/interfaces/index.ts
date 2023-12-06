import { Registry } from 'prom-client';
import { Logger } from 'winston';
import { BtcConfig, DotConfig, EthConfig, FlipConfig, GithubConfig } from '../../config/interfaces';

export interface Context {
    logger: Logger;
    registry: Registry;
    config: FlipConfig | BtcConfig | EthConfig | DotConfig | GithubConfig;

    [key: string]: any;
}
