<script lang="ts">
  import type { ScoredTrip } from '$lib/types'

  interface Props {
    journeys: ScoredTrip[] | null
    locationError?: string | null
  }

  let { journeys, locationError = null }: Props = $props()

  let expandedId: string | null = $state(null)

  function toggle(id: string) {
    expandedId = expandedId === id ? null : id
  }

  function fmt(n: number | null | undefined, decimals = 1): string {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—'
    return n.toFixed(decimals)
  }
</script>

{#if locationError}
  <div class="error">{locationError}</div>
{/if}

{#if journeys === null}
  <div class="loading">Loading...</div>
{:else if journeys.length === 0}
  <div class="no-results">No trams nearby</div>
{:else}
  <h3>You are most likely on:</h3>
  <div class="journey-list">
    {#each journeys.slice(0, 10) as sj (sj.trip.serviceJourneyGid)}
      {@const d = sj.diagnostics}
      {@const route = sj.trip.route}
      <button
        class="journey-item"
        onclick={() => toggle(sj.trip.serviceJourneyGid)}
      >
        <div class="journey-header">
          <span
            class="line-badge"
            style="background:{route.colors.background};color:{route.colors.foreground};border-color:{route.colors.border}"
          >
            {route.name}
          </span>
          <span class="score" class:good={sj.score > 0.5}>
            {fmt(sj.score, 2)}
          </span>
        </div>

        <div class="journey-meta">
          → {route.direction} · next: {sj.trip.nextStop.name}
        </div>

        <div class="journey-stats">
          <span title="User speed">{fmt(d.motion.speedMs)} m/s</span>
          <span class="dim">│</span>
          <span title="Expected tram speed">🚋 {fmt(d.expectedTramSpeed)} m/s</span>
          <span class="dim">│</span>
          <span title="Distance to line">{d.projection ? `${fmt(d.projection.distance)}m` : '—'}</span>
          <span class="dim">│</span>
          <span title="Bearing difference">{d.bearing ? `${fmt(d.bearing.angleDifference, 0)}°` : '—'}</span>
        </div>

        {#if expandedId === sj.trip.serviceJourneyGid}
          <div class="debug">
            <div class="debug-section">
              <div class="debug-title">User Motion</div>
              <div class="debug-row">
                <span>Speed</span>
                <span>{fmt(d.motion.speedMs)} m/s</span>
              </div>
              <div class="debug-row">
                <span>Bearing</span>
                <span>{d.motion.bearing !== null ? `${fmt(d.motion.bearing, 0)}°` : '—'}</span>
              </div>
              <div class="debug-row">
                <span>Class</span>
                <span>{d.motion.classification}</span>
              </div>
            </div>

            <div class="debug-section">
              <div class="debug-title">Proximity</div>
              <div class="debug-row">
                <span>Dist to line</span>
                <span>{d.projection ? `${fmt(d.projection.distance)}m` : '—'}</span>
              </div>
              <div class="debug-row">
                <span>Line bearing</span>
                <span>{d.projection ? `${fmt(d.projection.lineBearing, 0)}°` : '—'}</span>
              </div>
              <div class="debug-row">
                <span>Avg lateral</span>
                <span>{fmt(d.avgLateralDistance)}m</span>
              </div>
              <div class="debug-row">
                <span>Lateral σ</span>
                <span>{fmt(d.lateralStdDev)}m</span>
              </div>
            </div>

            <div class="debug-section">
              <div class="debug-title">Schedule</div>
              <div class="debug-row">
                <span>Tram speed</span>
                <span>{fmt(d.expectedTramSpeed)} m/s</span>
              </div>
              <div class="debug-row">
                <span>Progress speed</span>
                <span>{fmt(d.userProgressSpeed)} m/s</span>
              </div>
            </div>

            {#if d.bearing}
              <div class="debug-section">
                <div class="debug-title">Bearing Match</div>
                <div class="debug-row">
                  <span>Angle diff</span>
                  <span>{fmt(d.bearing.angleDifference, 0)}°</span>
                </div>
                <div class="debug-row">
                  <span>Direction</span>
                  <span>{d.bearing.forward ? 'forward' : 'reverse'}</span>
                </div>
              </div>
            {/if}

            <div class="debug-section">
              <div class="debug-title">Signals</div>
              {#each d.signals as signal}
                <div class="debug-row">
                  <span>{signal.name}</span>
                  <span>
                    {fmt(signal.score, 2)}
                    <span class="dim">×{signal.weight}</span>
                    <span class="dim">(raw: {fmt(signal.raw, 1)})</span>
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  h3 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: bold;
  }

  .loading,
  .no-results {
    padding: 8px 0;
  }

  .error {
    padding: 8px;
    margin-bottom: 8px;
    background: #fee;
    border: 1px solid #c00;
    color: #c00;
  }

  .journey-item {
    display: block;
    width: 100%;
    text-align: left;
    border: 1px solid #000;
    padding: 8px;
    margin-bottom: 4px;
    background: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
  }

  .journey-item:hover {
    background: #f8f8f8;
  }

  .journey-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .line-badge {
    font-weight: bold;
    padding: 1px 6px;
    border: 1px solid;
    border-radius: 2px;
    font-size: 13px;
  }

  .score {
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }

  .score.good {
    color: #070;
  }

  .journey-meta {
    font-size: 11px;
  }

  .journey-stats {
    font-size: 10px;
    color: #444;
    margin-top: 3px;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  /* Debug panel */

  .debug {
    margin-top: 8px;
    border-top: 1px dashed #ccc;
    padding-top: 6px;
    font-size: 10px;
    line-height: 1.5;
  }

  .debug-section {
    margin-bottom: 6px;
  }

  .debug-title {
    font-weight: bold;
    text-transform: uppercase;
    font-size: 9px;
    letter-spacing: 0.5px;
    color: #666;
    margin-bottom: 2px;
  }

  .debug-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .dim {
    color: #999;
  }

  @media (max-width: 768px) {
    .journey-item {
      padding: 12px;
      margin-bottom: 8px;
    }

    .journey-header {
      margin-bottom: 8px;
    }
  }

  @media (max-width: 375px) {
    .journey-item {
      padding: 8px;
    }
  }
</style>
