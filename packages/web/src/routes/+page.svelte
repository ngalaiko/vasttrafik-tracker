<script lang="ts">
  import { useGeolocation } from '$lib/geolocation';
  import { closestPointOnPolyline, distanceM, isPointOnPolyline } from '$lib/utils';
  import type { ClosestPoint, Point } from '$lib/utils';
  import type {
    ApiResponse,
    ArrivalApiModel,
    CallApiModel,
    JourneyDetailsApiModel,
    ServiceJourneyDetailsApiModel,
    StopPointApiModel,
  } from '@vasttrafik-tracker/vasttrafik';
  import Map from '$lib/components/Map.svelte';
  import MapLine from '$lib/components/Line.svelte';
  import MapPoint from '$lib/components/Point.svelte';

  const { data } = $props();
  const { lines } = data;
  const { position } = useGeolocation();

  const DEFAULT_POSITION: Point = [57.706924, 11.966192]; // Gothenburg
  const MAX_CLOSEST_LINES = 1;

  let manualPosition: Point | null = $state(null);
  const currentPosition = $derived(manualPosition || $position || DEFAULT_POSITION);

  const closestLines = $derived(
    lines
      .map((line) => {
        const coordinates = line.coordinates as Point[];
        const currentProjection = closestPointOnPolyline(coordinates, currentPosition);

        const lineBeforePoint = coordinates.slice(0, currentProjection.segmentIndex + 1);
        const lineAfterPoint = coordinates.slice(currentProjection.segmentIndex + 1);

        const left =
          line.stopPoints
            .filter((stop) => isPointOnPolyline([stop.latitude, stop.longitude], lineBeforePoint))
            .at(-1) ?? line.stopPoints[0];

        const right =
          line.stopPoints
            .filter((stop) => isPointOnPolyline([stop.latitude, stop.longitude], lineAfterPoint))
            .at(0) ?? line.stopPoints[line.stopPoints.length - 1];

        return {
          ...line,
          currentProjection,
          closestStops: [left, right],
          distance: currentProjection.distance,
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_CLOSEST_LINES)
  );

  function handlePositionChange(position: Point) {
    manualPosition = position;
  }

  export function inferLikelyServiceJourney({
    journeys,
    route,
    projectedPosition,
    previousStop,
    nextStop,
    now = Date.now(),
  }: {
    journeys: Array<ServiceJourneyDetailsApiModel & { callsOnTripLeg: CallApiModel[] }>;
    route: Point[];
    projectedPosition: ClosestPoint;
    previousStop: StopPointApiModel;
    nextStop: StopPointApiModel;
    now?: number;
  }) {
    const cumulative = route.reduce((acc, point, index) => {
      if (index === 0) return [0];
      const prevPoint = route[index - 1];
      acc.push(acc[index - 1] + distanceM(prevPoint, point));
      return acc;
    }, [] as number[]);

    const prev = closestPointOnPolyline(route, [previousStop.latitude, previousStop.longitude]);
    const distPrev =
      cumulative[prev.segmentIndex] + distanceM(route[prev.segmentIndex], prev.point);

    const next = closestPointOnPolyline(route, [nextStop.latitude, nextStop.longitude]);
    const distNext =
      cumulative[next.segmentIndex] + distanceM(route[next.segmentIndex], next.point);

    const distCurrent =
      cumulative[projectedPosition.segmentIndex] +
      distanceM(route[projectedPosition.segmentIndex], projectedPosition.point);

    const progress = Math.min(1, Math.max(0, (distCurrent - distPrev) / (distNext - distPrev)));

    const scored: Array<
      ServiceJourneyDetailsApiModel & {
        errorMs: number;
      }
    > = [];

    for (const journey of journeys) {
      const calls = journey.callsOnTripLeg;
      if (!Array.isArray(calls) || calls.length < 2) continue;

      const prev = calls.find((c) => c.stopPoint.gid === previousStop.gid);
      const next = calls.find((c) => c.stopPoint.gid === nextStop.gid);
      if (!prev || !next) continue;

      if (
        !prev.estimatedOtherwisePlannedDepartureTime ||
        !next.estimatedOtherwisePlannedArrivalTime
      )
        continue;
      const depTime = new Date(prev.estimatedOtherwisePlannedDepartureTime).getTime();
      const arrTime = new Date(next.estimatedOtherwisePlannedArrivalTime).getTime();

      const est = depTime + progress * (arrTime - depTime);
      const errorMs = Math.abs(now - est);

      scored.push({ ...journey, errorMs });
    }

    return scored.sort((a, b) => a.errorMs - b.errorMs).at(0);
  }

  $effect(() => {
    closestLines.forEach((line) => {
      const coordinates = line.coordinates as Point[];
      const [left, _] = line.closestStops;

	  // todo; handle right stop

      fetch(`/api/stop-points/${left.gid}/arrivals?maxArrivalsPerLineAndDirection=3`)
        .then((res) => res.json())
        .then((arrivalData: ApiResponse<ArrivalApiModel>) => {
          const arrivals = arrivalData.results ?? [];
          return Promise.all(
            arrivals.map((arrival) =>
              fetch(`/api/journeys/${arrival.detailsReference}/details`)
                .then((res) => res.json())
                .then((details: JourneyDetailsApiModel) => ({
                  ...arrival.serviceJourney,
                  callsOnTripLeg: details.tripLegs.at(0)?.callsOnTripLeg ?? [],
                }))
            )
          );
        })
        .then((journeys) => {
          const result = inferLikelyServiceJourney({
            journeys,
            route: coordinates,
            projectedPosition: line.currentProjection,
            previousStop: line.closestStops[0],
            nextStop: line.closestStops[1],
          });

          if (result) {
            console.log(result);
          }
        });
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
</div>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
  }

  .container {
    display: flex;
    font-family: monospace;
    font-size: 12px;
  }

  .map-container {
    flex: 1;
    height: 100vh;
    position: relative;
  }
</style>
