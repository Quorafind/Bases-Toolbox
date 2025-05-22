<script lang="ts">
  import { getPropertyValue } from './basesParser';
  
  export let files: any[] = [];
  export let groupBy: string = 'status';
  export let titleField: string = 'file.name';
  export let descriptionField: string = 'summary';
  export let limit: number = 50;
  
  // Get unique group values
  $: groupValues = [...new Set(files.map(file => getPropertyValue(file, groupBy)))].filter(Boolean);
  
  // Group files by the selected property
  $: groupedFiles = groupFiles(files, groupBy, limit);
  
  function groupFiles(files: any[], groupBy: string, limit: number) {
    const grouped: Record<string, any[]> = {};
    
    // Initialize with empty arrays for each group
    groupValues.forEach(value => {
      grouped[value] = [];
    });
    
    // Group files by the specified property
    files.forEach(file => {
      const value = getPropertyValue(file, groupBy);
      if (value && grouped[value]) {
        if (grouped[value].length < limit) {
          grouped[value].push(file);
        }
      }
    });
    
    return grouped;
  }
  
  // Get a color for a group based on its name
  function getGroupColor(groupName: string): string {
    // Simple hash function to generate a color from a string
    const hash = groupName.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 60%, 85%)`;
  }
</script>

<div class="board-view">
  <div class="board-columns">
    {#each groupValues as groupValue}
      <div class="board-column">
        <div class="column-header" style="background-color: {getGroupColor(groupValue)}">
          <h3>{groupValue}</h3>
          <span class="count">{groupedFiles[groupValue].length}</span>
        </div>
        <div class="column-cards">
          {#each groupedFiles[groupValue] as file}
            <div class="card">
              <h4>{getPropertyValue(file, titleField)}</h4>
              {#if descriptionField}
                <p class="description">{getPropertyValue(file, descriptionField)}</p>
              {/if}
              <div class="card-meta">
                {#if file.tags && file.tags.length}
                  <div class="tags">
                    {#each file.tags.slice(0, 3) as tag}
                      <span class="tag">{tag}</span>
                    {/each}
                  </div>
                {/if}
                {#if file.priority}
                  <div class="priority priority-{file.priority}">
                    {file.priority}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .board-view {
    width: 100%;
    height: 100%;
    overflow-x: auto;
  }
  
  .board-columns {
    display: flex;
    padding: 10px;
    gap: 12px;
    min-height: 400px;
  }
  
  .board-column {
    flex: 0 0 280px;
    display: flex;
    flex-direction: column;
    border-radius: 6px;
    background: #f5f5f5;
    max-height: 100%;
  }
  
  .column-header {
    padding: 10px 15px;
    border-radius: 6px 6px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 500;
  }
  
  .column-header h3 {
    margin: 0;
    font-size: 16px;
  }
  
  .count {
    background: rgba(255, 255, 255, 0.5);
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 12px;
  }
  
  .column-cards {
    padding: 10px;
    overflow-y: auto;
    flex-grow: 1;
  }
  
  .card {
    background: white;
    border-radius: 6px;
    padding: 10px;
    margin-bottom: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .card h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    line-height: 1.3;
  }
  
  .description {
    font-size: 12px;
    color: #666;
    margin: 0 0 8px 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  
  .card-meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }
  
  .tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  
  .tag {
    background: #eee;
    padding: 2px 6px;
    border-radius: 4px;
    color: #666;
    font-size: 11px;
  }
  
  .priority {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: white;
  }
  
  .priority-1 { background-color: #c0c0c0; }
  .priority-2 { background-color: #8bc9ff; }
  .priority-3 { background-color: #ffcb66; }
  .priority-4 { background-color: #ff9e66; }
  .priority-5 { background-color: #ff6666; }
</style> 