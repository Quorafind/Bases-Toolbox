<script lang="ts">
  import { onMount } from 'svelte';
  
  export let files: any[] = [];
  export let latField: string = 'lat';
  export let longField: string = 'long';
  export let titleField: string = 'file.name';
  
  let MapViewComponent: any = null;
  let loading = true;
  let error: string | null = null;
  
  onMount(async () => {
    try {
      // Dynamically import the MapView component and Leaflet
      const { default: MapView } = await import('./MapView.svelte');
      MapViewComponent = MapView;
      loading = false;
    } catch (err) {
      console.error('Failed to load MapView component:', err);
      error = 'Failed to load map component';
      loading = false;
    }
  });
</script>

{#if loading}
  <div class="loading-container">
    <div class="loading-spinner"></div>
    <p>Loading map component...</p>
  </div>
{:else if error}
  <div class="error-container">
    <p>Error: {error}</p>
  </div>
{:else if MapViewComponent}
  <svelte:component 
    this={MapViewComponent} 
    {files} 
    {latField} 
    {longField} 
    {titleField} 
  />
{/if}

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    color: #666;
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 400px;
    color: #e74c3c;
    background-color: #fdf2f2;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
  }
</style>
