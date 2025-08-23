<script lang="ts">
  import type { ArrivalApiModel } from '@vasttrafik-tracker/vasttrafik'

  const { journeys } = $props<{
    journeys: (ArrivalApiModel & { score: number })[] | null
  }>()
</script>

{#if journeys === null}
  <div class="loading">Loading...</div>
{:else if journeys.length === 0}
  <div class="no-results">You are not on a bus</div>
{:else}
  <h3>You are most likely on:</h3>
  <div class="journey-list">
    {#each journeys.slice(0, 5) as journey (journey.serviceJourney.gid + journey.stopPoint.gid)}
      <div class="journey-item">
        <div class="journey-header">
          <span class="line-name">{journey.serviceJourney.line.name}</span>
        </div>
        <div class="journey-details">
          <div>ID: {journey.serviceJourney.gid}</div>
          <div>Next: {journey.stopPoint.name}</div>
        </div>
      </div>
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

  .journey-item {
    border: 1px solid #000;
    padding: 8px;
    margin-bottom: 4px;
    background: #fff;
  }

  .journey-item:active {
    background: #f0f0f0;
  }

  .journey-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .line-name {
    font-weight: bold;
  }

  .journey-details {
    font-size: 12px;
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
