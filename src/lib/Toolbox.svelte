<script lang="ts">
  import { onMount } from 'svelte';
  import DataviewConverter from './DataviewConverter.svelte';
  import About from './About.svelte';
  
  // Toolbox tabs
  const TABS = {
    BASES_PREVIEW: 'bases-preview',
    DATAVIEW_CONVERTER: 'dataview-converter',
    ABOUT: 'about'
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
      <button 
        class={activeTab === TABS.ABOUT ? 'active' : ''}
        on:click={() => setActiveTab(TABS.ABOUT)}
      >
        About
      </button>
    </div>
    <div class="toolbox-header-right">
      <button aria-label="github"  on:click={() => window.open('https://github.com/quorafind/bases-toolbox', '_blank')}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.014-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" fill="#24292F"/>
        </svg>
      </button>
    </div>
  </div>
  
  <div class="toolbox-content">
    {#if activeTab === TABS.BASES_PREVIEW}
      <slot name="bases-preview"></slot>
    {:else if activeTab === TABS.DATAVIEW_CONVERTER}
      <DataviewConverter />
    {:else if activeTab === TABS.ABOUT}
      <About />
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
    display: flex;
    align-items: center;
    width: 100%;
    justify-content: space-between;
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