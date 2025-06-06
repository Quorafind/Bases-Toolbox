<script lang="ts">
  import { onMount } from 'svelte';
  import * as yaml from 'js-yaml';
  import { applyFormula, getPropertyValue } from './basesParser';
  import { generateDemoFiles } from './mockDataGeneratorLazy';
  import { loadTemplates } from './templateLoader';
  import MapViewLazy from './MapViewLazy.svelte';
  import BoardView from './BoardView.svelte';
  import GalleryView from './GalleryView.svelte';
  import CalendarView from './CalendarView.svelte';
  
  // State
  let baseContent = '';
  let parsedBase: any = null;
  let error: string | null = null;
  let mockFiles: any[] = [];
  let filteredFiles: any[] = [];
  let activeView: number = 0;
  let showTemplateSelector = false;
  let lastTemplate = '';
  let filterRejectionReasons: Record<string, string[]> = {};
  let showFilterDebug = false;
  let baseTemplates: any = {};
  let templatesLoaded = false;

  // Parse Base YAML content
  function parseBase(content: string) {
    try {
      parsedBase = yaml.load(content);
      error = null;
      
      // Reset filter rejection reasons
      filterRejectionReasons = {};
      
      // Attach base data to all files for formula evaluation
      mockFiles = mockFiles.map(file => {
        return { ...file, _baseData: parsedBase };
      });
      
      // Pre-calculate all formulas used in filters to improve performance
      preCalculateFormulas(mockFiles, parsedBase);
      
      // Apply filters to mockFiles with tracking
      const baseFilters = parsedBase?.filters;
      if (baseFilters) {
        filteredFiles = applyFiltersWithTracking(mockFiles, baseFilters, "base");
      } else {
        filteredFiles = [...mockFiles];
      }
      console.log("filteredFiles", filteredFiles);
      // If we have view-specific filters, apply those too
      if (parsedBase?.views && parsedBase.views[activeView]?.filters) {
        filteredFiles = applyFiltersWithTracking(filteredFiles, parsedBase.views[activeView].filters, "view");
        console.log("filteredFiles", filteredFiles);
      }
      console.log("filteredFiles", filteredFiles);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      parsedBase = null;
    }
  }

  // Pre-calculate all formulas that might be used in filters to improve performance
  function preCalculateFormulas(files: any[], baseData: any) {
    // No formulas to calculate
    if (!baseData || !baseData.formulas) return;
    
    // Get all formula keys from the base definition
    const formulaKeys = Object.keys(baseData.formulas);
    
    // Pre-calculate all formulas for each file
    files.forEach(file => {
      // Create a cache object for calculated formulas if it doesn't exist
      if (!file._formulaCache) {
        file._formulaCache = {};
      }
      
      // Calculate each formula and store it in the cache
      formulaKeys.forEach(key => {
        file._formulaCache[key] = applyFormula(file, baseData.formulas[key]);
      });
    });
  }

  // Apply filters and track rejection reasons
  function applyFiltersWithTracking(files: any[], filters: any, source: string): any[] {
    if (!filters) return files;
    
    const rejectedFileReasons: Record<string, string[]> = {};
    
    const result = files.filter((file) => {
      const passes = evaluateFilterWithTracking(file, filters, rejectedFileReasons, file.file.name);
      console.log("tfile", file.file.name, passes, filters);
      return passes;
    });
    
    console.log("result", result);
    // Store rejection reasons
    filterRejectionReasons[source] = Object.entries(rejectedFileReasons)
      .map(([filename, reasons]) => `${filename}: ${reasons.join(', ')}`);
    
    return result;
  }
  
  // Evaluate filter and track rejection reason
  function evaluateFilterWithTracking(file: any, filter: any, rejectionReasons: Record<string, string[]>, filename: string): boolean {
    // Track this rejection if the file fails the filter
    const trackRejection = (reason: string) => {
      if (!rejectionReasons[filename]) {
        rejectionReasons[filename] = [];
      }
      rejectionReasons[filename].push(reason);
      return false;
    };
    
    
    // Handle string expressions (like "status != 'done'")
    if (typeof filter === "string") {
      const result = evaluateExpressionForTracking(file, filter);
      if (!result.passes) {
        return trackRejection(result.reason);
      }
      return true;
    }

    // Handle AND condition
    if (filter.and) {
      for (const condition of filter.and) {
        if (!evaluateFilterWithTracking(file, condition, rejectionReasons, filename)) {
          return false; // Short-circuit on first false condition
        }
      }
      return true; // All conditions passed
    }

    // Handle OR condition
    if (filter.or) {
      const subReasons: Record<string, string[]> = {};
      
      // If none of the OR conditions pass, we want to know why
      const passes = filter.or.some((condition: any) => 
        evaluateFilterWithTracking(file, condition, subReasons, filename)
      );
      
      if (!passes) {
        console.log("subReasons", subReasons);
        // Collect all sub-reasons if nothing passed
        const allReasons = Object.values(subReasons).flat();
        if (allReasons.length > 0) {
          return trackRejection(`Failed all OR conditions: ${allReasons.join(' | ')}`);
        }
        return trackRejection("Failed OR condition");
      }
      
      return true;
    }

    // Handle NOT condition
    if (filter.not) {
      const subReasons: Record<string, string[]> = {};
      
      if (Array.isArray(filter.not)) {
        // If not is an array, none of the conditions should be true
        const shouldFail = filter.not.some((condition: any) =>
          evaluateFilterWithTracking(file, condition, subReasons, filename)
        );
        
        if (shouldFail) {
          return trackRejection("NOT condition was true");
        }
      } else {
        // If not is a single condition, negate it
        const shouldFail = evaluateFilterWithTracking(file, filter.not, subReasons, filename);
        
        if (shouldFail) {
          return trackRejection("NOT condition was true");
        }
      }
      
      return true;
    }

    // Default to true if no recognizable filter structure
    return true;
  }
  
  // Simplified function to evaluate expressions with tracking
  function evaluateExpressionForTracking(file: any, expression: string): {passes: boolean, reason: string} {
    console.log("tfile-v2", file, expression)
    // This is a simplified version - in a real implementation,
    // you would need to adapt the full expression evaluation with detailed reasons
    try {
      // Handle function expressions like taggedWith(file.file, "tag")
      if (expression.includes("(") && expression.includes(")")) {
        const match = expression.match(/(\w+)\((.*)\)/);
        if (!match) {
          return { passes: false, reason: `Invalid function expression: ${expression}` };
        }
        
        const [_, functionName, paramsStr] = match;
        // Parse parameters
        const params = paramsStr.split(',').map(p => p.trim());
        const objPath = params[0];
        const checkValue = params.length > 1 ? params[1].replace(/"/g, '') : '';
        
        // Try to actually evaluate the function for better error reporting
        let passes = false;
        
        // Handle specific function types
        if (functionName === 'taggedWith') {
          // Special handling for taggedWith
          const fileObj = file.file;
          if (fileObj && fileObj.tags && Array.isArray(fileObj.tags)) {
            passes = fileObj.tags.includes(checkValue);
          }
          console.log(passes);
        } else if (functionName === 'linksTo') {
          // Special handling for linksTo
          const fileObj = file.file;
          if (fileObj && fileObj.links && Array.isArray(fileObj.links)) {
            passes = fileObj.links.includes(checkValue);
          }
        } else if (functionName === 'inFolder') {
          // Special handling for inFolder
          const fileObj = file.file;
          if (fileObj && fileObj.folder && fileObj.folder.includes(checkValue)) {
            passes = true;
          }
        }
        
        return { 
          passes: passes, 
          reason: passes ? 'Passed' : `Function '${functionName}' failed for ${objPath} with value ${checkValue}` 
        };
      }

      // Handle comparison expressions
      const comparisons = [
        { op: "==", name: "equals" },
        { op: "!=", name: "not equals" },
        { op: ">=", name: "greater than or equal" },
        { op: "<=", name: "less than or equal" },
        { op: ">", name: "greater than" },
        { op: "<", name: "less than" },
      ];

      for (const { op, name } of comparisons) {
        if (expression.includes(op)) {
          const [left, right] = expression.split(op).map((part) => part.trim());
          const leftValue = getPropertyValue(file, left);
          
          // Parse right value - convert to number if it looks like a number
          let rightValue: any = right.replace(/"/g, '');
          if (!isNaN(Number(right))) {
            rightValue = Number(right);
          }

          let passes = false;

          console.log("leftValue", leftValue, "rightValue", rightValue, "passes", passes);
          // Handle string comparisons
          if (typeof leftValue === "string" && typeof rightValue === "string") {
            if (op === "==") {
              passes = leftValue === rightValue;
            } else if (op === "!=") {
              passes = leftValue !== rightValue;
            } else if (op === "contains") {
              passes = leftValue.includes(rightValue);
            } else if (op === "not_contains") {
              passes = !leftValue.includes(rightValue);
            } else if (op === "starts_with") {
              passes = leftValue.startsWith(rightValue);
            } else if (op === "ends_with") {
              passes = leftValue.endsWith(rightValue);
            } else if (op === "matches") {
              passes = leftValue.match(rightValue) !== null;
            } else if (op === "not_matches") {
              passes = leftValue.match(rightValue) === null;
            }
          } 
          // Handle number comparisons
          else if (typeof leftValue === "number" && typeof rightValue === "number") {
            if (op === "==") {
              passes = leftValue === rightValue;
            } else if (op === "!=") {
              passes = leftValue !== rightValue;
            } else if (op === ">=") {
              passes = leftValue >= rightValue;
            } else if (op === ">") {
              passes = leftValue > rightValue;
            } else if (op === "<=") {
              passes = leftValue <= rightValue;
            } else if (op === "<") {
              passes = leftValue < rightValue;
            }
          }
          // Handle mixed type comparisons with numbers (common when comparing against string values in filters)
          else if (typeof leftValue === "number" && typeof rightValue === "string" && !isNaN(Number(rightValue))) {
            const numRightValue = Number(rightValue);
            if (op === "==") {
              passes = leftValue === numRightValue;
            } else if (op === "!=") {
              passes = leftValue !== numRightValue;
            } else if (op === ">=") {
              passes = leftValue >= numRightValue;
            } else if (op === ">") {
              passes = leftValue > numRightValue;
            } else if (op === "<=") {
              passes = leftValue <= numRightValue; 
            } else if (op === "<") {
              passes = leftValue < numRightValue;
            }
          } 

          else if (typeof leftValue === "boolean" && typeof rightValue === "string") {
            if (op === "==") {
              passes = (leftValue === true && rightValue === "true") || (leftValue === false && rightValue === "false");
            } else if (op === "!=") {
              passes = (leftValue === true && rightValue === "false") || (leftValue === false && rightValue === "true");
            }
          } else if (typeof leftValue === "string" && typeof rightValue === "boolean") {
            if (op === "==") {
              passes = (leftValue === "true" && rightValue === true) || (leftValue === "false" && rightValue === false);
            } else if (op === "!=") {
              passes = (leftValue === "true" && rightValue === false) || (leftValue === "false" && rightValue === true);
            }
          }
          
          console.log(leftValue, rightValue, passes);
          // Format the reason with actual values
          return { 
            passes: passes, 
            reason: `${left} (${leftValue}) ${name} ${right}${typeof rightValue === 'number' ? ' (' + rightValue + ')' : ''}` 
          };
        }
      }
      

      // If it's just a property name
      return { 
        passes: false, 
        reason: `Property ${expression} is falsy` 
      };
    } catch (err) {
      return { passes: false, reason: `Error evaluating '${expression}'` };
    }
  }

  // Handle file drop
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    
    if (!event.dataTransfer?.files.length) return;
    
    const file = event.dataTransfer.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      baseContent = e.target?.result as string;
      parseBase(baseContent);
    };
    
    reader.readAsText(file);
  }

  function preventDefault(event: DragEvent) {
    event.preventDefault();
  }

  // Use first template as initial content
  onMount(async () => {
    try {
      // Load templates
      baseTemplates = await loadTemplates();
      templatesLoaded = true;

      // Set initial content
      if (baseTemplates.basic) {
        baseContent = baseTemplates.basic.yaml;
        lastTemplate = 'basic';
      }

      // Load mock data
      mockFiles = await generateDemoFiles();
      parseBase(baseContent);
    } catch (error) {
      console.error('Failed to initialize:', error);
      error = 'Failed to load initial data';
    }
  });

  // Watch for content changes to regenerate mock data when necessary
  $: {
    // If baseContent changes significantly, regenerate mock data
    const contentHash = baseContent.length > 0 ?
      baseContent.substring(0, 50).replace(/\s/g, '') : '';

    if (contentHash && contentHash !== lastContentHash) {
      lastContentHash = contentHash;
      // Don't regenerate data for minor edits or when the app first loads
      if (mockFilesGenerated) {
        regenerateDataAsync();
      }
    }
  }
  
  let lastContentHash = '';
  let mockFilesGenerated = false;

  // Switch between views
  function setActiveView(index: number) {
    activeView = index;
    
    // Reapply filters if there are view-specific filters
    if (parsedBase?.views && parsedBase.views[index]?.filters) {
      // Reset filter rejection reasons
      filterRejectionReasons = {};
      
      // Ensure we have pre-calculated formulas for base filters
      if (parsedBase.formulas) {
        // Pre-calculate any formula that might be used in the view's filters
        let viewFilter = parsedBase.views[index].filters;
        preCalculateFormulasForFilter(mockFiles, parsedBase, viewFilter);
      }
      
      // Apply base filters first if they exist
      if (parsedBase?.filters) {
        filteredFiles = applyFiltersWithTracking(mockFiles, parsedBase.filters, "base");
      } else {
        filteredFiles = [...mockFiles];
      }
      
      // Then apply view filters
      filteredFiles = applyFiltersWithTracking(
        filteredFiles, 
        parsedBase.views[index].filters,
        "view"
      );
    } else {
      // If there are no view-specific filters, just apply the base filters
      parseBase(baseContent);
    }
  }
  
  // Pre-calculate formulas specifically for a given filter
  function preCalculateFormulasForFilter(files: any[], baseData: any, filter: any) {
    // Helper to extract formula references from a filter string
    const extractFormulaRefs = (filterStr: string): string[] => {
      const refs: string[] = [];
      if (!filterStr) return refs;
      
      // Check for direct formula reference in comparison
      const formulaMatch = filterStr.match(/formula\.([a-zA-Z0-9_]+)/g);
      if (formulaMatch) {
        formulaMatch.forEach(match => {
          refs.push(match.substring(8)); // remove 'formula.' prefix
        });
      }
      
      return refs;
    };
    
    // Process a filter expression recursively
    const processFilter = (f: any): string[] => {
      if (typeof f === 'string') {
        return extractFormulaRefs(f);
      }
      
      let formulaRefs: string[] = [];
      
      // Handle AND condition
      if (f.and) {
        f.and.forEach((condition: any) => {
          formulaRefs = [...formulaRefs, ...processFilter(condition)];
        });
      }
      
      // Handle OR condition
      if (f.or) {
        f.or.forEach((condition: any) => {
          formulaRefs = [...formulaRefs, ...processFilter(condition)];
        });
      }
      
      // Handle NOT condition
      if (f.not) {
        if (Array.isArray(f.not)) {
          f.not.forEach((condition: any) => {
            formulaRefs = [...formulaRefs, ...processFilter(condition)];
          });
        } else {
          formulaRefs = [...formulaRefs, ...processFilter(f.not)];
        }
      }
      
      return formulaRefs;
    };
    
    // Extract all formula references from the filter
    const formulaRefs = processFilter(filter);
    const uniqueRefs = [...new Set(formulaRefs)];
    
    // Pre-calculate only the formulas needed for this filter
    files.forEach(file => {
      // Create a cache object for calculated formulas if it doesn't exist
      if (!file._formulaCache) {
        file._formulaCache = {};
      }
      
      // Calculate only the formulas needed
      uniqueRefs.forEach(key => {
        if (file._formulaCache[key] === undefined && baseData.formulas && baseData.formulas[key]) {
          file._formulaCache[key] = applyFormula(file, baseData.formulas[key]);
        }
      });
    });
  }

  // Generate a new set of random data (async version)
  async function regenerateDataAsync() {
    try {
      mockFiles = await generateDemoFiles();
      mockFilesGenerated = true;

      // Attach base data to all files if we have a parsed base
      if (parsedBase) {
        mockFiles = mockFiles.map(file => {
          return { ...file, _baseData: parsedBase };
        });

        // Pre-calculate formulas for performance
        preCalculateFormulas(mockFiles, parsedBase);
      }

      parseBase(baseContent);
    } catch (error) {
      console.error('Failed to regenerate data:', error);
    }
  }

  // Generate a new set of random data (sync wrapper for button)
  function regenerateData() {
    regenerateDataAsync();
  }
  
  // Apply a template
  async function applyTemplate(templateKey: string) {
    const template = baseTemplates[templateKey as keyof typeof baseTemplates];
    if (template) {
      // Only regenerate data if template changed
      if (lastTemplate !== templateKey) {
        try {
          mockFiles = await generateDemoFiles();
          mockFilesGenerated = true;
          lastTemplate = templateKey;
        } catch (error) {
          console.error('Failed to generate demo files:', error);
          return;
        }
      }

      baseContent = template.yaml;

      // Parse the content to extract the base data
      try {
        const parsedTemplateBase = yaml.load(baseContent);

        // Attach base data to all files if we have a parsed base
        if (parsedTemplateBase) {
          mockFiles = mockFiles.map(file => {
            return { ...file, _baseData: parsedTemplateBase };
          });

          // Pre-calculate formulas for performance
          preCalculateFormulas(mockFiles, parsedTemplateBase);
        }
      } catch (e) {
        console.error("Error parsing template YAML:", e);
      }

      parseBase(baseContent);
      showTemplateSelector = false;
    }
  }
  
  // Toggle template selector
  function toggleTemplateSelector() {
    showTemplateSelector = !showTemplateSelector;
  }
  
  // Toggle filter debug panel
  function toggleFilterDebug() {
    showFilterDebug = !showFilterDebug;
  }

  // Download the current base content as a .base file with timestamp
  function downloadBase() {
    if (!baseContent) return;
    
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
    const filename = `New base ${timestamp}.base`;
    
    const blob = new Blob([baseContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  }
</script>

<div class="preview-app">
  <div class="preview-header">
    <h2>Bases Preview</h2>
    <p>Drag and drop a .base file or edit the YAML directly to preview</p>
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
        bind:value={baseContent}
        on:input={() => parseBase(baseContent)}
        placeholder="Enter your Base YAML here..."
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
          <button on:click={toggleTemplateSelector}>
            Try Example Templates
          </button>
          
          {#if showTemplateSelector && templatesLoaded}
            <div class="template-dropdown">
              {#each Object.entries(baseTemplates) as [key, template]}
                <button
                  class="template-option"
                  on:click={() => applyTemplate(key)}
                >
                  {(template as any)?.name || key}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="action-buttons">
          <button on:click={regenerateData}>Generate New Mock Data</button>
          <button on:click={downloadBase} disabled={!baseContent || !!error}>Download as .base</button>
        </div>
      </div>
    </div>
    
    <div class="preview-container">
      {#if parsedBase}
        <div class="view-tabs">
          {#if parsedBase.views && parsedBase.views.length}
            {#each parsedBase.views as view, i}
              <button 
                class={activeView === i ? 'active' : ''} 
                on:click={() => setActiveView(i)}
              >
                {view.name || `View ${i+1}`}
              </button>
            {/each}
          {:else}
            <button class="active">Default View</button>
          {/if}
        </div>
        
        <div class="view-content">
          {#if filteredFiles.length === 0}
            <div class="empty-results">
              <p>No files match the current filters</p>
              <button on:click={toggleFilterDebug} class="debug-button">
                {showFilterDebug ? 'Hide Filter Debug' : 'Show Filter Debug'}
              </button>
              
              {#if showFilterDebug}
                <div class="filter-debug">
                  <h4>Filter Rejection Reasons:</h4>
                  {#if Object.keys(filterRejectionReasons).length === 0}
                    <p>No specific filter rejection information available.</p>
                  {:else}
                    {#each Object.entries(filterRejectionReasons) as [source, reasons]}
                      <div class="rejection-source">
                        <h5>{source === 'base' ? 'Base Filters' : 'View Filters'}</h5>
                        <ul>
                          {#each reasons.slice(0, 5) as reason}
                            <li>{reason}</li>
                          {/each}
                          {#if reasons.length > 5}
                            <li>... and {reasons.length - 5} more</li>
                          {/if}
                        </ul>
                      </div>
                    {/each}
                  {/if}
                  
                  <h4>Applied Filters:</h4>
                  <pre class="filter-yaml">{parsedBase?.filters ? JSON.stringify(parsedBase.filters, null, 2) : 'No base filters'}</pre>
                  
                  {#if parsedBase?.views && parsedBase.views[activeView]?.filters}
                    <h4>View Specific Filters:</h4>
                    <pre class="filter-yaml">{JSON.stringify(parsedBase.views[activeView].filters, null, 2)}</pre>
                  {/if}
                  
                  <p class="hint">Consider modifying your filters or generating new data that matches your filters.</p>
                </div>
              {/if}
            </div>
          {:else if parsedBase.views && parsedBase.views.length}
            {#if parsedBase.views[activeView].type === 'table'}
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>File</th>
                      {#if parsedBase.display}
                        {#each Object.entries(parsedBase.display) as [prop, name]}
                          <th>{name}</th>
                        {/each}
                      {:else}
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Price</th>
                        <th>Age</th>
                      {/if}
                    </tr>
                  </thead>
                  <tbody>
                    {#each filteredFiles.slice(0, parsedBase.views[activeView].limit || 25) as file}
                      <tr>
                        <td>{file.file.name}</td>
                        {#if parsedBase.display}
                          {#each Object.keys(parsedBase.display) as prop}
                            <td>
                              {#if prop.startsWith('formula.')}
                                {applyFormula(file, parsedBase.formulas?.[prop.substring(8)])}
                              {:else}
                                {getPropertyValue(file, prop)}
                              {/if}
                            </td>
                          {/each}
                        {:else}
                          <td>{file.status}</td>
                          <td>{file.priority}</td>
                          <td>{file.price}</td>
                          <td>{file.age}</td>
                        {/if}
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else if parsedBase.views[activeView].type === 'map'}
              <div class="map-view">
                <MapViewLazy
                  files={filteredFiles.filter(f => f.has_coords)}
                  latField={parsedBase.views[activeView].lat || 'lat'}
                  longField={parsedBase.views[activeView].long || 'long'}
                  titleField={parsedBase.views[activeView].title || 'file.name'}
                />
              </div>
            {:else if parsedBase.views[activeView].type === 'board'}
              <div class="board-view-container">
                <BoardView 
                  files={filteredFiles}
                  groupBy={parsedBase.views[activeView].group_by || 'status'}
                  titleField={parsedBase.views[activeView].title_field || 'file.name'}
                  descriptionField={parsedBase.views[activeView].description_field || 'summary'}
                  limit={parsedBase.views[activeView].limit || 50}
                />
              </div>
            {:else if parsedBase.views[activeView].type === 'gallery'}
              <div class="gallery-view-container">
                <GalleryView 
                  files={filteredFiles}
                  titleField={parsedBase.views[activeView].title_field || 'file.name'}
                  descriptionField={parsedBase.views[activeView].description_field || 'summary'}
                  coverField={parsedBase.views[activeView].cover_field || ''}
                  limit={parsedBase.views[activeView].limit || 50}
                />
              </div>
            {:else if parsedBase.views[activeView].type === 'calendar'}
              <div class="calendar-view-container">
                <CalendarView 
                  files={filteredFiles}
                  dateField={parsedBase.views[activeView].date_field || 'created'}
                  titleField={parsedBase.views[activeView].title_field || 'file.name'}
                  descriptionField={parsedBase.views[activeView].description_field || 'summary'}
                />
              </div>
            {:else}
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Price</th>
                      <th>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each filteredFiles.slice(0, 25) as file}
                      <tr>
                        <td>{file.file.name}</td>
                        <td>{file.status}</td>
                        <td>{file.priority}</td>
                        <td>{file.price}</td>
                        <td>{file.age}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          {:else}
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Price</th>
                    <th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredFiles.slice(0, 25) as file}
                    <tr>
                      <td>{file.file.name}</td>
                      <td>{file.status}</td>
                      <td>{file.priority}</td>
                      <td>{file.price}</td>
                      <td>{file.age}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
        
        <div class="file-count">
          Showing {filteredFiles.slice(0, parsedBase.views?.[activeView]?.limit || 25).length} of {filteredFiles.length} files
          {#if filteredFiles.length === 0 && mockFiles.length > 0}
            <button on:click={toggleFilterDebug} class="debug-button-small">
              {showFilterDebug ? 'Hide Debug' : 'Show Debug'}
            </button>
          {/if}
        </div>
      {:else}
        <div class="empty-state">
          <p>Enter a valid Base YAML to see the preview</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .preview-app {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 100%;
    max-height: 100vh;
    overflow: hidden;
  }
  
  .preview-header {
    text-align: center;
    margin-bottom: 20px;
  }
  
  .preview-header h2 {
    margin-bottom: 5px;
    margin-top: 0;
    color: #50567a;
  }
  
  .preview-header p {
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
  
  .action-buttons {
    display: flex;
    gap: 10px;
  }
  
  .template-selector {
    position: relative;
  }
  
  .template-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    background: white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    padding: 5px;
    z-index: 10;
    min-width: 200px;
    margin-bottom: 5px;
  }
  
  .template-option {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    color: #333;
    padding: 8px 10px;
    border-radius: 3px;
    margin: 2px 0;
  }
  
  .template-option:hover {
    background: #f0f0f0;
  }
  
  .view-tabs {
    display: flex;
    padding: 10px;
    border-bottom: 1px solid #eee;
    background: #f9f9f9;
    flex-wrap: wrap;
    gap: 5px;
  }
  
  .view-tabs button {
    background: none;
    border: none;
    padding: 8px 15px;
    margin-right: 5px;
    border-radius: 4px;
    cursor: pointer;
    color: #666;
  }
  
  .view-tabs button.active {
    background: #50567a;
    color: white;
    font-weight: 500;
  }
  
  .view-content {
    flex: 1;
    overflow: hidden;
    padding: 10px;
    display: flex;
    flex-direction: column;
    max-height: calc(100% - 80px);
  }
  
  .table-container {
    flex: 1;
    overflow: auto;
    max-height: 100%;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th {
    background: #f5f5f5;
    padding: 8px 10px;
    text-align: left;
    border-bottom: 2px solid #ddd;
    font-weight: 600;
    color: #333;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  
  td {
    padding: 6px 10px;
    border-bottom: 1px solid #eee;
  }
  
  tr:hover td {
    background: #f9f9f9;
  }
  
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #888;
  }
  
  .map-view {
    height: 100%;
    width: 100%;
    position: relative;
  }
  
  .board-view-container,
  .gallery-view-container,
  .calendar-view-container {
    height: 100%;
    width: 100%;
    overflow: hidden;
    display: flex;
  }
  
  .file-count {
    padding: 10px;
    color: #888;
    font-size: 14px;
    text-align: right;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }
  
  .empty-results {
    padding: 30px;
    text-align: center;
    color: #666;
    flex-grow: 1;
    overflow: auto;
  }
  
  .debug-button, .debug-button-small {
    background: #f5f5f5;
    color: #50567a;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 14px;
    margin-top: 10px;
  }
  
  .debug-button-small {
    font-size: 12px;
    padding: 4px 8px;
    margin-top: 0;
  }
  
  .debug-button:hover, .debug-button-small:hover {
    background: #e9e9e9;
  }
  
  .filter-debug {
    margin-top: 20px;
    text-align: left;
    background: #f9f9f9;
    border: 1px solid #eee;
    border-radius: 6px;
    padding: 15px;
    max-height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  .filter-debug h4 {
    color: #50567a;
    margin: 10px 0 5px 0;
    font-size: 16px;
  }
  
  .filter-debug h5 {
    color: #666;
    margin: 5px 0;
    font-size: 14px;
  }
  
  .rejection-source {
    margin-bottom: 15px;
  }
  
  .filter-debug ul {
    margin: 0;
    padding-left: 20px;
  }
  
  .filter-debug li {
    margin-bottom: 3px;
    font-size: 13px;
  }
  
  .filter-yaml {
    background: #f0f0f0;
    padding: 10px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    white-space: pre-wrap;
    overflow-x: auto;
  }
  
  .hint {
    margin-top: 15px;
    font-style: italic;
    color: #888;
  }
</style> 