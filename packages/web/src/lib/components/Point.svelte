<script lang="ts">
  import type { Point } from '$lib/utils';
  import { getContext } from 'svelte';
  import type Leaflet from 'leaflet';
  import type { Map } from 'leaflet';

  const {
    position,
    color = '#ff0000',
    radius = 6,
    popup,
    icon,
  } = $props<{
    position: Point;
    color?: string;
    radius?: number;
    popup?: string;
    icon?: 'circle' | 'marker';
  }>();

  const getMapContext = getContext<() => { map: Map; L: typeof Leaflet }>('map');

  let marker: any = null;

  function createIcon(L: typeof Leaflet, color: string) {
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

  $effect(() => {
    const { map, L } = getMapContext();
    if (!map || !L) return;

    if (marker) {
      map.removeLayer(marker);
    }

    if (icon === 'marker') {
      marker = L.marker(position, {
        icon: createIcon(L, color),
      }).addTo(map);
    } else {
      marker = L.circleMarker(position, {
        radius,
        fillColor: color,
        color: '#000',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(map);
    }

    if (popup) {
      marker.bindPopup(popup);
    }

    return () => {
      if (marker && map) {
        map.removeLayer(marker);
      }
    };
  });
</script>
