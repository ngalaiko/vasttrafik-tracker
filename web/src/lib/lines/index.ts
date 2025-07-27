import type {
  LineApiModel,
  StopPointApiModel
} from '@vasttrafik-tracker/vasttrafik'
import lines from './lines.json'
import type { Point } from '$lib/utils'

export type Line = LineApiModel & {
  coordinates: Array<Point>
  stopPoints: Array<StopPointApiModel>
}

export default lines as unknown as Line[]
