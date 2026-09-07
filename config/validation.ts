import jsonvalidator from 'jsonschema';
import berghain from './berghain.json';
import localnet from './localnet.json';
import schema from './schema.json';
import sisyphos from './sisyphos.json';

for (const config of [localnet, sisyphos, berghain]) {
    jsonvalidator.validate(config.flip, schema.definitions.FlipConfig, { throwAll: true });

    jsonvalidator.validate(config.hub, schema.definitions.HubConfig, { throwAll: true });

    jsonvalidator.validate(config.eth, schema.definitions.EthConfig, { throwAll: true });

    jsonvalidator.validate(config.btc, schema.definitions.BtcConfig, { throwAll: true });

    jsonvalidator.validate(config.arb, schema.definitions.ArbConfig, { throwAll: true });

    jsonvalidator.validate(config.bsc, schema.definitions.BscConfig, { throwAll: true });

    jsonvalidator.validate(config.sol, schema.definitions.SolConfig, { throwAll: true });

    jsonvalidator.validate(config.tron, schema.definitions.TronConfig, { throwAll: true });
}
