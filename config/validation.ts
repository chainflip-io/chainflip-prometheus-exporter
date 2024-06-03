import jsonvalidator from 'jsonschema'
import local from './localnet.json'
import schema from './schema.json'

// Localnet
jsonvalidator.validate(local.flip, schema.definitions.FlipConfig, {throwAll: true});

jsonvalidator.validate(local.dot, schema.definitions.DotConfig, {throwAll: true});

jsonvalidator.validate(local.eth, schema.definitions.EthConfig, {throwAll: true});

jsonvalidator.validate(local.btc, schema.definitions.BtcConfig, {throwAll: true});

jsonvalidator.validate(local.arb, schema.definitions.ArbConfig, {throwAll: true});