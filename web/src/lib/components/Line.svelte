<script lang="ts">
  import type { Point } from '$lib/utils'
  import type { Map } from 'leaflet'
  import type Leaflet from 'leaflet'
  import { getContext } from 'svelte'

  const {
    coordinates,
    color = '#000000',
    weight = 3,
    opacity = 1,
    name
  } = $props<{
    coordinates: Point[]
    color?: string
    weight?: number
    opacity?: number
    name?: string
  }>()

  const getMapContext = getContext<() => { map: Map; L: typeof Leaflet }>('map')

  let polyline: any = null

  $effect(() => {
    const { map, L } = getMapContext()
    if (!map || !L) return

    if (polyline) {
      map.removeLayer(polyline)
    }

    const latlngs = coordinates.map(coord => new L.LatLng(coord[0], coord[1]))
    polyline = L.polyline(latlngs, {
      color,
      weight,
      opacity
    }).addTo(map)

    if (name) {
      polyline.bindPopup(name)
    }

    return () => {
      if (polyline && map) {
        map.removeLayer(polyline)
      }
    }
  })
</script>
