<script lang="ts">
  import { parseDataviewTable } from './dataviewParser';
  
  let dataviewQuery = '';
  let basesYaml = '';
  let error: string | null = null;
  let copySuccess = false;
  let showExamples = false;
  let showBasesExample = false;
  let placeFiltersInView = true; // Default to placing filters in view
  
  const examples = [
    {
      name: "Basic Project Tracking",
      query: `TABLE file.name, file.ctime as "Created", file.mtime as "Modified", rating, category
FROM "projects"
WHERE rating >= 4 AND category = "active"
SORT rating DESC
LIMIT 20`
    },
    {
      name: "File Properties",
      query: `TABLE file.name as "Name", file.path as "Path", file.folder as "Folder", file.extension as "Type"
FROM "notes"
SORT file.size DESC
LIMIT 15`
    },
    {
      name: "Files by Date",
      query: `TABLE file.name, file.ctime as "Created Date", file.mtime as "Last Modified", status
WHERE file.ctime > date(2023-01-01)
SORT file.ctime DESC`
    },
    {
      name: "Tag Filtering",
      query: `TABLE file.name as "Task", priority, status, due
FROM #tasks
WHERE status != "completed"
SORT priority DESC, due ASC`
    },
    {
      name: "Formula Example",
      query: `TABLE (round((pages-read/total-pages)*100) + "%") as Progress, priority, status, pages-read, total-pages, title
FROM #books
WHERE status != "completed"
SORT priority DESC, status ASC`
    },
    {
      name: "Nested Conditions",
      query: `TABLE file.name, status, priority, tags, due
FROM "projects"
WHERE (status = "in-progress" OR status = "planning") AND 
      (priority >= 3 OR (contains(tags, "urgent") AND due < date(2023-12-31)))
SORT priority DESC, due ASC
LIMIT 30`
    },
    {
      name: "Upcoming Deadlines (Next 7 Days)",
      query: `TABLE file.name as "Task", due, project
FROM "tasks"
WHERE due >= date(today) AND due <= date(today) + dur(7 days)
SORT due ASC`
    },
    {
      name: "Overdue Tasks",
      query: `TABLE file.name as "Task", due, project, status
FROM "tasks"
WHERE due < date(today) AND status != "completed"
SORT due ASC`
    },
    {
      name: "Files Modified Last Week",
      query: `TABLE file.name, file.mtime as "Modified"
FROM ""
WHERE file.mtime >= date(today) - dur(1 week) AND file.mtime < date(today)
SORT file.mtime DESC`
    },
    {
      name: "Age of Note (Formula)",
      query: `TABLE file.name, (date(today) - file.ctime) as "Age"
FROM "notes"
WHERE file.ctime < date(today) - dur(30 days)
SORT file.ctime ASC`
    },
    {
      name: "Days Until Deadline (Formula)",
      query: `TABLE file.name as "Task", due, (due - date(today)) as "Days Remaining"
FROM "tasks"
WHERE status != "completed" AND due > date(today)
SORT due ASC`
    },
    {
      name: "Tasks Due This Month (Formula)",
      query: `TABLE file.name as "Task", due
FROM "tasks"
WHERE due.month = date(today).month AND due.year = date(today).year AND status != "completed"
SORT due ASC`
    }
  ];

  function convertQuery() {
    try {
      if (!dataviewQuery.trim()) {
        error = "Please enter a Dataview query";
        return;
      }
      
      basesYaml = parseDataviewTable(dataviewQuery, placeFiltersInView);
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      basesYaml = '';
    }
  }
  
  function loadCustomExample(example: typeof examples[0]) {
    dataviewQuery = example.query;
    convertQuery();
    showExamples = false;
  }
  
  function copyToClipboard() {
    navigator.clipboard.writeText(basesYaml);
    copySuccess = true;
    setTimeout(() => copySuccess = false, 2000);
  }
  
  // Copy as base code block
  function copyAsCodeBlock() {
    const codeBlock = '```base\n' + basesYaml + '\n```';
    navigator.clipboard.writeText(codeBlock);
    copySuccess = true;
    setTimeout(() => copySuccess = false, 2000);
  }
  
  // Download the current base content as a .base file with timestamp
  function downloadBase() {
    if (!basesYaml) return;
    
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
    const filename = `New base ${timestamp}.base`;
    
    const blob = new Blob([basesYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  function toggleExamples() {
    showExamples = !showExamples;
    if (showExamples) showBasesExample = false;
  }
</script>

<div class="dataview-converter">
  <div class="converter-header">
    <h2>Dataview to Bases Converter</h2>
    <p>Convert Dataview TABLE queries to Obsidian Bases format</p>
  </div>
  
  <div class="converter-container">
    <div class="input-container">
      <div class="input-header">
        <label for="dataview-input">Dataview Query</label>
        <div class="header-actions">
          <button class="small-button" on:click={toggleExamples}>Example Queries</button>
          {#if showExamples}
            <div class="examples-dropdown">
              {#each examples as example}
                <button class="example-option" on:click={() => loadCustomExample(example)}>
                  {example.name}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      <div class="editor-container">
        <textarea 
          id="dataview-input"
          bind:value={dataviewQuery}
          on:input={convertQuery}
          placeholder="Enter your Dataview TABLE query here..."
          spellcheck="false"
        ></textarea>
      </div>
      
      <div class="actions">
        <div class="filters-placement">
          <label>
            <input type="checkbox" bind:checked={placeFiltersInView} />
            Place filters in views (instead of globally)
          </label>
        </div>
        <button class="primary-button" on:click={convertQuery}>
          <span class="icon">↓</span> Convert to Bases
        </button>
      </div>
    </div>
    
    <div class="output-container">
      <div class="output-header">
        <label for="bases-output">Bases YAML</label>
        <div class="header-actions">
          {#if basesYaml}
            <button class="small-button {copySuccess ? 'success' : ''}" on:click={copyToClipboard}>
              {copySuccess ? '✓ Copied' : 'Copy'}
            </button>
            <button class="small-button" on:click={copyAsCodeBlock}>Copy as Code Block</button>
            <button class="small-button" on:click={downloadBase}>Download as .base</button>
          {/if}
        </div>
      </div>
      <div class="editor-container">
        <textarea 
          id="bases-output"
          bind:value={basesYaml}
          placeholder="Converted Bases YAML will appear here..."
          spellcheck="false"
        ></textarea>
      </div>
    </div>
  </div>
  
  {#if error}
    <div class="error">
      <h3>Error:</h3>
      <pre>{error}</pre>
    </div>
  {/if}
  
  <div class="help-section">
    <div class="usage-section">
      <div class="help-header">
        <h3>How to use</h3>
      </div>
      <div class="usage-steps">
        <ol>
          <li>Enter a Dataview TABLE query in the left box</li>
          <li>Choose whether to place filters in views or globally</li>
          <li>Click "Convert to Bases" to convert it to Bases YAML</li>
          <li>The converted YAML will appear in the right box</li>
          <li>You can also try the Bases YAML examples directly</li>
          <li>Copy the YAML to create a .base file in Obsidian</li>
        </ol>
      </div>
    </div>
    
    <div class="reference-section">
      <div class="help-header">
        <h3>Reference</h3>
      </div>
      <div class="help-content">
        <div class="help-column">
          <h4>Supported Features</h4>
          <ul>
            <li><code>TABLE</code> fields with aliases</li>
            <li><code>FROM</code> source selection (folders, tags)</li>
            <li><code>WHERE</code> conditions (simple AND, OR)</li>
            <li><code>SORT</code> clause with ASC/DESC</li>
            <li><code>LIMIT</code> clause</li>
            <li><code>GROUP BY</code> clause</li>
          </ul>
          
          <h4>Filter Groups</h4>
          <p>Complex filters can be grouped with nested AND/OR logic:</p>
          <pre class="filter-example">filters:
  and:
    - condition1
    - or:
        - condition2
        - condition3
    - and:
        - condition4
        - condition5</pre>
        </div>
        
        <div class="help-column">
          <h4>Column Order & Sorting</h4>
          <p>Bases supports two separate properties for arrangement:</p>
          <pre class="filter-example"># Column order (display order in table)
order:
  - column1
  - column2
  - column3

# Data sorting (how data is ordered)
sort:
  - column: priority
    direction: DESC
  - column: date
    direction: ASC</pre>
          
          <h4>Filter Functions</h4>
          <ul class="file-props filter-list">
            <li><code>contains()</code></li>
            <li><code>not_contains()</code></li>
            <li><code>containsAny()</code></li>
            <li><code>containsAll()</code></li>
            <li><code>startswith()</code></li>
            <li><code>endswith()</code></li>
            <li><code>empty()</code></li>
            <li><code>notEmpty()</code></li>
            <li><code>if()</code></li>
            <li><code>inFolder()</code></li>
            <li><code>linksTo()</code></li>
            <li><code>not()</code></li>
            <li><code>tag()</code></li>
            <li><code>dateBefore()</code></li>
            <li><code>dateAfter()</code></li>
            <li><code>dateEquals()</code></li>
            <li><code>dateNotEquals()</code></li>
            <li><code>dateOnOrBefore()</code></li>
            <li><code>dateOnOrAfter()</code></li>
            <li><code>taggedWith()</code></li>
          </ul>
          
          <h4>File Properties</h4>
          <ul class="file-props">
            <li><code>file.name</code> - file name</li>
            <li><code>file.path</code> - full file path</li>
            <li><code>file.folder</code> - containing folder</li>
            <li><code>file.extension</code> - file extension</li>
            <li><code>file.size</code> - file size</li>
            <li><code>file.ctime</code> - created time</li>
            <li><code>file.mtime</code> - modified time</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .dataview-converter {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 100%;
    color: #333;
    padding-bottom: 20px;
  }
  
  .converter-header {
    text-align: center;
    margin-bottom: 20px;
  }
  
  .converter-header h2 {
    margin-bottom: 5px;
    margin-top: 0px;
    color: #50567a;
    font-size: 24px;
  }
  
  .converter-header p {
    color: #777;
    margin: 0;
    font-size: 16px;
  }
  
  .converter-container {
    display: flex;
    gap: 24px;
    flex: 0 0 auto;
    min-height: 400px;
    margin-bottom: 24px;
  }
  
  .input-container, .output-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
    background: white;
  }
  
  .input-header, .output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f6f8fa;
    border-bottom: 1px solid #e1e4e8;
  }
  
  .header-actions {
    position: relative;
    display: flex;
    gap: 8px;
  }
  
  .examples-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    background: white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    padding: 5px;
    z-index: 10;
    min-width: 220px;
    margin-top: 5px;
    overflow-y: auto;
    max-height: 300px;
  }
  
  .example-option {
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: left;
    background: none;
    color: #333;
    padding: 8px 10px;
    border-radius: 3px;
    margin: 2px 0;
    border: none;
    cursor: pointer;
    font-size: 14px;
  }
  
  .example-option small {
    color: #888;
    font-size: 12px;
    margin-top: 2px;
  }
  
  .example-option:hover {
    background: #f0f0f0;
  }
  
  label {
    font-weight: 600;
    color: #444;
    font-size: 15px;
  }
  
  .editor-container {
    flex-grow: 1;
    position: relative;
    min-height: 300px;
    height: 100%;
  }
  
  textarea {
    width: 100%;
    height: 100%;
    padding: 16px;
    font-family: 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 14px;
    border: none;
    resize: none;
    line-height: 1.5;
    color: #333;
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
  }
  
  textarea:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px #50567a33;
  }
  
  textarea::placeholder {
    color: #999;
  }
  
  .actions {
    padding: 12px 16px;
    background: #f6f8fa;
    border-top: 1px solid #e1e4e8;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .filters-placement {
    font-size: 14px;
    color: #555;
  }
  
  .filters-placement label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: normal;
    cursor: pointer;
  }
  
  button {
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
  }
  
  .primary-button {
    background: #50567a;
    color: white;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
  }
  
  .primary-button:hover {
    background: #3a3f5a;
    transform: translateY(-1px);
  }
  
  .small-button {
    background: white;
    color: #555;
    border: 1px solid #ddd;
    padding: 6px 12px;
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
  
  .icon {
    font-size: 16px;
    font-weight: bold;
  }
  
  .error {
    padding: 14px;
    margin: 16px 0;
    background: #fff5f5;
    border-left: 4px solid #ff5252;
    border-radius: 4px;
  }
  
  .error h3 {
    color: #e53935;
    margin: 0 0 8px 0;
    font-size: 16px;
  }
  
  .error pre {
    margin: 0;
    font-family: monospace;
    overflow-x: auto;
    color: #d32f2f;
    font-size: 14px;
  }
  
  .help-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-top: 0;
  }
  
  .usage-section, .reference-section {
    border-radius: 8px;
    overflow: hidden;
    background: white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
    border: 1px solid #e1e4e8;
  }
  
  .help-header {
    padding: 12px 16px;
    background: #f6f8fa;
    border-bottom: 1px solid #e1e4e8;
  }
  
  .help-header h3 {
    margin: 0;
    font-size: 16px;
    color: #50567a;
    font-weight: 600;
  }
  
  .usage-steps {
    padding: 16px;
  }
  
  .usage-steps ol {
    margin: 0 0 0 20px;
    padding: 0;
  }
  
  .usage-steps li {
    margin-bottom: 8px;
    line-height: 1.4;
  }
  
  .help-content {
    display: flex;
    padding: 16px;
  }
  
  @media (max-width: 768px) {
    .converter-container {
      flex-direction: column;
      gap: 16px;
    }
    
    .help-content {
      flex-direction: column;
    }
    
    .help-column:first-child {
      padding-right: 0;
      padding-bottom: 20px;
      border-right: none;
      border-bottom: 1px solid #eee;
    }
    
    .help-column:last-child {
      padding-left: 0;
      padding-top: 20px;
    }
    
    .filter-list {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .file-props {
      grid-template-columns: 1fr;
      grid-gap: 8px;
    }
    
    .file-props li {
      padding: 8px 12px;
      font-size: 14px;
    }
    
    .usage-steps, .help-content {
      padding: 12px;
    }
    
    .help-column h4 {
      font-size: 16px;
      margin-bottom: 10px;
    }
    
    .help-column h4:not(:first-child) {
      margin-top: 16px;
    }
    
    .header-actions {
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .examples-dropdown {
      right: auto;
      left: 0;
      max-width: calc(100vw - 40px);
    }
    
    .input-header, .output-header, .actions {
      padding: 10px 12px;
    }
    
    textarea {
      padding: 12px;
      font-size: 13px;
    }
    
    .error {
      margin: 12px 0;
      padding: 12px;
    }
    
    .error pre {
      font-size: 12px;
    }
  }
  
  @media (max-width: 480px) {
    .converter-header h2 {
      font-size: 20px;
    }
    
    .converter-header p {
      font-size: 14px;
    }
    
    .filter-list {
      grid-template-columns: 1fr;
      grid-gap: 8px;
    }
    
    .filter-list li {
      padding: 8px 12px;
      font-size: 14px;
    }
    
    .filter-example {
      padding: 10px;
      font-size: 12px;
    }
    
    .small-button {
      padding: 5px 10px;
      font-size: 13px;
    }
    
    .primary-button {
      padding: 8px 14px;
      font-size: 14px;
    }
    
    .usage-steps ol {
      margin-left: 16px;
    }
    
    .usage-steps li {
      font-size: 14px;
      margin-bottom: 6px;
    }
    
    .header-actions {
      font-size: 12px;
    }
    
    .example-option {
      padding: 10px 12px;
    }
    
    .dataview-converter {
      padding: 10px;
      padding-bottom: 16px;
    }
    
    code {
      font-size: 12px;
      padding: 1px 4px;
    }
    
    .help-section {
      gap: 12px;
    }
    
    .filters-placement label {
      padding: 4px 0;
      font-size: 13px;
    }
    
    .filters-placement input[type="checkbox"] {
      width: 16px;
      height: 16px;
      margin-right: 8px;
    }
  }
  
  .help-column {
    flex: 1;
  }
  
  .help-column:first-child {
    padding-right: 20px;
    border-right: 1px solid #eee;
  }
  
  .help-column:last-child {
    padding-left: 20px;
  }
  
  .help-column h4 {
    margin: 0 0 12px 0;
    color: #50567a;
    font-size: 15px;
  }
  
  .help-column h4:not(:first-child) {
    margin-top: 20px;
  }
  
  .help-column ol, .help-column ul {
    margin: 0 0 0 20px;
    padding: 0;
  }
  
  .help-column li {
    margin-bottom: 8px;
    line-height: 1.4;
  }
  
  .file-props {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 6px;
    margin-left: 0 !important;
    list-style: none;
  }
  
  .filter-list {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .file-props li {
    background: #f6f8fa;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 13px;
    margin-bottom: 4px;
    border: 1px solid #e1e4e8;
  }
  
  code {
    background: #f6f8fa;
    padding: 2px 5px;
    border-radius: 3px;
    font-family: 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 13px;
    color: #50567a;
    border: 1px solid #e1e4e8;
  }
  
  .filter-example {
    background: #f6f8fa;
    padding: 12px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 13px;
    color: #333;
    margin: 10px 0;
    white-space: pre;
    overflow-x: auto;
    border: 1px solid #e1e4e8;
  }
</style> 