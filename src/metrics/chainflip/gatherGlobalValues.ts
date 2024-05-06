import { Context } from '../../lib/interfaces';

export const gatherGlobalValues = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;

    try {
        const epoch: any = await api.query.validator.currentEpoch();
        global.epochIndex = Number(epoch);

        const epochKey = await api.query.polkadotThresholdSigner.currentKeyEpoch();
        const dotAggKeyAddress = await api.query.polkadotThresholdSigner.keys(epochKey.toJSON());

        if (dotAggKeyAddress) {
            global.dotAggKeyAddress = dotAggKeyAddress.toJSON();
        }
    } catch (err) {
        logger.error(err);
    }
};
