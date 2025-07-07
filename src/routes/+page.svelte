<script>
	import { useGeolocation } from '$lib/geolocation';
	import { calculateDistanceMeters } from '$lib/utils';
	
	const { data } = $props();
	const { stopAreas } = data;
	const { position, loading, error } = useGeolocation();
	
	const closestStopAreas = $derived(
		stopAreas.map(stopArea => {
			if ($position) {
				const distance = calculateDistanceMeters(
					{ lat: $position.latitude, long: $position.longitude },
					{ lat: stopArea.lat, long: stopArea.long }
				);
				return { ...stopArea, distance };
			}
			return { ...stopArea, distance: Infinity };
		}).sort((a, b) => a.distance - b.distance).slice(0, 5)
	);
</script>

<h1>Nearby Stop Areas</h1>

{#if $loading}
	<p>Getting your location...</p>
{:else if $error}
	<p>Unable to get your location: {$error.message}</p>
{:else if !$position}
	<p>Location not available</p>
{/if}

{#if closestStopAreas.length > 0}
	<ul>
		{#each closestStopAreas as stopArea}
			<li>
				<strong>{stopArea.name}</strong>
				<br>
				Coordinates: {stopArea.lat.toFixed(6)}, {stopArea.long.toFixed(6)}
				<br>
				Distance: {#if $position && stopArea.distance !== Infinity}
					{stopArea.distance < 1000 
						? `${Math.round(stopArea.distance)}m` 
						: `${(stopArea.distance / 1000).toFixed(1)}km`}
				{:else}
					Not available
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p>No stop areas found</p>
{/if}
