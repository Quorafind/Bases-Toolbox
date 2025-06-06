import * as yaml from "js-yaml";

/**
 * Bases Updater - Converts old Bases syntax to new syntax
 */
export class BasesUpdater {
  /**
   * Convert old Bases YAML to new syntax
   */
  updateBasesYaml(oldYaml: string): string {
    try {
      const parsed = yaml.load(oldYaml) as any;
      const updated = this.updateBasesObject(parsed);
      return yaml.dump(updated, {
        quotingType: '"',
        forceQuotes: false,
        lineWidth: -1,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to parse YAML: ${errorMessage}`);
    }
  }

  /**
   * Update a Bases object to new syntax
   */
  private updateBasesObject(bases: any): any {
    if (!bases || typeof bases !== "object") {
      return bases;
    }

    const updated = { ...bases };

    // Update filters
    if (updated.filters) {
      updated.filters = this.updateFilters(updated.filters);
    }

    // Update formulas
    if (updated.formulas) {
      updated.formulas = this.updateFormulas(updated.formulas);
    }

    // Update views
    if (updated.views && Array.isArray(updated.views)) {
      updated.views = updated.views.map((view: any) => this.updateView(view));
    }

    // Update display properties
    if (updated.display) {
      updated.display = this.updateDisplayProperties(updated.display);
    }

    return updated;
  }

  /**
   * Update filters to new syntax
   */
  private updateFilters(filters: any): any {
    if (typeof filters === "string") {
      return this.updateFilterExpression(filters);
    }

    if (typeof filters === "object" && filters !== null) {
      const updated: any = {};

      for (const [key, value] of Object.entries(filters)) {
        if (key === "and" || key === "or" || key === "not") {
          if (Array.isArray(value)) {
            updated[key] = value.map((item) => this.updateFilters(item));
          } else {
            updated[key] = this.updateFilters(value);
          }
        } else {
          updated[key] = value;
        }
      }

      return updated;
    }

    return filters;
  }

  /**
   * Update a single filter expression string
   */
  private updateFilterExpression(expression: string): string {
    let updated = expression;

    // Update function calls
    const functionUpdates: Record<string, string> = {
      // File functions - convert to method style
      "inFolder\\(file\\.file,\\s*([^)]+)\\)": "file.inFolder($1)",
      "taggedWith\\(file\\.file,\\s*([^)]+)\\)": "file.hasTag($1)",
      "linksTo\\(file\\.file,\\s*([^)]+)\\)": "file.hasLink($1)",

      // Boolean operators
      "\\s+and\\s+": " && ",
      "\\s+or\\s+": " || ",
      "not\\(([^)]+)\\)": "!($1)",

      // Function name updates
      "\\blen\\(": "length(",
      "\\bcontainsAny\\(": "containsAny(",
      "\\bcontainsAll\\(": "containsAll(",
      "\\bstartswith\\(": "startsWith(",
      "\\bendswith\\(": "endsWith(",
      "\\bempty\\(": "isEmpty(",
      "\\bnotEmpty\\(": "!isEmpty(",
      "\\baverage\\(": "average(",

      // Date functions
      "\\bdateFormat\\(": "format(",
      "\\bdateModify\\(": "+",
      "\\bdateDiff\\(": "-",

      // Property updates
      "\\bfile\\.extension\\b": "file.ext",

      // Duration format updates
      'duration\\("([^"]+)"\\)': '"$1"',
    };

    for (const [pattern, replacement] of Object.entries(functionUpdates)) {
      const regex = new RegExp(pattern, "g");
      updated = updated.replace(regex, replacement);
    }

    // Handle string concatenation functions
    updated = this.convertStringConcatenation(updated);

    // Handle date arithmetic - convert dateModify calls to + operator
    updated = updated.replace(
      /dateModify\(([^,]+),\s*"([^"]+)"\)/g,
      '$1 + "$2"'
    );

    // Handle negated duration in date arithmetic
    updated = updated.replace(/\+\s*"-([^"]+)"/g, '+ "-$1"');

    return updated;
  }

  /**
   * Update formulas to new syntax
   */
  private updateFormulas(
    formulas: Record<string, string>
  ): Record<string, string> {
    const updated: Record<string, string> = {};

    for (const [key, formula] of Object.entries(formulas)) {
      updated[key] = this.updateFormulaExpression(formula);
    }

    return updated;
  }

  /**
   * Update a single formula expression
   */
  private updateFormulaExpression(formula: string): string {
    let updated = formula;

    // Update function calls in formulas
    const formulaUpdates: Record<string, string> = {
      // Method calls
      "\\.toFixed\\(": ".toFixed(",
      "\\.toString\\(": ".toString(",
      "\\.trim\\(": ".trim(",
      "\\.title\\(": ".title(",
      "\\.split\\(": ".split(",
      "\\.replace\\(": ".replace(",
      "\\.slice\\(": ".slice(",
      "\\.reverse\\(": ".reverse(",
      "\\.sort\\(": ".sort(",
      "\\.flat\\(": ".flat(",
      "\\.unique\\(": ".unique(",
      "\\.contains\\(": ".contains(",
      "\\.containsAny\\(": ".containsAny(",
      "\\.containsAll\\(": ".containsAll(",
      "\\.startsWith\\(": ".startsWith(",
      "\\.endsWith\\(": ".endsWith(",
      "\\.isEmpty\\(": ".isEmpty(",

      // Math functions
      "\\.round\\(": ".round(",
      "\\.floor\\(": ".floor(",
      "\\.ceil\\(": ".ceil(",
      "\\.abs\\(": ".abs(",

      // Date properties
      "\\.year\\b": ".year",
      "\\.month\\b": ".month",
      "\\.day\\b": ".day",
      "\\.hour\\b": ".hour",
      "\\.minute\\b": ".minute",
      "\\.second\\b": ".second",
      "\\.millisecond\\b": ".millisecond",

      // Date methods
      "\\.format\\(": ".format(",
      "\\.date\\(": ".date(",
      "\\.time\\(": ".time(",

      // Array/String methods
      "\\.length\\b": ".length",

      // Boolean operators in formulas
      "\\s+and\\s+": " && ",
      "\\s+or\\s+": " || ",

      // Function name updates
      "\\blen\\(": "length(",
      "\\baverage\\(": "average(",
    };

    for (const [pattern, replacement] of Object.entries(formulaUpdates)) {
      const regex = new RegExp(pattern, "g");
      updated = updated.replace(regex, replacement);
    }

    // Handle string concatenation functions
    updated = this.convertStringConcatenation(updated);

    return updated;
  }

  /**
   * Update view configuration
   */
  private updateView(view: any): any {
    if (!view || typeof view !== "object") {
      return view;
    }

    const updated = { ...view };

    // Update filters in view
    if (updated.filters) {
      updated.filters = this.updateFilters(updated.filters);
    }

    // Update sort configuration
    if (updated.sort && Array.isArray(updated.sort)) {
      updated.sort = updated.sort.map((sortItem: any) => {
        if (typeof sortItem === "object" && sortItem.direction) {
          return {
            ...sortItem,
            direction: sortItem.direction.toLowerCase(), // ASC/DESC -> asc/desc
          };
        }
        return sortItem;
      });
    }

    return updated;
  }

  /**
   * Update display property names
   */
  private updateDisplayProperties(
    display: Record<string, string>
  ): Record<string, string> {
    const updated: Record<string, string> = {};

    for (const [key, value] of Object.entries(display)) {
      let updatedKey = key;

      // Update property names
      if (key === "file.extension") {
        updatedKey = "file.ext";
      }

      updated[updatedKey] = value;
    }

    return updated;
  }

  /**
   * Get a summary of changes made
   */
  getUpdateSummary(oldYaml: string, newYaml: string): string[] {
    const changes: string[] = [];

    // Check for specific patterns that were updated
    const patterns = [
      {
        old: /inFolder\(file\.file,/,
        new: /file\.inFolder\(/,
        desc: "Updated inFolder() to file.inFolder()",
      },
      {
        old: /taggedWith\(file\.file,/,
        new: /file\.hasTag\(/,
        desc: "Updated taggedWith() to file.hasTag()",
      },
      {
        old: /linksTo\(file\.file,/,
        new: /file\.hasLink\(/,
        desc: "Updated linksTo() to file.hasLink()",
      },
      { old: /\sand\s/, new: /&&/, desc: 'Updated "and" to "&&"' },
      { old: /\sor\s/, new: /\|\|/, desc: 'Updated "or" to "||"' },
      { old: /not\(/, new: /!\(/, desc: "Updated not() to !()" },
      {
        old: /file\.extension/,
        new: /file\.ext/,
        desc: "Updated file.extension to file.ext",
      },
      {
        old: /dateModify\(/,
        new: /\+/,
        desc: "Updated dateModify() to + operator",
      },
      {
        old: /ASC|DESC/,
        new: /asc|desc/,
        desc: "Updated sort direction to lowercase",
      },
      {
        old: /concat\(/,
        new: /\+/,
        desc: "Updated concat() to + operator for string concatenation",
      },
      {
        old: /join\("",/,
        new: /\+/,
        desc: 'Updated join("", ...) to + operator for string concatenation',
      },
      {
        old: /join\("[^"]*",/,
        new: /\+/,
        desc: "Updated join() with separator to + operator",
      },
      {
        old: /\.join\(""/,
        new: /\+/,
        desc: 'Updated .join("") to + operator for string concatenation',
      },
      {
        old: /duration\("/,
        new: /"/,
        desc: "Updated duration() function to string format",
      },
      { old: /len\(/, new: /length\(/, desc: "Updated len() to length()" },
      {
        old: /empty\(/,
        new: /isEmpty\(/,
        desc: "Updated empty() to isEmpty()",
      },
      {
        old: /notEmpty\(/,
        new: /!isEmpty\(/,
        desc: "Updated notEmpty() to !isEmpty()",
      },
    ];

    for (const pattern of patterns) {
      if (pattern.old.test(oldYaml) && pattern.new.test(newYaml)) {
        changes.push(pattern.desc);
      }
    }

    return changes;
  }

  /**
   * Convert string concatenation functions to + operator
   */
  private convertStringConcatenation(expression: string): string {
    let updated = expression;
    let previousUpdate = "";

    // Keep applying transformations until no more changes are made
    while (updated !== previousUpdate) {
      previousUpdate = updated;

      // Handle concat() function calls
      updated = this.replaceFunctionCalls(updated, "concat", (args) => {
        const argList = this.parseArguments(args);
        return argList.join(" + ");
      });

      // Handle join() function calls with empty string separator
      updated = this.replaceFunctionCalls(updated, "join", (args) => {
        const argList = this.parseArguments(args);
        if (
          argList.length > 0 &&
          (argList[0] === '""' || argList[0] === "''")
        ) {
          // Remove the empty separator and join the rest
          return argList.slice(1).join(" + ");
        }
        // Handle join with separator
        if (argList.length > 1) {
          const separator = argList[0];
          const cleanSeparator = separator.slice(1, -1); // Remove quotes
          if (cleanSeparator === "") {
            return argList.slice(1).join(" + ");
          } else {
            return argList.slice(1).join(` + ${separator} + `);
          }
        }
        return args; // Return original if can't parse
      });
    }

    // Handle .join() method calls on arrays
    updated = updated.replace(
      /(\w+)\.join\s*\(\s*"([^"]*)"\s*\)/g,
      (match, arrayName, separator) => {
        if (separator === "") {
          return arrayName; // Direct concatenation for empty separator
        } else {
          return `${arrayName}.join("${separator}")`;
        }
      }
    );

    return updated;
  }

  /**
   * Replace function calls with a transformation function
   */
  private replaceFunctionCalls(
    text: string,
    functionName: string,
    transform: (args: string) => string
  ): string {
    const regex = new RegExp(`\\b${functionName}\\s*\\(`, "g");
    let result = "";
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const startIndex = match.index;
      const openParenIndex = match.index + match[0].length - 1;

      // Add text before the function call
      result += text.substring(lastIndex, startIndex);

      // Find the matching closing parenthesis
      const args = this.extractArgumentsFromPosition(text, openParenIndex);
      if (args !== null) {
        // Apply the transformation
        const transformed = transform(args);
        result += transformed;
        lastIndex = openParenIndex + args.length + 2; // +2 for the parentheses
      } else {
        // If we can't parse it, keep the original
        result += match[0];
        lastIndex = regex.lastIndex;
      }
    }

    // Add remaining text
    result += text.substring(lastIndex);
    return result;
  }

  /**
   * Extract arguments from a function call starting at the opening parenthesis
   */
  private extractArgumentsFromPosition(
    text: string,
    openParenIndex: number
  ): string | null {
    let depth = 0;
    let inQuotes = false;
    let quoteChar = "";
    let i = openParenIndex;

    while (i < text.length) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : "";

      if ((char === '"' || char === "'") && prevChar !== "\\") {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = "";
        }
      }

      if (!inQuotes) {
        if (char === "(") {
          depth++;
        } else if (char === ")") {
          depth--;
          if (depth === 0) {
            // Found the matching closing parenthesis
            return text.substring(openParenIndex + 1, i);
          }
        }
      }

      i++;
    }

    return null;
  }

  /**
   * Extract a complete function call with proper parentheses matching
   */
  private extractFunctionCall(
    text: string,
    startOffset: number,
    functionName: string
  ): { args: string } | null {
    // Find the opening parenthesis
    const openParenIndex = text.indexOf("(", startOffset);
    if (openParenIndex === -1) return null;

    const args = this.extractArgumentsFromPosition(text, openParenIndex);
    return args !== null ? { args } : null;
  }

  /**
   * Parse function arguments, handling nested parentheses and quotes
   */
  private parseArguments(argsString: string): string[] {
    const args: string[] = [];
    let current = "";
    let depth = 0;
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      const prevChar = i > 0 ? argsString[i - 1] : "";

      if ((char === '"' || char === "'") && prevChar !== "\\") {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = "";
        }
      }

      if (!inQuotes) {
        if (char === "(") {
          depth++;
        } else if (char === ")") {
          depth--;
        } else if (char === "," && depth === 0) {
          args.push(current.trim());
          current = "";
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return args;
  }
}
