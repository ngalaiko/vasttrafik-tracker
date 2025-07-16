<script>
  import { useGeolocation } from '$lib/geolocation';
  import { closestPointOnPolyline, distance } from '$lib/utils';
  import { onMount } from 'svelte';

  const { data } = $props();
  const { lines } = data;
  const { position, loading, error } = useGeolocation();

  const DEFAULT_POSITION = { latitude: 57.706924, longitude: 11.966192 }; // Gothenburg
  let manualPosition = $state(null);
  const currentPosition = $derived(manualPosition || $position || DEFAULT_POSITION);

  let mapContainer;
  let map = $state(null);
  let L;
  let positionMarker = null;

  const closestLines = $derived(
    lines
      .map((line) => {
        const closestPoint = closestPointOnPolyline(line.coordinates, [
          currentPosition.latitude,
          currentPosition.longitude,
        ]);

        const closestStops = line.stopPoints
          .map((stop) => ({
            ...stop,
            distance: distance(
              [currentPosition.latitude, currentPosition.longitude],
              [stop.location.lat, stop.location.lon]
            ),
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 2);

        return {
          ...line,
          point: closestPoint.point,
          closestStops: closestStops,
          distance: closestPoint.distance,
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10)
  );

  function createIcon(color) {
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

  onMount(async () => {
    const leaflet = await import('leaflet');
    L = leaflet.default;
    map = L.map(mapContainer).setView([currentPosition.latitude, currentPosition.longitude], 13);
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
      minZoom: 0,
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      ext: 'png',
    }).addTo(map);

    const updateManualPosition = () => {
      const center = map.getCenter();
      manualPosition = {
        latitude: center.lat,
        longitude: center.lng,
      };
    };

    map.on('drag', updateManualPosition);
    map.on('dragend', updateManualPosition);
  });

  // Center map on gps position
  $effect(() => {
    if (!map) return;
    if (!$position) return;
    if (!!manualPosition) return;

    map.setView([$position.latitude, $position.longitude], 15);
  });

  // render current position marker
  $effect(() => {
    if (!map) return;
    if (!currentPosition) return;
    if (positionMarker) {
      map.removeLayer(positionMarker);
    }

    const isGPS = !manualPosition && $position;
    const color = isGPS ? '#00ff00' : '#ff0000';

    positionMarker = L.marker([currentPosition.latitude, currentPosition.longitude], {
      icon: createIcon(color),
    })
      .addTo(map)
      .bindPopup(isGPS ? 'GPS' : 'Manual');
  });

  // render lines
  $effect(() => {
    if (!map) return;
    lines.forEach((line) => {
      const coordinates = line.coordinates.map((coord) => new L.LatLng(coord[0], coord[1]));
      L.polyline(coordinates, {
        color: line.backgroundColor,
        weight: 3,
        opacity: 1,
      })
        .addTo(map)
        .bindPopup(`${line.name}`);
    });
  });

  // render closest points
  $effect(() => {
    if (!map) return;
    if (!closestLines) return;

    if (map.closestPointMarkers) {
      map.closestPointMarkers.forEach((marker) => map.removeLayer(marker));
    }
    map.closestPointMarkers = [];

    closestLines.forEach((line) => {
      const marker = L.circleMarker(line.point, {
        radius: 4,
        fillColor: '#ff0000', // Red for closest points
        color: '#000',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(map);
      map.closestPointMarkers.push(marker);
    });
  });

  // render stops
  $effect(() => {
    if (!map) return;

    if (map.stopMarkers) {
      map.stopMarkers.forEach((marker) => map.removeLayer(marker));
    }
    map.stopMarkers = [];

    closestLines.forEach((line) => {
      line.closestStops.forEach((stop) => {
        const marker = L.circleMarker([stop.location.lat, stop.location.lon], {
          radius: 8,
          fillColor: line.foregroundColor,
          color: '#000',
          weight: 1,
          opacity: 1,
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup(`${line.name} - ${stop.name}`);
        map.stopMarkers.push(marker);
      });
    });
  });

  function formatDistance(distance) {
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  }
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
