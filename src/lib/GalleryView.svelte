<script lang="ts">
  import { getPropertyValue } from './basesParser';
  
  export let files: any[] = [];
  export let titleField: string = 'file.name';
  export let descriptionField: string = 'summary';
  export let coverField: string = ''; // Optional field for cover images
  export let limit: number = 50;
  
  function generateColorFromString(str: string): string {
    // Simple hash function to generate a color from a string
    const hash = str.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 60%, 60%)`;
  }
  
  function getInitials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word[0])
      .join('')
      .toUpperCase();
  }
</script>

<div class="gallery-view">
  <div class="gallery-grid">
    {#each files.slice(0, limit) as file}
      <div class="gallery-card">
        <div class="gallery-card-cover">
          {#if coverField && getPropertyValue(file, coverField)}
            <img src={getPropertyValue(file, coverField)} alt={getPropertyValue(file, titleField)} />
          {:else}
            <div 
              class="cover-placeholder" 
              style="background-color: {generateColorFromString(getPropertyValue(file, titleField))}"
            >
              <span>{getInitials(getPropertyValue(file, titleField))}</span>
            </div>
          {/if}
        </div>
        <div class="gallery-card-content">
          <h3 class="card-title">{getPropertyValue(file, titleField)}</h3>
          {#if file.author}
            <div class="card-author">{file.author}</div>
          {/if}
          {#if descriptionField && getPropertyValue(file, descriptionField)}
            <p class="card-description">{getPropertyValue(file, descriptionField)}</p>
          {/if}
          {#if file.tags && file.tags.length}
            <div class="card-tags">
              {#each file.tags.slice(0, 3) as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}
          {#if file.readingProgress !== undefined}
            <div class="reading-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: {file.readingProgress}%"></div>
              </div>
              <span class="progress-text">{file.readingProgress}%</span>
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .gallery-view {
    width: 100%;
    padding: 10px;
    overflow-y: auto;
  }
  
  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 20px;
  }
  
  .gallery-card {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  
  .gallery-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .gallery-card-cover {
    height: 160px;
    overflow: hidden;
  }
  
  .gallery-card-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .cover-placeholder span {
    font-size: 32px;
    font-weight: bold;
    color: white;
  }
  
  .gallery-card-content {
    padding: 15px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
  }
  
  .card-title {
    margin: 0 0 5px 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
  }
  
  .card-author {
    color: #666;
    font-size: 14px;
    margin-bottom: 10px;
  }
  
  .card-description {
    font-size: 14px;
    color: #555;
    margin: 0 0 10px 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    flex-grow: 1;
  }
  
  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 5px;
  }
  
  .tag {
    background: #f0f0f0;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    color: #666;
  }
  
  .reading-progress {
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .progress-bar {
    flex-grow: 1;
    height: 6px;
    background: #eee;
    border-radius: 3px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: #50567a;
  }
  
  .progress-text {
    font-size: 12px;
    color: #666;
    min-width: 40px;
    text-align: right;
  }
</style> 