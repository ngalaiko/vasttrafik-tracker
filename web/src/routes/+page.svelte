<script lang="ts">
  import { Location } from '$lib/location.svelte'
  import type { Point } from '$lib/utils'
  import { useNearbyStops } from '$lib/hooks/useNearbyStops.svelte'
  import { useTransitData } from '$lib/hooks/useTransitData.svelte'
  import { useJourneyScoring } from '$lib/hooks/useJourneyScoring.svelte'
  import TransitMap from '$lib/components/TransitMap.svelte'
  import JourneyList from '$lib/components/JourneyList.svelte'

  const location = new Location()
  const DEFAULT_COORDINATES: Point = [57.706924, 11.966192]

  let manualCoordinates: Point | null = $state(null)
  function handlePositionChange(position: Point) {
    manualCoordinates = position
  }

  const rawCoordinates = $derived(
    manualCoordinates || location.coordinates || DEFAULT_COORDINATES
  )

  const nearbyStops = useNearbyStops(() => rawCoordinates)
  const transitData = useTransitData(() => nearbyStops.stops)
  const journeyScoring = useJourneyScoring(
    () => transitData.arrivalJourneys,
    () => nearbyStops.coordinates
  )
</script>

<div class="container">
  <div class="map-container">
    <TransitMap
      center={nearbyStops.coordinates || DEFAULT_COORDINATES}
      onPositionChange={handlePositionChange}
      {manualCoordinates}
    />
  </div>

  <div class="sidebar">
    <JourneyList journeys={journeyScoring.scored} />
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
  }

  @media (max-width: 375px) {
    .sidebar {
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
