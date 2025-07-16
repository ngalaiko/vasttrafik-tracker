<script>
	import { useGeolocation } from '$lib/geolocation';
	import { closestPointsOnPolyline } from '$lib/utils';
	import { onMount } from 'svelte';
	
	const { data } = $props();
	const { lines } = data;
	const { position, loading, error } = useGeolocation();
	
	const DEFAULT_POSITION = { latitude: 57.706924, longitude: 11.966192 }; // Gothenburg
	/** @type {{latitude: number, longitude: number} | null} */
	let manualPosition = $state(null); // Default to Gothenburg
	const currentPosition = $derived(manualPosition || $position || DEFAULT_POSITION);

	
	/** @type {HTMLDivElement} */
	let mapContainer;
	/** @type {import('leaflet').Map | null} */
	let map = $state(null);
	/** @type {typeof import('leaflet')} */
	let L;
	/** @type {import('leaflet').Marker | null} */
	let positionMarker = null;

	const closestLines = $derived(
		lines.map((line) => {
			const closestPoints = closestPointsOnPolyline( line.coordinates, [currentPosition.latitude,  currentPosition.longitude], 1)
			return {
				...line,
				closestPoints,
				distance: Math.min(...closestPoints.map(p => p.distance)),
			}
		}).sort((a, b) => a.distance - b.distance).slice(0, 5)
	)

	/**
	 * Creates a Leaflet icon with a colored circle.
	 * @param {string} color - The color of the circle.
	 * @returns {import('leaflet').Icon} - The Leaflet icon object.
	 */
	function createIcon (color) {
		const svgIcon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="10" cy="10" r="8" fill="${color}" stroke="#000" stroke-width="2"/>
			<circle cx="10" cy="10" r="3" fill="#000"/>
		</svg>`;
		const iconUrl = `data:image/svg+xml;base64,${btoa(svgIcon)}`;
		
		return L.icon({
			iconUrl,
			iconSize: [20, 20],
			iconAnchor: [10, 10]
		});
	};

	onMount(async () => {
		const leaflet = await import('leaflet');
		L = leaflet.default;
		
		map = L.map(mapContainer).setView([currentPosition.latitude, currentPosition.longitude], 13);
		
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors'
		}).addTo(map);
		
		for (const line of lines) {
			const coordinates = line.coordinates.map(coord => new L.LatLng(coord[0], coord[1]));
			L.polyline(coordinates, {
				color: line.backgroundColor,
				weight: 3,
				opacity: 1
			}).addTo(map).bindPopup(`${line.name}`);
		}
		
		for (const line of lines) {
			for (const stop of line.stopPoints) {
				L.circleMarker([stop.location.lat, stop.location.lon], {
					radius: 4,
					fillColor: line.backgroundColor,
					color: '#000',
					weight: 1,
					opacity: 1,
					fillOpacity: 1
				}).addTo(map).bindPopup(`${stop.name}`);
			}
		}
		
		const updateManualPosition = () => {
			if (!map) return;
			const center = map.getCenter();
			manualPosition = {
				latitude: center.lat,
				longitude: center.lng
			};
		};
		
		map.on('drag', updateManualPosition);
		map.on('dragend', updateManualPosition);
	});
	
	$effect(() => {
		if (map && $position && !manualPosition) {
			map.setView([$position.latitude, $position.longitude], 15);
		}
	});
	
	$effect(() => {
		if (map && currentPosition) {
			if (positionMarker) {
				map.removeLayer(positionMarker);
			}
			
			const isGPS = !manualPosition && $position;
			const color = isGPS ? '#00ff00' : '#ff0000';
			
			positionMarker = L.marker([currentPosition.latitude, currentPosition.longitude], {
				icon: createIcon(color)
			}).addTo(map).bindPopup(isGPS ? 'GPS' : 'Manual');
		}
	});


	// Add this $effect block after your existing position marker effect
	$effect(() => {
		if (map && closestLines) {
			// Remove existing closest point markers
			if (map.closestPointMarkers) {
				map.closestPointMarkers.forEach(marker => map.removeLayer(marker));
			}
			map.closestPointMarkers = [];

			closestLines.forEach(line => {
				line.closestPoints.map(point => point.point).forEach(point => {
					console.log(point)
					const marker = L.circleMarker(point, {
						radius: 4,
						fillColor: '#ff0000', // Red for closest points
						color: '#000',
						weight: 1,
						opacity: 1,
						fillOpacity: 0.8
					}).addTo(map).bindPopup(`${line.name} - ${formatDistance(point.distance)}`);

					map.closestPointMarkers.push(marker);
				});
			});
		}
	});

	/**
	 * Formats the distance for display.
	 * @param {number} distance - The distance in meters.
	 * @returns {string} - The formatted distance string.
	 */
	function formatDistance(distance) {
		if (distance < 1000) {
			return `${Math.round(distance)}m`;
		}
		return `${(distance / 1000).toFixed(1)}km`;
	}
</script>

<svelte:head>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="container">
	<div class="map-container">
		<div bind:this={mapContainer} class="map"></div>
	</div>
	
	<div class="stats">
		<div class="status">
			{#if $loading}
				LOCATING...
			{:else if $error}
				ERROR: {$error.message}
			{:else if manualPosition && $position}
				<span class="position-type">MANUAL</span>
				<button onclick={() => manualPosition = null}>USE GPS</button>
			{:else if $position}
				<span class="position-type">GPS</span>
			{:else}
				<span class="position-type">MANUAL</span>
			{/if}
		</div>
		
		<div class="lines">
			{#each closestLines as line (line.gid)}
				<div class="line">
					<div class="line-header">
						<span class="line-name">{line.name}</span>
						<span class="distance">{formatDistance(line.distance)}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.container {
		display: flex;
		height: 100vh;
		font-family: monospace;
		font-size: 12px;
	}
	
	.map-container {
		flex: 1;
	}
	
	.map {
		width: 100%;
		height: 100%;
	}
	
	.stats {
		width: 300px;
		background: #fff;
		border-left: 2px solid #000;
		padding: 10px;
		overflow-y: auto;
	}
	
	.status {
		border-bottom: 1px solid #000;
		padding-bottom: 10px;
		margin-bottom: 10px;
	}
	
	.position-type {
		font-weight: bold;
	}
	
	button {
		background: #000;
		color: #fff;
		border: none;
		padding: 5px 10px;
		margin-left: 10px;
		font-family: monospace;
		font-size: 12px;
		cursor: pointer;
	}
	
	button:hover {
		background: #333;
	}
	
	.lines {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}
	
	.line {
		border: 1px solid #000;
		padding: 10px;
	}
	
	.line-header {
		display: flex;
		justify-content: space-between;
		font-weight: bold;
		margin-bottom: 5px;
		border-bottom: 1px solid #000;
		padding-bottom: 5px;
	}
	

	
	/* Mobile */
	@media (max-width: 768px) {
		.container {
			flex-direction: column;
		}
		
		.stats {
			width: 100%;
			height: 40vh;
			border-left: none;
			border-top: 2px solid #000;
		}
		
		.map-container {
			height: 60vh;
		}
	}
</style>
