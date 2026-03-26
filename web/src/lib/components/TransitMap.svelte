<script lang="ts">
  import type { Point, Stop } from '$lib/types'
  import lines from '$lib/lines'
  import Map from '$lib/components/Map.svelte'
  import MapLine from '$lib/components/Line.svelte'
  import MapPoint from '$lib/components/Point.svelte'

  interface Props {
    center: Point
    onPositionChange?: (position: Point) => void
    manualCoordinates?: Point | null
  }

  let { center, onPositionChange, manualCoordinates = null }: Props = $props()

  const allStops = $derived.by(() => {
    const stopMap: Record<string, Stop> = {}
    lines.forEach(route => {
      route.stops.forEach(stop => {
        stopMap[stop.gid] = stop
      })
    })
    return Object.values(stopMap)
  })
</script>

<Map {center} {onPositionChange}>
  {#each lines as route}
    <MapLine
      coordinates={route.coordinates}
      color={route.colors.background === '#ffffff' ? route.colors.border : route.colors.background}
      name={`${route.name} → ${route.direction}`}
    />
  {/each}

  {#each allStops as stop}
    <MapPoint
      position={stop.position}
      color="#0000ff"
      radius={3}
      popup={stop.name}
    />
  {/each}

  <MapPoint
    position={center}
    color={!manualCoordinates && center ? '#00ff00' : '#ff0000'}
    icon="marker"
    popup={!manualCoordinates && center ? 'GPS' : 'Manual'}
  />
</Map>
