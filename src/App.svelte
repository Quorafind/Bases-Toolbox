<script lang="ts">
  import Toolbox from './lib/Toolbox.svelte';
  import BasesPreview from './lib/BasesPreview.svelte';
</script>

<main>
  <Toolbox>
    <BasesPreview slot="bases-preview" />
  </Toolbox>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #f5f6f8;
    overflow-y: auto;
  }
  
  main {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
</style>
