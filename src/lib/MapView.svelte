<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  
  export let files: any[] = [];
  export let latField: string = 'lat';
  export let longField: string = 'long';
  export let titleField: string = 'file.name';
  
  let mapElement: HTMLElement;
  let map: L.Map;
  let markers: L.Marker[] = [];
  
  // Set up the map when the component mounts
  onMount(() => {
    // Create the map
    map = L.map(mapElement).setView([0, 0], 2);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Add markers for files with coordinates
    updateMarkers();
  });
  
  // Clean up when the component is destroyed
  onDestroy(() => {
    if (map) {
      map.remove();
    }
  });
  
  // Function to update markers when files change
  $: if (map && files) {
    updateMarkers();
  }
  
  function updateMarkers() {
    // Clear existing markers
    markers.forEach(marker => {
      map.removeLayer(marker);
    });
    markers = [];
    
    // Only process files with coordinates
    const filesWithCoords = files.filter(file => 
      typeof getPropertyValue(file, latField) === 'number' && 
      typeof getPropertyValue(file, longField) === 'number'
    );
    
    if (filesWithCoords.length === 0) {
      // Default view if no markers
      map.setView([0, 0], 2);
      return;
    }
    
    // Add new markers
    const bounds = L.latLngBounds([]);
    
    filesWithCoords.forEach(file => {
      const lat = getPropertyValue(file, latField);
      const lng = getPropertyValue(file, longField);
      const title = getPropertyValue(file, titleField) || 'Unnamed';
      
      const marker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup(`<b>${title}</b><br>Lat: ${lat}<br>Long: ${lng}`);
      
      markers.push(marker);
      bounds.extend([lat, lng]);
    });
    
    // Fit the map to show all markers
    if (filesWithCoords.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
  
  // Helper function to get property values
  function getPropertyValue(file: any, propPath: string): any {
    if (!propPath) return undefined;
    
    // Handle file properties
    if (propPath.startsWith('file.')) {
      const key = propPath.substring(5);
      return file.file[key];
    }
    
    // Regular properties
    return file[propPath];
  }
</script>

<style>
  .map-container {
    height: 100%;
    width: 100%;
    min-height: 400px;
    position: relative;
  }
  
  :global(.leaflet-container) {
    height: 100%;
    width: 100%;
  }
  
  /* Add some Leaflet style fixes */
  :global(.leaflet-control-attribution) {
    font-size: 10px;
  }
  
  :global(.leaflet-popup-content) {
    margin: 10px;
    line-height: 1.4;
  }
  
  :global(.leaflet-popup-content b) {
    font-weight: 600;
    margin-bottom: 4px;
    display: block;
  }
</style>

<div class="map-container" bind:this={mapElement}></div> 