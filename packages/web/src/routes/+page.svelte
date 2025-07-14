<script>
	import { useGeolocation } from '$lib/geolocation';
	import { calculateDistanceBetweenTwoPoints, calculateDistanceToLineSegment } from '$lib/utils';
	import { onMount } from 'svelte';
	
	const { data } = $props();
	const { lines } = data;
	const { position, loading, error } = useGeolocation();
	
	/** @type {{latitude: number, longitude: number} | null} */
	let manualPosition = $state(null);
	
	/** @type {HTMLDivElement} */
	let mapContainer;
	/** @type {import('leaflet').Map | null} */
	let map = $state(null);
	/** @type {typeof import('leaflet')} */
	let L;
	/** @type {import('leaflet').Marker | null} */
	let manualMarker = null;
	/** @type {import('leaflet').Marker | null} */
	let gpsMarker = null;
	
	let isInfoPanelCollapsed = $state(false);
	

	/**
	 * Creates a Leaflet icon with a colored circle and a label.
	 * @param {string} color - The color of the circle.
	 * @param {string} label - The label for the icon (not used in SVG).
	 * @returns {import('leaflet').Icon}
	 */
	function createIcon (color, label) {
		const svgIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="12" cy="12" r="8" fill="${color}" stroke="#fff" stroke-width="2"/>
			<circle cx="12" cy="12" r="3" fill="#fff"/>
		</svg>`;
		const iconUrl = `data:image/svg+xml;base64,${btoa(svgIcon)}`;
		
		return L.icon({
			iconUrl,
			iconSize: [20, 20],
			iconAnchor: [10, 10]
		});
	};

	onMount(async () => {
		// Import Leaflet dynamically
		const leaflet = await import('leaflet');
		L = leaflet.default;
		
		// Initialize map
		map = L.map(mapContainer).setView([57.706924, 11.966192], 13); // Default to Gothenburg
		
		// Add tile layer
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors'
		}).addTo(map);
		
		// Add lines to map
		for (const line of lines) {
			const coordinates = line.coordinates.map(coord => new L.LatLng(coord[0], coord[1]));
			L.polyline(coordinates, {
				color: line.backgroundColor,
				weight: 3,
				opacity: 0.7
			}).addTo(map).bindPopup(`<strong>${line.name}</strong>`);
		}
		
		// Add stop points to map
		for (const line of lines) {
			for (const stop of line.stopPoints) {
				L.circleMarker([stop.location.lat, stop.location.lon], {
					radius: 5,
					fillColor: line.foregroundColor,
					color: line.backgroundColor,
					weight: 1,
					opacity: 1,
					fillOpacity: 0.8
				}).addTo(map).bindPopup(`<strong>${stop.name}</strong>`);
			}
		}
		
		// Add event listeners to capture manual position on any map movement
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
		map.on('zoomend', updateManualPosition);
	});
	
	// Update map center when position changes (only if no manual position is set)
	$effect(() => {
		if (map && $position && !manualPosition) {
			map.setView([$position.latitude, $position.longitude], 15);
		}
	});
	
	// Add/update GPS marker
	$effect(() => {
		if (map && $position) {
			// Remove existing GPS marker
			if (gpsMarker) {
				map.removeLayer(gpsMarker);
				gpsMarker = null;
			}
			
			// Add new GPS marker
			gpsMarker = L.marker([$position.latitude, $position.longitude], {
				icon: createIcon('#007fff', 'GPS Location')
			}).addTo(map).bindPopup('<strong>Your Location</strong>');
		} else if (gpsMarker && map) {
			// Remove marker if no GPS position
			map.removeLayer(gpsMarker);
			gpsMarker = null;
		}
	});
	
	// Add/update manual position marker
	$effect(() => {
		if (map && manualPosition) {
			// Remove existing manual marker
			if (manualMarker) {
				map.removeLayer(manualMarker);
				manualMarker = null;
			}
			
			// Add new manual marker
			manualMarker = L.marker([manualPosition.latitude, manualPosition.longitude], {
				icon: createIcon('#ff6600', 'Manual Position')
			}).addTo(map).bindPopup('<strong>Manual Position</strong>');
		} else if (manualMarker && map) {
			// Remove marker if no manual position
			map.removeLayer(manualMarker);
			manualMarker = null;
		}
	});
	
	const closestLines = $derived(
		lines.map((line) => {
			const currentPos = manualPosition || $position;
			if (currentPos) {
				let minDistance = Infinity;
				for (let i = 0; i < line.coordinates.length - 1; i++) {
					const segmentStart = line.coordinates[i];
					const segmentEnd = line.coordinates[i + 1];
					const distance = calculateDistanceToLineSegment(
						{ lat: currentPos.latitude, long: currentPos.longitude },
						{ lat: segmentStart[0], long: segmentStart[1] },
						{ lat: segmentEnd[0], long: segmentEnd[1] }
					);
					if (distance < minDistance) {
						minDistance = distance;
					}
				}
				return  { ...line, distance: minDistance };
			}
			return { ...line, distance: Infinity };
		}).sort((a, b) => a.distance - b.distance).slice(0, 5)
	);

	const closestStopPoints = $derived(
		lines
			.flatMap((line) => line.stopPoints)
			.map((stopPoint) => {
			const currentPos = manualPosition || $position;
			if (currentPos) {
				const distance = calculateDistanceBetweenTwoPoints(
					{ lat: currentPos.latitude, long: currentPos.longitude },
					{ lat: stopPoint.location.lat, long: stopPoint.location.lon}
				);
				return { ...stopPoint, distance };
			}
			return { ...stopPoint, distance: Infinity };
		}).sort((a, b) => a.distance - b.distance).slice(0, 5)
	);
</script>

<svelte:head>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="container">
	<div class="map-container">
		<div bind:this={mapContainer} class="map"></div>
	</div>
	
	<div class="info-panel" class:collapsed={isInfoPanelCollapsed}>
		<button class="toggle-button" onclick={() => isInfoPanelCollapsed = !isInfoPanelCollapsed}>
			{isInfoPanelCollapsed ? '📋' : '✕'}
		</button>
		
		<div class="info-content">
			{#if $loading}
				<p>Getting your location...</p>
			{:else if $error}
				<p>Unable to get your location: {$error.message}</p>
			{:else if !$position && !manualPosition}
				<p>Location not available</p>
			{:else}
				<div class="position-controls">
					{#if manualPosition}
						<p class="position-indicator">📍 Using manual position</p>
						<button onclick={() => manualPosition = null} class="reset-button">
							Use GPS location
						</button>
					{:else if $position}
						<p class="position-indicator">🛰️ Using GPS location</p>
					{/if}
				</div>
				
				<h2>Closest Lines</h2>
				{#if closestLines.length > 0}
					<ul>
						{#each closestLines as line (line.gid)}
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
				
				<h2>Closest Stops</h2>
				{#if closestStopPoints.length > 0}
					<ul>
						{#each closestStopPoints as stopArea, index (`${stopArea.gid}-${index}`)}
							<li>
								<strong>{stopArea.name}</strong>
								<br>
								Distance: {#if (manualPosition || $position) && stopArea.distance !== Infinity}
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
			{/if}
		</div>
	</div>
</div>

<style>
	.container {
		display: flex;
		height: 100vh;
		gap: 1rem;
	}
	
	.map-container {
		flex: 1;
		min-height: 400px;
	}
	
	.map {
		width: 100%;
		height: 100%;
	}
	
	.info-panel {
		width: 300px;
		padding: 1rem;
		background: #f5f5f5;
		overflow-y: auto;
		position: relative;
	}

	.info-panel.collapsed {
		width: 60px;
		padding: 0.5rem;
	}

	.info-panel.collapsed .info-content {
		display: none;
	}

	.toggle-button {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: #007fff;
		color: white;
		border: none;
		padding: 0.5rem;
		border-radius: 50%;
		cursor: pointer;
		font-size: 1rem;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
	}

	.toggle-button:hover {
		background: #0056cc;
	}

	.info-content {
		margin-top: 3rem;
	}
	
	.info-panel h2 {
		margin-top: 0;
		font-size: 1.2rem;
	}
	
	.info-panel ul {
		list-style: none;
		padding: 0;
	}
	
	.info-panel li {
		padding: 0.5rem 0;
		border-bottom: 1px solid #ddd;
	}
	
	.info-panel li:last-child {
		border-bottom: none;
	}
	
	.position-controls {
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: #e8f4f8;
		border-radius: 4px;
		border-left: 4px solid #007fff;
	}
	
	.position-indicator {
		margin: 0 0 0.5rem 0;
		font-size: 0.9rem;
		font-weight: 500;
	}
	
	.reset-button {
		background: #007fff;
		color: white;
		border: none;
		padding: 0.75rem 1.25rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background 0.2s;
		min-height: 44px;
	}
	
	.reset-button:hover {
		background: #0056cc;
	}

	/* Mobile responsive styles */
	@media (max-width: 768px) {
		.container {
			flex-direction: column;
			height: 100vh;
			gap: 0;
		}

		.map-container {
			flex: 1;
			min-height: 60vh;
		}

		.info-panel {
			width: 100%;
			max-height: 40vh;
			border-top: 1px solid #ddd;
		}

		.info-panel.collapsed {
			max-height: 60px;
			width: 100%;
		}

		.toggle-button {
			top: 0.25rem;
			right: 0.25rem;
			width: 50px;
			height: 50px;
			font-size: 1.2rem;
		}

		.info-content {
			margin-top: 3.5rem;
		}

		.reset-button {
			width: 100%;
			padding: 1rem;
			font-size: 1rem;
			min-height: 48px;
		}

		.position-controls {
			padding: 1rem;
		}

		.info-panel h2 {
			font-size: 1.1rem;
		}

		.info-panel li {
			padding: 0.75rem 0;
		}
	}

	@media (max-width: 480px) {
		.container {
			gap: 0;
		}

		.map-container {
			min-height: 55vh;
		}

		.info-panel {
			max-height: 45vh;
			padding: 0.75rem;
		}

		.info-panel.collapsed {
			max-height: 55px;
		}

		.toggle-button {
			width: 45px;
			height: 45px;
			font-size: 1.1rem;
		}

		.info-content {
			margin-top: 3rem;
		}

		.reset-button {
			padding: 0.875rem;
			font-size: 0.95rem;
		}

		.position-controls {
			padding: 0.875rem;
		}

		.info-panel h2 {
			font-size: 1rem;
			margin-bottom: 0.75rem;
		}
	}
</style>
