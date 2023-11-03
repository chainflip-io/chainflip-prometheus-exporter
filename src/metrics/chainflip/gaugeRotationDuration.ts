import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

enum rotationPhase {
  idle,
  keygensInProgress,
  keyHandoversInProgress,
  activatingKeys,
  newKeysActivated,
  sessionRotating,
}

let currentPhase: rotationPhase = rotationPhase.idle;
const measurement: number[] = [0, 0, 0, 0, 0, 0];

// Is the network rotating? which phase are we in?
const metricName: string = "cf_rotating_phase"
const metricRotationPhase: Gauge = new promClient.Gauge(
    {
        name: metricName,
        help: "Is the Network in a rotation",
        labelNames: ["rotationPhase"],
        registers: []
    })

// Full Rotation duration
const metricNameRotation: string = "cf_rotation_duration";
const metricRotation: Gauge = new promClient.Gauge({
  name: metricNameRotation,
  help: "The duration of a rotation in blocks",
  registers: [],
});

// RotationPhase keygensInProgress duration
const metricNameKeygensInProgress: string = "cf_keygen_in_progress_duration";
const metricKeygensInProgress: Gauge = new promClient.Gauge({
  name: metricNameKeygensInProgress,
  help: "The duration of a RotationPhase keygensInProgress in blocks",
  registers: [],
});

// RotationPhase keyHandoversInProgress duration
const metricNameKeyHandoversInProgress: string =
  "cf_key_handover_in_progress_duration";
const metricKeyHandoversInProgress: Gauge = new promClient.Gauge({
  name: metricNameKeyHandoversInProgress,
  help: "The duration of a RotationPhase keyHandoversInProgress in blocks",
  registers: [],
});

// RotationPhase activatingKeys duration
const metricNameActivatingKeys: string = "cf_activating_keys_duration";
const metricActivatingKeys: Gauge = new promClient.Gauge({
  name: metricNameActivatingKeys,
  help: "The duration of a RotationPhase activatingKeys in blocks",
  registers: [],
});

// RotationPhase newKeysActivated duration
const metricNameNewKeysActivated: string = "cf_new_keys_activated_duration";
const metricNewKeysActivated: Gauge = new promClient.Gauge({
  name: metricNameNewKeysActivated,
  help: "The duration of a RotationPhase newKeysActivated in blocks",
  registers: [],
});

// RotationPhase sessionRotating duration
const metricNameSessionRotating: string = "cf_session_rotating_duration";
const metricSessionRotating: Gauge = new promClient.Gauge({
  name: metricNameSessionRotating,
  help: "The duration of a RotationPhase sessionRotating in blocks",
  registers: [],
});

export const gaugeRotationDuration = async (
  context: Context
): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;

  logger.debug(
    `Scraping ${metricNameRotation}, ${metricNameKeygensInProgress}, ${metricNameKeyHandoversInProgress}, ${metricNameActivatingKeys}, ${metricNameNewKeysActivated}, ${metricNameSessionRotating}`
  );

  if (registry.getSingleMetric(metricNameRotation) === undefined)
    registry.registerMetric(metricRotation);
  if (registry.getSingleMetric(metricNameKeygensInProgress) === undefined)
    registry.registerMetric(metricKeygensInProgress);
  if (registry.getSingleMetric(metricNameKeyHandoversInProgress) === undefined)
    registry.registerMetric(metricKeyHandoversInProgress);
  if (registry.getSingleMetric(metricNameActivatingKeys) === undefined)
    registry.registerMetric(metricActivatingKeys);
  if (registry.getSingleMetric(metricNameNewKeysActivated) === undefined)
    registry.registerMetric(metricNewKeysActivated);
  if (registry.getSingleMetric(metricNameSessionRotating) === undefined)
    registry.registerMetric(metricSessionRotating);
  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metricRotationPhase);
  metricFailure.labels({ metric: "gaugeRotationDuration" }).set(0);

  try {
    const currentRotationPhase: any =
      await api.query.validator.currentRotationPhase();
    const keys: string = Object.keys(currentRotationPhase.toJSON())[0];

    switch (keys) {
        case 'idle':
            if (currentPhase !== rotationPhase.idle) {
                const totalBlocks: number = measurement[rotationPhase.keygensInProgress] +
                    measurement[rotationPhase.keyHandoversInProgress] +
                    measurement[rotationPhase.activatingKeys] +
                    measurement[rotationPhase.newKeysActivated] +
                    measurement[rotationPhase.sessionRotating]
                metricRotation.set(totalBlocks)
                metricKeygensInProgress.set(measurement[rotationPhase.keygensInProgress])
                metricKeyHandoversInProgress.set(measurement[rotationPhase.keyHandoversInProgress])
                metricActivatingKeys.set(measurement[rotationPhase.activatingKeys])
                metricNewKeysActivated.set(measurement[rotationPhase.newKeysActivated])
                metricSessionRotating.set(measurement[rotationPhase.sessionRotating])
                currentPhase = rotationPhase.idle
                measurement[rotationPhase.idle] = 1
                metricRotationPhase.labels({rotationPhase: "keygensInProgress"}).set(0)
                metricRotationPhase.labels({rotationPhase: "keyHandoversInProgress"}).set(0)
                metricRotationPhase.labels({rotationPhase: "activatingKeys"}).set(0)
                metricRotationPhase.labels({rotationPhase: "newKeysActivated"}).set(0)
                metricRotationPhase.labels({rotationPhase: "sessionRotating"}).set(0)
            } else {
                measurement[rotationPhase.idle]++
                metricRotation.set(0)
                metricKeygensInProgress.set(0)
                metricKeyHandoversInProgress.set(0)
                metricActivatingKeys.set(0)
                metricNewKeysActivated.set(0)
                metricSessionRotating.set(0)
            }
            break;
        case 'keygensInProgress':
            if (currentPhase !== rotationPhase.keygensInProgress) {
                measurement[rotationPhase.keygensInProgress] = 1
                currentPhase = rotationPhase.keygensInProgress
                metricRotationPhase.labels({rotationPhase: "keygensInProgress"}).set(1)
                metricRotationPhase.labels({rotationPhase: "keyHandoversInProgress"}).set(0)
                metricRotationPhase.labels({rotationPhase: "activatingKeys"}).set(0)
                metricRotationPhase.labels({rotationPhase: "newKeysActivated"}).set(0)
                metricRotationPhase.labels({rotationPhase: "sessionRotating"}).set(0)
            } else {
                measurement[rotationPhase.keygensInProgress]++
                metricRotationPhase.labels({rotationPhase: "keygensInProgress"}).inc(1)
            }
            break;
        case 'keyHandoversInProgress':
            if (currentPhase !== rotationPhase.keyHandoversInProgress) {
                measurement[rotationPhase.keyHandoversInProgress] = 1
                currentPhase = rotationPhase.keyHandoversInProgress
                metricRotationPhase.labels({rotationPhase: "keygensInProgress"}).set(0)
                metricRotationPhase.labels({rotationPhase: "keyHandoversInProgress"}).set(1)
                metricRotationPhase.labels({rotationPhase: "activatingKeys"}).set(0)
                metricRotationPhase.labels({rotationPhase: "newKeysActivated"}).set(0)
                metricRotationPhase.labels({rotationPhase: "sessionRotating"}).set(0)
            } else {
                measurement[rotationPhase.keyHandoversInProgress]++
                metricRotationPhase.labels({rotationPhase: "keyHandoversInProgress"}).inc(1)
            }
            break;
        case 'activatingKeys':
            if (currentPhase !== rotationPhase.activatingKeys) {
                measurement[rotationPhase.activatingKeys] = 1
                currentPhase = rotationPhase.activatingKeys
                metricRotationPhase.labels({rotationPhase: "keygensInProgress"}).set(0)
                metricRotationPhase.labels({rotationPhase: "keyHandoversInProgress"}).set(0)
                metricRotationPhase.labels({rotationPhase: "activatingKeys"}).set(1)
                metricRotationPhase.labels({rotationPhase: "newKeysActivated"}).set(0)
                metricRotationPhase.labels({rotationPhase: "sessionRotating"}).set(0)
            } else {
                measurement[rotationPhase.activatingKeys]++
                metricRotationPhase.labels({rotationPhase: "activatingKeys"}).inc(1)
            }
            break;
        case 'newKeysActivated':
            if (currentPhase !== rotationPhase.newKeysActivated) {
                measurement[rotationPhase.newKeysActivated] = 1
                currentPhase = rotationPhase.newKeysActivated
                metricRotationPhase.labels({rotationPhase: "keygensInProgress"}).set(0)
                metricRotationPhase.labels({rotationPhase: "keyHandoversInProgress"}).set(0)
                metricRotationPhase.labels({rotationPhase: "activatingKeys"}).set(0)
                metricRotationPhase.labels({rotationPhase: "newKeysActivated"}).set(1)
                metricRotationPhase.labels({rotationPhase: "sessionRotating"}).set(0)
            } else {
                measurement[rotationPhase.newKeysActivated]++
                metricRotationPhase.labels({rotationPhase: "newKeysActivated"}).inc(1)
            }
            break;
        case 'sessionRotating':
            if (currentPhase !== rotationPhase.sessionRotating) {
                measurement[rotationPhase.sessionRotating] = 1
                currentPhase = rotationPhase.sessionRotating
                metricRotationPhase.labels({rotationPhase: "keygensInProgress"}).set(0)
                metricRotationPhase.labels({rotationPhase: "keyHandoversInProgress"}).set(0)
                metricRotationPhase.labels({rotationPhase: "activatingKeys"}).set(0)
                metricRotationPhase.labels({rotationPhase: "newKeysActivated"}).set(0)
                metricRotationPhase.labels({rotationPhase: "sessionRotating"}).set(1)
            } else {
                measurement[rotationPhase.sessionRotating]++
                metricRotationPhase.labels({rotationPhase: "sessionRotating"}).inc(1)
            }
            break;
    }
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: "gaugeRotationDuration" }).set(1);
  }
};
