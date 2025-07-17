<script lang="ts">
  import { useGeolocation } from '$lib/geolocation';
  import { closestPointOnPolyline, distance, isPointOnPolyline } from '$lib/utils';
  import type { Point } from '$lib/utils';
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
  const MAX_CLOSEST_LINES = 5;

  let manualPosition: Point | null = $state(null);
  const currentPosition = $derived(manualPosition || $position || DEFAULT_POSITION);

  const closestLines = $derived(
    lines
      .map((line) => {
        const coordinates = line.coordinates as Point[];
        const closestPoint = closestPointOnPolyline(coordinates, currentPosition);

        const lineBeforePoint = coordinates.slice(0, closestPoint.segmentIndex + 1);
        const lineAfterPoint = coordinates.slice(closestPoint.segmentIndex + 1);

        const stopBeforePoint =
          line.stopPoints
            .filter((stop) => isPointOnPolyline([stop.latitude, stop.longitude], lineBeforePoint))
            .at(-1) ?? line.stopPoints[0];

        const stopAfterPoint =
          line.stopPoints
            .filter((stop) => isPointOnPolyline([stop.latitude, stop.longitude], lineAfterPoint))
            .at(0) ?? line.stopPoints[line.stopPoints.length - 1];

        return {
          ...line,
          point: closestPoint.point,
          closestStops: [stopBeforePoint, stopAfterPoint],
          distance: closestPoint.distance,
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_CLOSEST_LINES)
  );

  function handlePositionChange(position: Point) {
    manualPosition = position;
  }

  function computeCumulativeDistances(route: [number, number][]): number[] {
    const distances = [0];
    let total = 0;
    for (let i = 1; i < route.length; i++) {
      total += distance(route[i - 1], route[i]);
      distances.push(total);
    }
    return distances;
  }

  function findDistanceAlongRoute(
    route: [number, number][],
    cumulative: number[],
    point: [number, number]
  ): number {
    let closestDist = Infinity;
    let projectedDist = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];

      // Vector projection of point onto segment ab
      const A = [b[0] - a[0], b[1] - a[1]];
      const B = [point[0] - a[0], point[1] - a[1]];
      const A_dot_B = A[0] * B[0] + A[1] * B[1];
      const A_norm_sq = A[0] * A[0] + A[1] * A[1];
      const t = Math.max(0, Math.min(1, A_dot_B / A_norm_sq));

      const proj: [number, number] = [a[0] + t * A[0], a[1] + t * A[1]];

      const dist = distance(point, proj);
      if (dist < closestDist) {
        closestDist = dist;
        const distAlongSegment = distance(a, proj);
        projectedDist = cumulative[i] + distAlongSegment;
      }
    }

    return projectedDist;
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
    projectedPosition: Point;
    previousStop: StopPointApiModel;
    nextStop: StopPointApiModel;
    now?: number;
  }) {
    const cumulative = computeCumulativeDistances(route);

    const distPrev = findDistanceAlongRoute(route, cumulative, [
      previousStop.latitude,
      previousStop.longitude,
    ]);
    const distNext = findDistanceAlongRoute(route, cumulative, [
      nextStop.latitude,
      nextStop.longitude,
    ]);
    const distCurrent = findDistanceAlongRoute(route, cumulative, projectedPosition);

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
      const [stop1] = line.closestStops;

      fetch(`/api/stop-points/${stop1.gid}/arrivals?maxArrivalsPerLineAndDirection=3`)
        .then((res) => res.json())
        .then((arrivalData: ApiResponse<ArrivalApiModel>) => {
          const arrivals = arrivalData.results ?? [];
          const validArrivals = arrivals.filter((r) => r.detailsReference);

          return Promise.all(
            validArrivals.map((arrival) =>
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
            projectedPosition: line.point,
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
        <MapPoint position={line.point} color="#ff0000" radius={4} />

        {#each line.closestStops as stop}
          <MapPoint
            position={[stop.latitude, stop.longitude]}
            color={line.foregroundColor}
            radius={6}
            popup="{line.name} - {stop.name}"
          />
        {/each}
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
