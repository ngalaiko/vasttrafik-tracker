<script lang="ts">
  import { Location } from '$lib/location.svelte'
  import { StopPointArrivals } from '$lib/stopPointArrivals.svelte'
  import { JourneyDetails } from '$lib/journeyDetails.svelte'
  import lines from '$lib/lines'
  import {
    closestPointOnPolyline,
    isPointOnPolyline,
    polylineLength
  } from '$lib/utils'
  import type { Point } from '$lib/utils'
  import type {
    ArrivalApiModel,
    JourneyDetailsApiModel,
    StopPointApiModel
  } from '@vasttrafik-tracker/vasttrafik'
  import DisplayMap from '$lib/components/Map.svelte'
  import MapLine from '$lib/components/Line.svelte'
  import MapPoint from '$lib/components/Point.svelte'

  const location = new Location()

  const DEFAULT_COORDINATES: Point = [57.706924, 11.966192] // Gothenburg
  const MAX_LINE_DISTANCE_METERS = 50

  let manualCoordinates: Point | null = $state(null)
  function handlePositionChange(position: Point) {
    manualCoordinates = position
  }

  function roundCoordinates(coords: Point, precision = 0.0001): Point {
    return [
      Math.round(coords[0] / precision) * precision,
      Math.round(coords[1] / precision) * precision
    ]
  }

  const rawCoordinates = $derived(
    manualCoordinates || location.coordinates || DEFAULT_COORDINATES
  )
  
  const currentCoordinates = $derived(
    roundCoordinates(rawCoordinates)
  )

  const allStops = $derived(lines.flatMap(line => line.stopPoints))

  let selectedStops = $state<StopPointApiModel[]>([])
  
  const closestLines = $derived(
    lines
      .map(line => {
        const currentProjection = closestPointOnPolyline(
          line.coordinates,
          currentCoordinates
        )
        return {
          ...line,
          currentProjection,
          distance: currentProjection.distance
        }
      })
      .filter(line => line.distance < MAX_LINE_DISTANCE_METERS)
      .map(line => {
        const segmentAfterCurrentPoint = line.coordinates.slice(
          line.currentProjection.segmentIndex + 1
        )
        const nextStopPoint =
          line.stopPoints
            .filter(stop =>
              isPointOnPolyline(
                [stop.latitude, stop.longitude],
                segmentAfterCurrentPoint
              )
            )
            .at(0) ?? line.stopPoints[line.stopPoints.length - 1]
        return nextStopPoint
      })
      .filter(
        (stopPoint): stopPoint is StopPointApiModel => stopPoint !== undefined
      )
  )

  function stopsEqual(a: StopPointApiModel[], b: StopPointApiModel[]): boolean {
    if (a.length !== b.length) return false
    return a.every((stop, i) => stop.gid === b[i]?.gid)
  }

  $effect(() => {
    if (!stopsEqual(closestLines, selectedStops)) {
      selectedStops = [...closestLines]
    }
  })

  const arrivalCache = new Map<string, StopPointArrivals>()
  const journeyCache = new Map<string, JourneyDetails>()
  
  let stableArrivals = $state<StopPointArrivals[]>([])
  let stableArrivalValues = $state<ArrivalApiModel[]>([])
  let stableJourneyDetails = $state<JourneyDetails[]>([])

  $effect(() => {
    stableArrivals = selectedStops.map(stopPoint => {
      if (!arrivalCache.has(stopPoint.gid)) {
        arrivalCache.set(stopPoint.gid, new StopPointArrivals(stopPoint.gid))
      }
      return arrivalCache.get(stopPoint.gid)!
    })
  })

  $effect(() => {
    stableArrivalValues = stableArrivals
      .flatMap(arrivals => arrivals.value)
      .filter(arrival => arrival.serviceJourney.line.transportMode === 'tram')
      .filter(
        (arrival, i, arrivals) =>
          arrivals.findIndex(
            a => a.detailsReference === arrival.detailsReference
          ) === i
      )
  })

  $effect(() => {
    stableJourneyDetails = stableArrivalValues.map(arrival => {
      if (!journeyCache.has(arrival.detailsReference)) {
        journeyCache.set(arrival.detailsReference, new JourneyDetails(arrival.detailsReference))
      }
      return journeyCache.get(arrival.detailsReference)!
    })
  })

  const arrivalValues = $derived(stableArrivalValues)
  const journeyDetails = $derived(stableJourneyDetails)
  const journeyDetailsValues = $derived(
    journeyDetails
      .flatMap(details => details.value)
      .filter((details): details is JourneyDetailsApiModel => details !== null)
  )

  const arrivalJourneys = $derived(
    arrivalValues
      .map(arrival => {
        const journeyDetails = journeyDetailsValues.find(sj =>
          sj.tripLegs.some(leg =>
            leg.serviceJourneys.some(
              sj => sj.gid === arrival.serviceJourney.gid
            )
          )
        )
        return {
          arrival,
          journeyDetails
        }
      })
      .filter(
        (
          aj
        ): aj is {
          arrival: ArrivalApiModel
          journeyDetails: JourneyDetailsApiModel
        } => aj.journeyDetails !== undefined
      )
  )

  const scored = $derived(
    arrivalJourneys
      .map(({ arrival, journeyDetails }) => {
        return {
          ...arrival,
          score: scoreJourney(journeyDetails, arrival, currentCoordinates)
        }
      })
      .sort((a, b) => {
        if (a === null || b === null) return 0
        return a.score - b.score
      })
  )

  // This function scores a journey based on the current position and the next stop point.
  // lower score means better match.
  function scoreJourney(
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

    if (
      previousStopPoint.estimatedOtherwisePlannedDepartureTime === undefined
    ) {
      throw new Error(
        'Previous stop point has no estimated or planned departure time'
      )
    }
    if (nextStopPoint.estimatedOtherwisePlannedArrivalTime === undefined) {
      throw new Error(
        'Next stop point has no estimated or planned arrival time'
      )
    }

    const departureTime = new Date(
      previousStopPoint.estimatedOtherwisePlannedDepartureTime
    ).getTime()
    const arrivalTime = new Date(
      nextStopPoint.estimatedOtherwisePlannedArrivalTime
    ).getTime()
    const estimatedTime =
      departureTime + currentProgress * (arrivalTime - departureTime)
    const errorMs = Math.abs(Date.now() - estimatedTime)

    return errorMs
  }
</script>

<div class="container">
  <div class="map-container">
    <DisplayMap center={currentCoordinates } onPositionChange={handlePositionChange}>
      {#each lines as line }
        <MapLine
          coordinates={line.coordinates as Point[]}
          color={line.backgroundColor}
          name={line.name}
        />
      {/each}

      {#each allStops as stop}
        <MapPoint
          position={[stop.latitude, stop.longitude]}
          color="#0000ff"
          radius={3}
          popup={stop.name}
        />
      {/each}

      <MapPoint
        position={currentCoordinates}
        color={!manualCoordinates && currentCoordinates ? '#00ff00' : '#ff0000'}
        icon="marker"
        popup={!manualCoordinates && currentCoordinates ? 'GPS' : 'Manual'}
      />
    </DisplayMap>
  </div>

  <div class="sidebar">
    {#if scored === null}
      <div class="loading">Loading...</div>
    {:else if scored.length === 0}
      <div class="no-results">You are not on a bus</div>
    {:else}
      <h3>You are most likely on:</h3>
      <div class="journey-list">
        {#each scored.slice(0, 5) as journey (journey.serviceJourney.gid)}
          <div class="journey-item">
            <div class="journey-header">
              <span class="line-name">{journey.serviceJourney.line.name}</span>
            </div>
            <div class="journey-details">
              <div>ID: {journey.serviceJourney.gid}</div>
              <div>Next: {journey.stopPoint.name}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .container {
    display: flex;
    font-family: monospace;
    font-size: 12px;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  .map-container {
    flex: 1;
    position: relative;
    min-width: 0;
  }

  .sidebar {
    width: 100%;
    max-width: 300px;
    background: #fff;
    border-left: 2px solid #000;
    padding: 8px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    box-sizing: border-box;
  }

  h3 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: bold;
  }

  .loading,
  .no-results {
    padding: 8px 0;
  }

  .journey-item {
    border: 1px solid #000;
    padding: 8px;
    margin-bottom: 4px;
    background: #fff;
  }

  .journey-item:active {
    background: #f0f0f0;
  }

  .journey-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .line-name {
    font-weight: bold;
  }

  .journey-details {
    font-size: 12px;
  }

  @media (max-width: 768px) {
    .container {
      flex-direction: column;
    }

    .map-container {
      flex: 1;
      height: 60vh;
      height: 60dvh;
    }

    .sidebar {
      width: 100%;
      max-width: none;
      height: 40vh;
      height: 40dvh;
      border-left: none;
      border-top: 2px solid #000;
      padding: 12px;
    }

    .journey-item {
      padding: 12px;
      margin-bottom: 8px;
    }

    .journey-header {
      margin-bottom: 8px;
    }
  }

  @media (max-width: 375px) {
    .sidebar {
      padding: 8px;
    }

    .journey-item {
      padding: 8px;
    }
  }

  @supports (padding: max(0px)) {
    .container {
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
    }

    .sidebar {
      padding-bottom: calc(8px + env(safe-area-inset-bottom));
    }
  }
</style>
