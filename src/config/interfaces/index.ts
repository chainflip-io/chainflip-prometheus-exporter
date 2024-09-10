interface ConfigBase {
    enabled: boolean;
    network: string;
    skipMetrics: string[];
}

interface FlipConfigAccount {
    alias: string;
    ss58Address: string;
}

interface SkipEvent {
    section: string;
    method: string;
}

interface ConfigContract {
    alias: string;
    address: string;
}

interface ConfigWallet {
    alias: string;
    address: string;
}

interface ConfigToken {
    symbol: string;
    address: string;
}

export interface EthConfig extends ConfigBase {
    defaultMetrics: DefaultMetrics[];
    network: string;
    networkId: number;
    contracts: ConfigContract[];
    wallets: ConfigWallet[];
    tokens: ConfigToken[];
}

export interface ArbConfig extends ConfigBase {
    defaultMetrics: DefaultMetrics[];
    network: string;
    networkId: number;
    contracts: ConfigContract[];
    wallets: ConfigWallet[];
}

export interface SolConfig extends ConfigBase {
    defaultMetrics: DefaultMetrics[];
    network: string;
    contracts: ConfigContract[];
    wallets: ConfigWallet[];
}

export interface BtcConfig extends ConfigBase {
    wallets: ConfigWallet[];
    defaultMetrics: DefaultMetrics[];
}

interface DotAccountConfig {
    alias: string;
    publicKey: any;
}

export interface DotConfig extends ConfigBase {
    defaultMetrics: DefaultMetrics[];
    accounts: DotAccountConfig[];
}

interface DefaultMetrics {
    name: string;
    value: number;
}

export interface FlipConfig extends ConfigBase {
    defaultMetrics: DefaultMetrics[];
    accounts: FlipConfigAccount[];
    skipEvents: SkipEvent[];
    eventLog: boolean;
}

export interface Config {
    eth: EthConfig;
    btc: BtcConfig;
    dot: DotConfig;
    flip: FlipConfig;
    arb: ArbConfig;
    sol: SolConfig;
}

export enum Network {
    Perseverance = 'perseverance',
    Sisyphos = 'sisyphos',
    Localnet = 'localnet',
}
