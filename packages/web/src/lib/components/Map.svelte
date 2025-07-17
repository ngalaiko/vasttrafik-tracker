<script lang="ts">
  import type { Point } from '$lib/utils';
  import type Leaflet from 'leaflet';
  import type { Map } from 'leaflet';
  import { onMount, setContext } from 'svelte';

  const {
    center = [57.706924, 11.966192] as Point,
    zoom = 13,
    onPositionChange,
    children,
  } = $props<{
    center?: Point;
    zoom?: number;
    onPositionChange?: (position: Point) => void;
    children?: () => any;
  }>();

  let mapContainer: HTMLElement | null = null;
  let map: Map | null = $state(null);
  let L: typeof Leaflet | null = null;

  setContext('map', () => ({ map, L }));

  onMount(async () => {
    if (!mapContainer) return;

    const leaflet = await import('leaflet');
    L = leaflet.default;
    map = L.map(mapContainer).setView(center, zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: `&copy;<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>,
		    &copy;<a href="https://carto.com/attributions" target="_blank">CARTO</a>`,
      subdomains: 'abcd',
      maxZoom: 16,
    }).addTo(map);

    if (onPositionChange) {
      const updatePosition = () => {
        if (!map) return;
        const mapCenter = map.getCenter();
        onPositionChange([mapCenter.lat, mapCenter.lng]);
      };

      map.on('drag', updatePosition);
      map.on('dragend', updatePosition);
    }
  });

  $effect(() => {
    if (!map) return;
    map.setView(center, map.getZoom());
  });
</script>

<svelte:head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div bind:this={mapContainer} class="map">
  {@render children?.()}
</div>

<style>
  .map {
    width: 100%;
    height: 100%;
  }
</style>
