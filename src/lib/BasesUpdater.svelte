<script lang="ts">
  import { BasesUpdater } from './basesUpdater';
  import { onMount } from 'svelte';

  let oldBasesYaml = '';
  let newBasesYaml = '';
  let updateSummary: string[] = [];
  let error = '';
  let isLoading = false;
  let fileInput: HTMLInputElement;

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
    updateBases();
  }

  function loadFile() {
    fileInput.click();
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        oldBasesYaml = content;
        updateBases();
      };
      reader.readAsText(file);
    }
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
      // Could add a toast notification here
    });
  }

  function clearAll() {
    oldBasesYaml = '';
    newBasesYaml = '';
    updateSummary = [];
    error = '';
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // Auto-update when input changes
  $: if (oldBasesYaml !== undefined) {
    updateBases();
  }
</script>

<div class="bases-updater">
  <div class="header">
    <h1>🔄 Bases Updater</h1>
    <p class="description">
      Convert your old Bases syntax to the new format. Paste your old .base file content below and get the updated syntax.
    </p>
  </div>

  <div class="controls">
    <button on:click={loadFile} class="btn btn-secondary">
      📁 Load .base File
    </button>
    <button on:click={loadExample} class="btn btn-secondary">
      📄 Load Example
    </button>
    <button on:click={clearAll} class="btn btn-secondary">
      🗑️ Clear All
    </button>
  </div>

  <!-- Hidden file input -->
  <input
    type="file"
    accept=".base,.yaml,.yml,.txt"
    bind:this={fileInput}
    on:change={handleFileSelect}
    style="display: none;"
  />

  <div class="content">
    <div class="input-section">
      <div class="section-header">
        <h3>Old Bases Syntax</h3>
        <span class="hint">Paste your old .base file content here or load a file</span>
      </div>
      <textarea
        bind:value={oldBasesYaml}
        placeholder="Paste your old Bases YAML here or click 'Load .base File' to select a file..."
        class="yaml-input"
        rows="20"
      ></textarea>
    </div>

    <div class="output-section">
      <div class="section-header">
        <h3>New Bases Syntax</h3>
        <div class="output-controls">
          {#if newBasesYaml}
            <button on:click={copyToClipboard} class="btn btn-primary">
              📋 Copy
            </button>
          {/if}
        </div>
      </div>

      {#if isLoading}
        <div class="loading">
          <div class="spinner"></div>
          <span>Updating syntax...</span>
        </div>
      {:else if error}
        <div class="error">
          <h4>❌ Error</h4>
          <p>{error}</p>
        </div>
      {:else if newBasesYaml}
        <textarea
          value={newBasesYaml}
          readonly
          class="yaml-output"
          rows="20"
        ></textarea>
      {:else}
        <div class="placeholder">
          <p>Updated syntax will appear here...</p>
        </div>
      {/if}
    </div>
  </div>

  {#if updateSummary.length > 0}
    <div class="summary">
      <h3>📋 Changes Made</h3>
      <ul class="changes-list">
        {#each updateSummary as change}
          <li>✅ {change}</li>
        {/each}
      </ul>
    </div>
  {/if}

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
</div>

<style>
  .bases-updater {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #f8f9fa;
    min-height: 100vh;
  }

  .header {
    text-align: center;
    margin-bottom: 30px;
    padding: 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .header h1 {
    font-size: 2.5rem;
    margin: 0 0 10px 0;
    color: #2c3e50;
    font-weight: 600;
  }

  .description {
    color: #6c757d;
    font-size: 1.1rem;
    margin: 0;
    line-height: 1.5;
  }

  .controls {
    display: flex;
    gap: 12px;
    margin-bottom: 30px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    min-height: 40px;
  }

  .btn-secondary {
    background: #6c757d;
    color: white;
  }

  .btn-secondary:hover {
    background: #5a6268;
    transform: translateY(-1px);
  }

  .btn-primary {
    background: #007bff;
    color: white;
    font-size: 12px;
    padding: 6px 12px;
    min-height: 32px;
  }

  .btn-primary:hover {
    background: #0056b3;
    transform: translateY(-1px);
  }

  .content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 30px;
  }

  .input-section,
  .output-section {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
  }

  .section-header h3 {
    margin: 0;
    color: #2c3e50;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .hint {
    color: #6c757d;
    font-size: 0.9rem;
  }

  .output-controls {
    display: flex;
    gap: 8px;
  }

  .yaml-input,
  .yaml-output {
    flex: 1;
    padding: 20px;
    border: none;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;
    resize: none;
    outline: none;
    background: white;
  }

  .yaml-input {
    background: #fafbfc;
  }

  .yaml-input::placeholder {
    color: #6c757d;
  }

  .yaml-output {
    background: #f8f9fa;
    color: #2c3e50;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: #6c757d;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e9ecef;
    border-top: 2px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error {
    padding: 20px;
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    color: #721c24;
    margin: 20px;
    border-radius: 8px;
  }

  .error h4 {
    margin: 0 0 8px 0;
    font-size: 1rem;
  }

  .error p {
    margin: 0;
    font-family: monospace;
    font-size: 0.9rem;
  }

  .placeholder {
    padding: 40px;
    text-align: center;
    color: #6c757d;
    border: 2px dashed #dee2e6;
    margin: 20px;
    border-radius: 8px;
  }

  .summary {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 30px;
  }

  .summary h3 {
    margin: 0 0 15px 0;
    color: #28a745;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .changes-list {
    margin: 0;
    padding-left: 20px;
  }

  .changes-list li {
    margin-bottom: 8px;
    color: #2c3e50;
    line-height: 1.4;
  }

  .help {
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .help h3 {
    margin: 0 0 20px 0;
    color: #2c3e50;
    font-size: 1.3rem;
    font-weight: 600;
  }

  .help-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 25px;
  }

  .help-item {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #e9ecef;
  }

  .help-item h4 {
    margin: 0 0 12px 0;
    color: #495057;
    font-size: 1rem;
    font-weight: 600;
  }

  .help-item ul {
    margin: 0;
    padding-left: 16px;
  }

  .help-item li {
    margin-bottom: 6px;
    font-size: 0.9rem;
    line-height: 1.4;
    color: #2c3e50;
  }

  .help-item code {
    background: #e9ecef;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-size: 0.85rem;
    color: #e83e8c;
  }

  @media (max-width: 768px) {
    .bases-updater {
      padding: 15px;
    }
    
    .content {
      grid-template-columns: 1fr;
      gap: 15px;
    }
    
    .controls {
      flex-direction: column;
      align-items: center;
    }
    
    .help-grid {
      grid-template-columns: 1fr;
    }
    
    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    
    .output-controls {
      align-self: flex-end;
    }
  }
</style>