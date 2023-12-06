import promClient, { Counter } from 'prom-client';
import { Context } from '../../lib/interfaces';

enum rotationPhase {
    idle,
    keygensInProgress,
    keyHandoversInProgress,
    activatingKeys,
    newKeysActivated,
    sessionRotating,
}

let currentPhase: rotationPhase = rotationPhase.idle;

// PhaseRotationDuration
const metricName: string = 'cf_rotation_phase_duration';
const metricRotationPhase: Counter = new promClient.Counter({
    name: metricName,
    help: 'Is the Network in a rotation',
    labelNames: ['rotationPhase'],
    registers: [],
});

// Full Rotation duration
const metricNameRotation: string = 'cf_rotation_duration';
const metricRotationDuration: Counter = new promClient.Counter({
    name: metricNameRotation,
    help: 'The duration of a rotation in blocks',
    registers: [],
});

export const gaugeRotationDuration = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;

    logger.debug(`Scraping ${metricNameRotation}, ${metricName}`);

    if (registry.getSingleMetric(metricNameRotation) === undefined)
        registry.registerMetric(metricRotationDuration);
    if (registry.getSingleMetric(metricName) === undefined)
        registry.registerMetric(metricRotationPhase);
    metricFailure.labels({ metric: 'gaugeRotationDuration' }).set(0);

    try {
        const currentRotationPhase: any = await api.query.validator.currentRotationPhase();
        const keys: string = Object.keys(currentRotationPhase.toJSON())[0];

        switch (keys) {
            case 'idle':
                if (currentPhase !== rotationPhase.idle) {
                    currentPhase = rotationPhase.idle;
                    metricRotationDuration.reset();
                    metricRotationPhase.reset();
                }
                break;
            case 'keygensInProgress':
                if (currentPhase !== rotationPhase.keygensInProgress) {
                    currentPhase = rotationPhase.keygensInProgress;
                }
                metricRotationPhase.labels({ rotationPhase: 'keygensInProgress' }).inc();
                metricRotationDuration.inc();
                break;
            case 'keyHandoversInProgress':
                if (currentPhase !== rotationPhase.keyHandoversInProgress) {
                    currentPhase = rotationPhase.keyHandoversInProgress;
                }
                metricRotationPhase.labels({ rotationPhase: 'keyHandoversInProgress' }).inc();
                metricRotationDuration.inc();
                break;
            case 'activatingKeys':
                if (currentPhase !== rotationPhase.activatingKeys) {
                    currentPhase = rotationPhase.activatingKeys;
                }
                metricRotationPhase.labels({ rotationPhase: 'activatingKeys' }).inc();
                metricRotationDuration.inc();
                break;
            case 'newKeysActivated':
                if (currentPhase !== rotationPhase.newKeysActivated) {
                    currentPhase = rotationPhase.newKeysActivated;
                }
                metricRotationPhase.labels({ rotationPhase: 'newKeysActivated' }).inc();
                metricRotationDuration.inc();
                break;
            case 'sessionRotating':
                if (currentPhase !== rotationPhase.sessionRotating) {
                    currentPhase = rotationPhase.sessionRotating;
                }
                metricRotationPhase.labels({ rotationPhase: 'sessionRotating' }).inc();
                metricRotationDuration.inc();
                break;
        }
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: 'gaugeRotationDuration' }).set(1);
    }
};
