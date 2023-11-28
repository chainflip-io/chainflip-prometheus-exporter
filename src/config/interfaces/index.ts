interface ConfigBase {
  enabled: boolean;
  network: string;
}

export interface GithubConfig {
  enabled: boolean,
  repositories: GitHubRepo[]
}

interface GitHubRepo {
  owner: string;
  repo: string;
}

interface FlipConfigAccount {
  alias: string;
  ss58Adress: string;
}

interface SkipEvent {
  section: string;
  method: string;
}

interface EthConfigContract {
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
  contracts: EthConfigContract[];
  wallets: ConfigWallet[];
  tokens: ConfigToken[];
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
  github: GithubConfig;
}

export enum Network {
  Perseverance = "perseverance",
  Sisyphos = "sisyphos",
  Localnet = "localnet",
}
