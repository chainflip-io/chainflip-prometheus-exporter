import { Context } from '../../lib/interfaces';

export const gaugeEpoch = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;

    try {
        const epoch: any = await api.query.validator.currentEpoch();
        global.epochIndex = Number(epoch);
        console.log(global.epochIndex);
    } catch (err) {
        logger.error(err);
    }
};
