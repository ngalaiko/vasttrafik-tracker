import type {
  Line as ApiLine,
  StopPoint
} from '@vasttrafik-tracker/vasttrafik'
import lines from './lines.json'
import type { Point } from '$lib/utils'

export type Line = ApiLine & {
  coordinates: Array<Point>
  stopPoints: Array<StopPoint>
}

export default lines as unknown as Line[]
