export {
  combine,
  type CombineInput,
  type ScoringDiagnostics,
  type SignalValue
} from './combine'

export { userMotion, type UserMotion, type MovementClass } from './userMotion'

export { projectOntoLine, bearingMatch, type LineProjection } from './lineProximity'

export {
  projectSamples,
  progressSpeed,
  averageLateralDistance,
  lateralDistanceStdDev
} from './lineProgress'

export {
  buildSchedule,
  expectedPosition,
  expectedSpeed,
  speedMatch
} from './schedulePosition'
