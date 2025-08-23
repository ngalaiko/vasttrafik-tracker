import type { Point } from '$lib/utils'
import type {
  ArrivalApiModel,
  JourneyDetailsApiModel
} from '@vasttrafik-tracker/vasttrafik'
import { closestPointOnPolyline, polylineLength } from '$lib/utils'

export function scoreJourney(
  journey: JourneyDetailsApiModel,
  arrival: ArrivalApiModel,
  currentPosition: Point
) {
  const tripLeg = journey.tripLegs.at(-1)
  if (!tripLeg) return Infinity
  const nextJourneyStopPointIndex = tripLeg.callsOnTripLeg.findIndex(
    call => call.stopPoint.gid === arrival.stopPoint.gid
  )
  if (nextJourneyStopPointIndex === -1) {
    throw new Error('Next stop point not found in journey calls')
  }
  const previousStopPoint = tripLeg.callsOnTripLeg.at(
    nextJourneyStopPointIndex - 1
  )
  if (!previousStopPoint) return Infinity
  const nextStopPoint = tripLeg.callsOnTripLeg.at(nextJourneyStopPointIndex)
  if (!nextStopPoint) return Infinity

  if (!tripLeg.tripLegCoordinates) return Infinity
  const coordinates = tripLeg.tripLegCoordinates.map(
    (point): Point => [point.latitude, point.longitude]
  )

  const prevStopProjection = closestPointOnPolyline(coordinates, [
    previousStopPoint.stopPoint.latitude,
    previousStopPoint.stopPoint.longitude
  ])

  const nextStopProjection = closestPointOnPolyline(coordinates, [
    arrival.stopPoint.latitude,
    arrival.stopPoint.longitude
  ])

  const prevToNextSegment = [
    ...coordinates.slice(
      prevStopProjection.segmentIndex + 1,
      nextStopProjection.segmentIndex + 1
    ),
    nextStopProjection.point
  ]

  const currentProjection = closestPointOnPolyline(
    prevToNextSegment,
    currentPosition
  )

  const prevToCurrentSegment = [
    ...prevToNextSegment.slice(0, currentProjection.segmentIndex + 1),
    currentProjection.point
  ]

  const prevToNextSegmentLength = polylineLength(prevToNextSegment)
  const prevToCurrentSegmentLength = polylineLength(prevToCurrentSegment)
  const currentProgress = prevToCurrentSegmentLength / prevToNextSegmentLength

  if (previousStopPoint.estimatedOtherwisePlannedDepartureTime === undefined) {
    throw new Error(
      'Previous stop point has no estimated or planned departure time'
    )
  }
  if (nextStopPoint.estimatedOtherwisePlannedArrivalTime === undefined) {
    throw new Error('Next stop point has no estimated or planned arrival time')
  }

  const departureTime = Date.parse(
    previousStopPoint.estimatedOtherwisePlannedDepartureTime
  )
  const arrivalTime = Date.parse(
    nextStopPoint.estimatedOtherwisePlannedArrivalTime
  )
  const estimatedTime =
    departureTime + currentProgress * (arrivalTime - departureTime)
  const errorMs = Math.abs(Date.now() - estimatedTime)

  return errorMs
}

export function useJourneyScoring(
  arrivalJourneys: () => Array<{
    arrival: ArrivalApiModel
    journeyDetails: JourneyDetailsApiModel
  }>,
  currentPosition: () => Point
) {
  const scored = $derived.by(() => {
    return arrivalJourneys()
      .map(({ arrival, journeyDetails }) => {
        return {
          ...arrival,
          score: scoreJourney(journeyDetails, arrival, currentPosition())
        }
      })
      .sort((a, b) => {
        if (a === null || b === null) return 0
        return a.score - b.score
      })
  })

  return {
    get scored() {
      return scored
    }
  }
}
