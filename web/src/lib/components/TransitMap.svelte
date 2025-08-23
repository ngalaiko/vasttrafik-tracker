<script lang="ts">
  import type { Point } from '$lib/utils'
  import type { StopPointApiModel } from '@vasttrafik-tracker/vasttrafik'
  import lines from '$lib/lines'
  import Map from '$lib/components/Map.svelte'
  import MapLine from '$lib/components/Line.svelte'
  import MapPoint from '$lib/components/Point.svelte'

  const {
    center,
    onPositionChange,
    manualCoordinates = null
  } = $props<{
    center: Point
    onPositionChange?: (position: Point) => void
    manualCoordinates?: Point | null
  }>()

  const allStops = $derived.by(() => {
    const stopMap: Record<string, StopPointApiModel> = {}
    lines.forEach(line => {
      line.stopPoints.forEach(stop => {
        stopMap[stop.gid] = stop
      })
    })
    return Object.values(stopMap)
  })
</script>

<Map {center} {onPositionChange}>
  {#each lines as line}
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
    position={center}
    color={!manualCoordinates && center ? '#00ff00' : '#ff0000'}
    icon="marker"
    popup={!manualCoordinates && center ? 'GPS' : 'Manual'}
  />
</Map>
