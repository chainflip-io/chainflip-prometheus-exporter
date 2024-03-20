import { Context } from '../../lib/interfaces';

export const gatherGlobalValues = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;

    try {
        const epoch: any = await api.query.validator.currentEpoch();
        global.epochIndex = Number(epoch);

        const dotAggKeyAddress = await api.query.environment.polkadotVaultAccountId();
        console.log(dotAggKeyAddress.toHuman());
        if (dotAggKeyAddress) {
            global.dotAggKeyAddress = dotAggKeyAddress.toHuman();
        }
    } catch (err) {
        logger.error(err);
    }
};
