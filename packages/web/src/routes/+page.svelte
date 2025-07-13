<script>
	import { useGeolocation } from '$lib/geolocation';
	import { calculateDistanceBetweenTwoPoints, calculateDistanceToLineSegment } from '$lib/utils';
	import { writable } from 'svelte/store';
	
	const { data } = $props();
	const { stopAreas, lines } = data;
	const { position, loading, error } = useGeolocation();

	const closestLines = $derived(
		lines.map((line) => {
			if ($position) {
				let minDistance = Infinity;
				for (let i = 0; i < line.coordinates.length - 1; i++) {
					const segmentStart = line.coordinates[i];
					const segmentEnd = line.coordinates[i + 1];
					const distance = calculateDistanceToLineSegment(
						{ lat: $position.latitude, long: $position.longitude },
						{ lat: segmentStart.latitude, long: segmentStart.longitude },
						{ lat: segmentEnd.latitude, long: segmentEnd.longitude }
					);
					if (distance < minDistance) {
						minDistance = distance;
					}
				}
				return  { ...line.line, distance: minDistance };
			}
			return { ...line.line, distance: Infinity };
		}).sort((a, b) => a.distance - b.distance).slice(0, 5)
	);

	const closestStopAreas = $derived(
		stopAreas.map((stopArea) => {
			if ($position) {
				const distance = calculateDistanceBetweenTwoPoints(
					{ lat: $position.latitude, long: $position.longitude },
					{ lat: stopArea.lat, long: stopArea.long }
				);
				return { ...stopArea, distance };
			}
			return { ...stopArea, distance: Infinity };
		}).sort((a, b) => a.distance - b.distance).slice(0, 5)
	);

	/**
	 * Fetches arrivals for a given stop area ID (gid).
	 * @param {string} gid The unique identifier for the stop area
	 * @returns {Promise<Array<import('$lib/server/vasttrafik').Arrival>>} A promise that resolves to the arrivals data
	 */
	async function fetchArrivals(gid) {
		const response = await fetch(`/api/stops/${gid}/arrivals`);
		return await response.json();
	}
	
	/**
	 * Fetches departures for a given stop area ID (gid).
	 * @param {string} gid The unique identifier for the stop area
	 * @returns {Promise<Array<import('$lib/server/vasttrafik').Departure>>} A promise that resolves to the departures data
	 */
	async function fetchDepartures(gid) {
		const response = await fetch(`/api/stops/${gid}/departures`);
		return await response.json();
	}
	
	const departures = writable(/** @type {Map<string, Array<import('$lib/server/vasttrafik').Departure>>} */ (new Map()));
	const arrivals = writable(/** @type {Map<string, Array<import('$lib/server/vasttrafik').Arrival>>} */ (new Map()));
	
	$effect(() => {
		if ($position) {
			closestStopAreas.forEach(/**
																												 * Processes each closest stop area to fetch its arrivals and departures.
																												 * @param {import('$lib/server/vasttrafik').StopArea & {distance: number}} stopArea The stop area to process
																												 */ (stopArea) => {
				fetchArrivals(stopArea.gid).then(a => {
					arrivals.update(map => {
						map.set(stopArea.gid, a);
						return map;
					});
				}).catch(err => {
					console.error(`Error fetching arrivals for ${stopArea.name}:`, err);
				});
				
				fetchDepartures(stopArea.gid).then(d => {
					departures.update(map => {
						map.set(stopArea.gid, d);
						return map;
					});
				}).catch(err => {
					console.error(`Error fetching departures for ${stopArea.name}:`, err);
				});
			});
		}
	});
</script>

{#if $loading}
	<p>Getting your location...</p>
{:else if $error}
	<p>Unable to get your location: {$error.message}</p>
{:else if !$position}
	<p>Location not available</p>
{:else}
	<h1>Closest Lines</h1>
	{#if closestLines.length > 0}
		<ul>
			{#each closestLines as line (line.name)}
				<li>
					<strong>{line.name}</strong>
					<br>
					Distance: {line.distance < 1000 
						? `${Math.round(line.distance)}m` 
						: `${(line.distance / 1000).toFixed(1)}km`}
				</li>
			{/each}
		</ul>
	{:else}
		<p>No lines found</p>
	{/if}
	<h1>Closest Stops</h1>
	{#if closestStopAreas.length > 0}
		<ul>
			{#each closestStopAreas as stopArea (stopArea.gid)}
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
					
					<details>
						<summary>Arrivals</summary>
						<ul>
							{#each $arrivals.get(stopArea.gid) || [] as arrival (arrival.serviceJourney.gid + arrival.plannedTime)}
								<li>{arrival.serviceJourney.line.name} at {new Date(arrival.plannedTime).toLocaleTimeString()}</li>
							{/each}
						</ul>
					</details>
					
					<details>
						<summary>Departures</summary>
						<ul>
							{#each $departures.get(stopArea.gid) || [] as departure (departure.serviceJourney.gid + departure.plannedTime)}
								<li>{departure.serviceJourney.line.name} at {new Date(departure.plannedTime).toLocaleTimeString()}</li>
							{/each}
						</ul>
					</details>
				</li>
			{/each}
		</ul>
	{:else}
		<p>No stop areas found</p>
	{/if}
{/if}
