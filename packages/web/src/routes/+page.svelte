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
  import { onMount } from 'svelte';
  import type Leaflet from 'leaflet';
  import type { Map } from 'leaflet';

  const { data } = $props();
  const { lines } = data;
  const { position } = useGeolocation();

  const DEFAULT_POSITION: Point = [57.706924, 11.966192]; // Gothenburg
  const MAX_CLOSEST_LINES = 5;

  let manualPosition: Point | null = $state(null);
  const currentPosition = $derived(manualPosition || $position || DEFAULT_POSITION);

  let mapContainer: HTMLElement | null = null;
  let map: Map | null = $state(null);
  let L: typeof Leaflet | null = null;
  let positionMarker: Leaflet.Marker | null = null;

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

  onMount(async () => {
    if (!mapContainer) return;

    const leaflet = await import('leaflet');
    L = leaflet.default;
    map = L.map(mapContainer).setView(currentPosition, 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: `&copy;<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>,
		    &copy;<a href="https://carto.com/attributions" target="_blank">CARTO</a>`,
      subdomains: 'abcd',
      maxZoom: 16,
    }).addTo(map);

    const updateManualPosition = () => {
      if (!map) return;
      const center = map.getCenter();
      manualPosition = [center.lat, center.lng];
    };

    map.on('drag', updateManualPosition);
    map.on('dragend', updateManualPosition);
  });

  // Center map on gps position
  $effect(() => {
    if (!map) return;
    if (!$position) return;
    if (manualPosition) return;

    map.setView($position, 15);
  });

  // render current position marker
  $effect(() => {
    if (!map) return;
    if (!currentPosition) return;
    if (!L) return;
    if (positionMarker) {
      map.removeLayer(positionMarker);
    }

    function createIcon(color: string): Leaflet.Icon {
      if (!L) {
        throw new Error('Leaflet is not loaded');
      }
      const svgIcon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="10" cy="10" r="8" fill="${color}" stroke="#000" stroke-width="2"/>
			<circle cx="10" cy="10" r="3" fill="#000"/>
		</svg>`;
      const iconUrl = `data:image/svg+xml;base64,${btoa(svgIcon)}`;

      return L.icon({
        iconUrl,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    }

    const isGPS = !manualPosition && $position;
    const color = isGPS ? '#00ff00' : '#ff0000';

    positionMarker = L.marker(currentPosition, {
      icon: createIcon(color),
    })
      .addTo(map)
      .bindPopup(isGPS ? 'GPS' : 'Manual');
  });

  // render lines
  $effect(() => {
    if (!map) return;
    if (!L) return;
    for (const line of lines) {
      const latlngs = [];
      for (const coord of line.coordinates) {
        latlngs.push(new L.LatLng(coord[0], coord[1]));
      }
      L.polyline(latlngs, {
        color: line.backgroundColor,
        weight: 3,
        opacity: 1,
      })
        .addTo(map)
        .bindPopup(`${line.name}`);
    }
  });

  // render closest points
  let closestPointMarkers: Leaflet.CircleMarker[] = [];
  $effect(() => {
    if (!map) return;
    if (!L) return;

    for (const marker of closestPointMarkers || []) {
      map.removeLayer(marker);
    }
    closestPointMarkers = [];

    for (const line of closestLines) {
      const marker = L.circleMarker(line.point, {
        radius: 4,
        fillColor: '#ff0000', // Red for closest points
        color: '#000',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(map);
      closestPointMarkers.push(marker);
    }
  });

  // render stops
  let stopMarkers: Leaflet.CircleMarker[] = [];
  $effect(() => {
    if (!L) return;
    if (!map) return;

    for (const marker of stopMarkers) {
      map.removeLayer(marker);
    }
    stopMarkers = [];

    for (const line of closestLines) {
      for (const stop of line.closestStops) {
        const marker = L.circleMarker([stop.latitude, stop.longitude], {
          radius: 6,
          fillColor: line.foregroundColor,
          color: '#000',
          weight: 1,
          opacity: 1,
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup(`${line.name} - ${stop.name}`);
        stopMarkers.push(marker);
      }
    }
  });

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

      if (!prev.estimatedOtherwisePlannedDepartureTime || !next.estimatedOtherwisePlannedArrivalTime) continue;
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
					  console.log(result)
				  }

        });
    });
  });
</script>

<svelte:head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="container">
  <div class="map-container">
    <div bind:this={mapContainer} class="map"></div>
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

  .map {
    width: 100%;
    height: 100%;
  }
</style>
