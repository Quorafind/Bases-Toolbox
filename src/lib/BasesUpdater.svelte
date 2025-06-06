<script lang="ts">
  import { BasesUpdater } from './basesUpdater';
  import { onMount } from 'svelte';

  let oldBasesYaml = '';
  let newBasesYaml = '';
  let updateSummary: string[] = [];
  let error = '';
  let isLoading = false;
  let copySuccess = false;

  const updater = new BasesUpdater();

  // Example old syntax for demonstration
  const exampleOldSyntax = `filters:
  or:
    - taggedWith(file.file, "tag")
    - and:
        - taggedWith(file.file, "book")
        - linksTo(file.file, "Textbook")
    - not:
        - taggedWith(file.file, "book")
        - inFolder(file.file, "Required Reading")
formulas:
  formatted_price: 'if(price, concat(price.toFixed(2), " dollars"))'
  ppu: "(price / age).toFixed(2)"
  full_name: 'join("", first_name, " ", last_name)'
  description: 'concat("Item: ", title, " - Price: $", price)'
  category_label: 'join(" | ", category, subcategory, type)'
  tags_display: 'tags.join(", ")'
  simple_concat: 'concat("Hello ", name, "!")'
  nested_example: 'if(available, concat("Available: ", title), "Not available")'
  complex_join: 'join("", "Product: ", if(title, title, "Unknown"), " (", category, ")")'

display:
  status: Status
  formula.formatted_price: "Price"
  formula.full_name: "Full Name"
  formula.description: "Description"
  formula.nested_example: "Availability"
  "file.extension": Extension
views:
  - type: table
    name: "My table"
    limit: 10
    filters:
      and:
        - 'status != "done"'
        - or:
            - "formula.ppu > 5"
            - "price > 2.1"
    group_by: "status"
    sort:
      - column: file.name
        direction: ASC
      - column: file.extension
        direction: DESC
    order:
      - file.name
      - file.extension
      - property.age
      - formula.ppu
      - formula.formatted_price`;

  function loadExample() {
    oldBasesYaml = exampleOldSyntax;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();

    if (!event.dataTransfer?.files.length) return;

    const file = event.dataTransfer.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      oldBasesYaml = e.target?.result as string;
    };

    reader.readAsText(file);
  }

  function preventDefault(event: DragEvent) {
    event.preventDefault();
  }

  function updateBases() {
    if (!oldBasesYaml.trim()) {
      newBasesYaml = '';
      updateSummary = [];
      error = '';
      return;
    }

    isLoading = true;
    error = '';

    try {
      newBasesYaml = updater.updateBasesYaml(oldBasesYaml);
      updateSummary = updater.getUpdateSummary(oldBasesYaml, newBasesYaml);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      newBasesYaml = '';
      updateSummary = [];
    } finally {
      isLoading = false;
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(newBasesYaml).then(() => {
      copySuccess = true;
      setTimeout(() => copySuccess = false, 2000);
    });
  }

  function downloadBase() {
    if (!newBasesYaml) return;

    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
    const filename = `Updated base ${timestamp}.base`;

    const blob = new Blob([newBasesYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  // Auto-update when input changes
  $: if (oldBasesYaml !== undefined) {
    updateBases();
  }

  // Use example as initial content
  onMount(() => {
    oldBasesYaml = exampleOldSyntax;
  });
</script>

<div class="updater-app">
  <div class="updater-header">
    <h2>Bases Syntax Updater</h2>
    <p>Drag and drop a .base file or edit the YAML directly to update to the latest syntax</p>
  </div>

  <div class="content-container">
    <div class="editor-container">
      <div
        class="dropzone"
        on:dragover={preventDefault}
        on:dragenter={preventDefault}
        on:drop={handleDrop}
      >
        <p>Drop your .base file here</p>
      </div>

      <textarea
        bind:value={oldBasesYaml}
        placeholder="Enter your old Bases YAML here..."
        spellcheck="false"
      ></textarea>

      {#if error}
        <div class="error">
          <h3>Error:</h3>
          <pre>{error}</pre>
        </div>
      {/if}

      <div class="actions">
        <div class="template-selector">
          <button on:click={loadExample}>
            Load Example
          </button>
        </div>


      </div>
    </div>

    <div class="preview-container">
      {#if isLoading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Updating syntax...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <h3>❌ Error</h3>
          <pre>{error}</pre>
        </div>
      {:else if newBasesYaml}
        <div class="result-content">
          <div class="result-header">
            <div class="result-title">
              <h3>Updated Syntax</h3>
              {#if updateSummary.length > 0}
                <span class="changes-count">{updateSummary.length} changes made</span>
              {/if}
            </div>
            <div class="header-actions">
              <button class="small-button {copySuccess ? 'success' : ''}" on:click={copyToClipboard} disabled={!newBasesYaml || !!error}>
                {copySuccess ? '✓ Copied!' : '📋 Copy'}
              </button>
              <button class="small-button" on:click={downloadBase} disabled={!newBasesYaml || !!error}>Download as .base</button>
            </div>
          </div>

          <textarea
            value={newBasesYaml}
            readonly
            class="yaml-output"
          ></textarea>

          {#if updateSummary.length > 0}
            <div class="changes-summary">
              <h4>📋 Changes Made</h4>
              <ul class="changes-list">
                {#each updateSummary as change}
                  <li>✅ {change}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {:else}
        <div class="empty-state">
          <p>Enter old Bases YAML to see the updated syntax</p>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if updateSummary.length > 0 || newBasesYaml}
  <div class="help">
    <h3>🔧 What gets updated?</h3>
    <div class="help-grid">
      <div class="help-item">
        <h4>File Functions</h4>
        <ul>
          <li><code>inFolder(file.file, "folder")</code> → <code>file.inFolder("folder")</code></li>
          <li><code>taggedWith(file.file, "tag")</code> → <code>file.hasTag("tag")</code></li>
          <li><code>linksTo(file.file, "file")</code> → <code>file.hasLink("file")</code></li>
        </ul>
      </div>

      <div class="help-item">
        <h4>Boolean Operators</h4>
        <ul>
          <li><code>and</code> → <code>&&</code></li>
          <li><code>or</code> → <code>||</code></li>
          <li><code>not()</code> → <code>!()</code></li>
        </ul>
      </div>

      <div class="help-item">
        <h4>String Operations</h4>
        <ul>
          <li><code>concat(a, b, c)</code> → <code>a + b + c</code></li>
          <li><code>join("", a, b)</code> → <code>a + b</code></li>
          <li><code>join(" ", a, b)</code> → <code>a + " " + b</code></li>
          <li><code>array.join("")</code> → <code>array</code></li>
          <li><code>array.join(", ")</code> → <code>array.join(", ")</code></li>
          <li><code>len()</code> → <code>length()</code></li>
          <li><code>empty()</code> → <code>isEmpty()</code></li>
          <li><code>notEmpty()</code> → <code>!isEmpty()</code></li>
        </ul>
      </div>

      <div class="help-item">
        <h4>Properties & Functions</h4>
        <ul>
          <li><code>file.extension</code> → <code>file.ext</code></li>
          <li><code>dateFormat()</code> → <code>format()</code></li>
          <li><code>average()</code> → <code>average()</code></li>
        </ul>
      </div>

      <div class="help-item">
        <h4>Date & Time</h4>
        <ul>
          <li><code>dateModify(date, "1 day")</code> → <code>date + "1 day"</code></li>
          <li><code>duration("1 day")</code> → <code>"1 day"</code></li>
          <li><code>dateDiff(a, b)</code> → <code>a - b</code></li>
        </ul>
      </div>

      <div class="help-item">
        <h4>View Configuration</h4>
        <ul>
          <li>Sort directions: <code>ASC/DESC</code> → <code>asc/desc</code></li>
          <li>Filter syntax updated to new format</li>
          <li>Formula expressions simplified</li>
        </ul>
      </div>
    </div>
  </div>
{/if}

<style>
  .updater-app {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 100%;
    max-height: 100vh;
    overflow: hidden;
  }

  .updater-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .updater-header h2 {
    margin-bottom: 5px;
    margin-top: 0;
    color: #50567a;
  }

  .updater-header p {
    color: #888;
    margin: 0;
  }

  .content-container {
    display: flex;
    gap: 20px;
    flex: 1;
    min-height: 500px;
    max-height: calc(100vh - 200px);
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .content-container {
      flex-direction: column;
    }

    .result-header {
      padding: 10px 12px;
    }

    .result-title {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .header-actions {
      gap: 6px;
      flex-wrap: wrap;
    }

    .small-button {
      padding: 5px 10px;
      font-size: 13px;
    }
  }

  .editor-container, .preview-container {
    flex: 1;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 500px;
  }

  .dropzone {
    padding: 20px;
    border: 2px dashed #ddd;
    border-radius: 6px;
    margin: 10px;
    text-align: center;
    color: #888;
    cursor: pointer;
  }

  textarea {
    flex-grow: 1;
    padding: 10px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 14px;
    border: none;
    border-top: 1px solid #eee;
    resize: none;
    outline: none;
    line-height: 1.4;
    min-height: 0;
  }

  .error {
    padding: 10px;
    margin: 10px;
    background: #fff0f0;
    border-left: 3px solid #f00;
  }

  .error h3 {
    color: #d00;
    margin: 0 0 5px 0;
    font-size: 16px;
  }

  .error pre {
    margin: 0;
    font-family: monospace;
    overflow-x: auto;
  }

  .actions {
    padding: 10px;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: space-between;
  }

  .actions button {
    background: #50567a;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .actions button:hover {
    background: #3a3f5a;
  }

  .actions button:disabled {
    background: #a0a0a0;
    cursor: not-allowed;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .small-button {
    background: white;
    color: #555;
    border: 1px solid #ddd;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .small-button:hover {
    background: #f0f0f0;
    border-color: #ccc;
  }

  .small-button.success {
    background: #4caf50;
    color: white;
    border-color: #4caf50;
  }

  .small-button:disabled {
    background: #f5f5f5;
    color: #a0a0a0;
    border-color: #e0e0e0;
    cursor: not-allowed;
  }

  .template-selector {
    position: relative;
  }

  .loading-state, .error-state, .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #888;
    flex-direction: column;
    gap: 10px;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e9ecef;
    border-top: 2px solid #50567a;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .result-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .result-header {
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    background: #f6f8fa;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .result-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .result-header h3 {
    margin: 0;
    color: #50567a;
    font-size: 16px;
    font-weight: 600;
  }

  .changes-count {
    background: #28a745;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
  }
 
  .yaml-output {
    flex: 1;
    padding: 10px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 14px;
    border: none;
    resize: none;
    outline: none;
    line-height: 1.4;
    background: #f8f9fa;
    min-height: 0;
  }

  .changes-summary {
    padding: 10px;
    border-top: 1px solid #eee;
    background: #f9f9f9;
    max-height: 200px;
    overflow-y: auto;
  }

  .changes-summary h4 {
    margin: 0 0 10px 0;
    color: #28a745;
    font-size: 14px;
  }

  .changes-list {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
  }

  .changes-list li {
    margin-bottom: 5px;
    color: #333;
    line-height: 1.3;
  }

  .help {
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-top: 20px;
  }

  .help h3 {
    margin: 0 0 20px 0;
    color: #50567a;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .help-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }

  .help-item {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 6px;
    border: 1px solid #e9ecef;
  }

  .help-item h4 {
    margin: 0 0 10px 0;
    color: #495057;
    font-size: 14px;
    font-weight: 600;
  }

  .help-item ul {
    margin: 0;
    padding-left: 16px;
  }

  .help-item li {
    margin-bottom: 4px;
    font-size: 13px;
    line-height: 1.3;
    color: #333;
  }

  .help-item code {
    background: #e9ecef;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 12px;
    color: #e83e8c;
  }

  @media (max-width: 768px) {
    .help-grid {
      grid-template-columns: 1fr;
    }
  }
</style>