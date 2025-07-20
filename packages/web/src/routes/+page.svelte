<script lang="ts">
  import { useGeolocation } from '$lib/geolocation';
  import { closestPointOnPolyline, distanceM, isPointOnPolyline } from '$lib/utils';
  import { stopPointArrivals, journeyDetails } from '$lib/api';
  import type { Point } from '$lib/utils';
  import type {
    ServiceJourneyApiModel,
    ServiceJourneyDetailsApiModel,
    StopPointApiModel,
  } from '@vasttrafik-tracker/vasttrafik';
  import Map from '$lib/components/Map.svelte';
  import MapLine from '$lib/components/Line.svelte';
  import MapPoint from '$lib/components/Point.svelte';
  const { position } = useGeolocation();

  const DEFAULT_POSITION: Point = [57.706924, 11.966192]; // Gothenburg
  const MAX_LINE_DISTANCE_METERS = 50;

  let manualPosition: Point | null = $state(null);
  const currentPosition = $derived(manualPosition || $position || DEFAULT_POSITION);

  const { data } = $props();
  const { lines } = data;

  const closestLines = $derived(
    lines
      .map((line) => {
        const coordinates = line.coordinates as Point[];
        const currentProjection = closestPointOnPolyline(coordinates, currentPosition);

        const segmentAfterCurrentPoint = coordinates.slice(currentProjection.segmentIndex + 1);

        const nextStopPoint =
          line.stopPoints
            .filter((stop) =>
              isPointOnPolyline([stop.latitude, stop.longitude], segmentAfterCurrentPoint)
            )
            .at(0) ?? line.stopPoints[line.stopPoints.length - 1];

        return {
          ...line,
          currentProjection,
          nextStopPoint,
          distance: currentProjection.distance,
        };
      })
      .filter((line) => line.distance < MAX_LINE_DISTANCE_METERS)
      .sort((a, b) => a.distance - b.distance)
  );

  function handlePositionChange(position: Point) {
    manualPosition = position;
  }

  // This function scores a journey based on the current position and the next stop point.
  // lower score means better match.
  function scoreJourney(
    journey: ServiceJourneyDetailsApiModel,
    nextStop: StopPointApiModel,
    currentPosition: Point
  ) {
    if (!journey.callsOnServiceJourney || journey.callsOnServiceJourney.length === 0) {
      throw new Error('Journey has no valid calls');
    }
    if (!journey.serviceJourneyCoordinates || journey.serviceJourneyCoordinates.length === 0) {
      throw new Error('Journey has no valid coordinates');
    }
    const nextJourneyStopPointIndex = journey.callsOnServiceJourney.findIndex(
      (call) => call.stopPoint.gid === nextStop.gid
    );
    if (nextJourneyStopPointIndex === -1) {
      throw new Error('Next stop point not found in journey calls');
    }
    const previousStopPoint = journey.callsOnServiceJourney[nextJourneyStopPointIndex - 1];
    const nextStopPoint = journey.callsOnServiceJourney[nextJourneyStopPointIndex];

    const coordinates = journey.serviceJourneyCoordinates.map(
      (coord): Point => [coord.latitude, coord.longitude]
    );

    const lineLength = coordinates.reduce((acc, point, index) => {
      if (index === 0) return acc;
      const prevPoint = coordinates[index - 1];
      return acc + distanceM(prevPoint, point);
    }, 0);

    const projectedPosition = closestPointOnPolyline(coordinates, currentPosition);
    if (projectedPosition === null) {
      console.log(coordinates, currentPosition, journey.serviceJourneyCoordinates);
      throw new Error('Projected position is null, likely due to being outside the segment');
    }
    const completedSegment = [
      ...coordinates.slice(0, projectedPosition.segmentIndex + 1),
      projectedPosition.point,
    ];
    const completedSegmentLength = completedSegment.reduce((acc, point, index) => {
      if (index === 0) return acc;
      const prevPoint = completedSegment[index - 1];
      return acc + distanceM(prevPoint, point);
    }, 0);

    const lengthProgress = completedSegmentLength / lineLength;

    if (previousStopPoint.estimatedOtherwisePlannedDepartureTime === undefined) {
      throw new Error('Previous stop point has no estimated or planned departure time');
    }
    if (nextStopPoint.estimatedOtherwisePlannedArrivalTime === undefined) {
      throw new Error('Next stop point has no estimated or planned arrival time');
    }

    const departureTime = new Date(
      previousStopPoint.estimatedOtherwisePlannedDepartureTime
    ).getTime();
    const arrivalTime = new Date(nextStopPoint.estimatedOtherwisePlannedArrivalTime).getTime();
    const estimatedTime = departureTime + lengthProgress * (arrivalTime - departureTime);
    const errorMs = Math.abs(Date.now() - estimatedTime);

    return errorMs;
  }

  let scored = $derived<(ServiceJourneyApiModel & { nextStop: StopPointApiModel })[] | null>(null);
  $effect(() => {
    Promise.all(
      closestLines.map((line) =>
        stopPointArrivals(line.nextStopPoint.gid, { maxArrivalsPerLineAndDirection: 1 }).then(
          (res) => {
            const arrivals = res.results ?? [];
            return Promise.all(
              arrivals.map((arrival) =>
                journeyDetails(arrival.detailsReference).then((details) => ({
                  ...arrival.serviceJourney,
                  callsOnServiceJourney: details.tripLegs.at(0)?.callsOnTripLeg ?? [],
                  nextStop: line.nextStopPoint,
                  serviceJourneyCoordinates: line.coordinates.map((point) => ({
                    latitude: point[0],
                    longitude: point[1],
                  })),
                }))
              )
            );
          }
        )
      )
    )
      .then((journeys) => journeys.flat())
      .then((journeys) => journeys.filter((journey) => journey.line.transportMode === 'tram'))
      .then((journeys) => {
        scored = journeys
          .map((journey) => ({
            ...journey,
            score: scoreJourney(journey, journey.nextStop, currentPosition),
          }))
          .sort((a, b) => a.score - b.score);
      });
  });
</script>

<div class="container">
  <div class="map-container">
    <Map center={currentPosition} onPositionChange={handlePositionChange}>
      {#each lines as line}
        <MapLine
          coordinates={line.coordinates as Point[]}
          color={line.backgroundColor}
          name={line.name}
        />
      {/each}

      <MapPoint
        position={currentPosition}
        color={!manualPosition && $position ? '#00ff00' : '#ff0000'}
        icon="marker"
        popup={!manualPosition && $position ? 'GPS' : 'Manual'}
      />

      {#each closestLines as line}
        <MapPoint position={line.currentProjection.point} color="#ff0000" radius={4} />
      {/each}
    </Map>
  </div>

  <div class="sidebar">
    {#if scored === null}
      <div class="loading">Loading...</div>
    {:else if scored.length === 0}
      <div class="no-results">You are not on a bus</div>
    {:else}
      <h3>You are most likely on:</h3>
      <div class="journey-list">
        {#each scored.slice(0, 5) as journey}
          <div class="journey-item">
            <div class="journey-header">
              <span class="line-name">{journey.line.name}</span>
            </div>
            <div class="journey-details">
              <div>Next: {journey.nextStop.name}</div>
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
