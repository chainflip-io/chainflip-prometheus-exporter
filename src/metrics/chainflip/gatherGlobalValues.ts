import { Context } from '../../lib/interfaces';

export const gatherGlobalValues = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;

    try {
        const epoch: any = await api.query.validator.currentEpoch();
        global.epochIndex = Number(epoch);

        const dotVaultEpoch: any = await api.query.polkadotVault.currentVaultEpoch();
        global.dotVaultEpochIndex = Number(dotVaultEpoch);

        const dotAggKeyAddress = await api.query.polkadotVault.vaults(Number(dotVaultEpoch));
        if(dotAggKeyAddress) {
            global.dotAggKeyAddress = dotAggKeyAddress.toHuman().publicKey;
        }
    } catch (err) {
        logger.error(err);
    }
};
