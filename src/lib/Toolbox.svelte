<script lang="ts">
  import { onMount } from 'svelte';
  import DataviewConverter from './DataviewConverter.svelte';
  
  // Toolbox tabs
  const TABS = {
    BASES_PREVIEW: 'bases-preview',
    DATAVIEW_CONVERTER: 'dataview-converter'
  };
  
  // Active tab state
  let activeTab = TABS.DATAVIEW_CONVERTER;
  
  // Set active tab
  function setActiveTab(tab: string) {
    activeTab = tab;
  }
  
  onMount(() => {
    // Check if there's a tab in the URL hash
    const hash = window.location.hash.substring(1);
    if (hash && Object.values(TABS).includes(hash)) {
      activeTab = hash;
    }
  });
  
  // Update URL hash when tab changes
  $: {
    if (typeof window !== 'undefined') {
      window.location.hash = activeTab;
    }
  }
</script>

<div class="toolbox-container">
  <div class="toolbox-header">
    <div class="toolbox-tabs">
      <button 
        class={activeTab === TABS.BASES_PREVIEW ? 'active' : ''}
        on:click={() => setActiveTab(TABS.BASES_PREVIEW)}
      >
        Bases Preview
      </button>
      <button 
        class={activeTab === TABS.DATAVIEW_CONVERTER ? 'active' : ''}
        on:click={() => setActiveTab(TABS.DATAVIEW_CONVERTER)}
      >
        Dataview Converter
      </button>
    </div>
  </div>
  
  <div class="toolbox-content">
    {#if activeTab === TABS.BASES_PREVIEW}
      <slot name="bases-preview"></slot>
    {:else if activeTab === TABS.DATAVIEW_CONVERTER}
      <DataviewConverter />
    {/if}
  </div>
</div>

<style>
  .toolbox-container {
    max-width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  .toolbox-header {
    padding: 8px 20px;
    background-color: #f5f6f8;
    border-bottom: 1px solid #e1e2e5;
    flex: 0 0 auto;
  }
  
  .toolbox-tabs {
    display: flex;
    gap: 10px;
    justify-content: flex-start;
  }
  
  .toolbox-tabs button {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px 20px;
    font-size: 16px;
    cursor: pointer;
    color: #555;
    transition: all 0.2s ease;
  }
  
  .toolbox-tabs button:hover {
    background: #f9f9f9;
    border-color: #ccc;
  }
  
  .toolbox-tabs button.active {
    background: #50567a;
    color: white;
    border-color: #50567a;
  }
  
  .toolbox-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
</style> 