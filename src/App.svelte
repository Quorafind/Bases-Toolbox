<script lang="ts">
  import Toolbox from './lib/Toolbox.svelte';
  import BasesPreview from './lib/BasesPreview.svelte';
</script>

<main>
  <Toolbox>
    <BasesPreview slot="bases-preview" />
  </Toolbox>
  <footer>
    <p>All rights @boninall reserved</p>
  </footer>
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
  
  footer {
    background-color: #2c3e50;
    color: #ecf0f1;
    padding: 1rem;
    text-align: center;
    font-size: 0.875rem;
    border-top: 1px solid #34495e;
  }
  
  footer p {
    margin: 0;
  }
</style>
