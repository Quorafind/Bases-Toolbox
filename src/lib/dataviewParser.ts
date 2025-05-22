import * as yaml from "js-yaml";

/**
 * Parse a Dataview TABLE query and convert it to Bases YAML
 */
export function parseDataviewTable(
  dataviewQuery: string,
  placeFiltersInView: boolean = true
): string {
  try {
    // Extract the main parts of the dataview query
    const tableMatch = dataviewQuery.match(
      /TABLE\s+(.+?)(?:\s+FROM|\s+SORT|\s+WHERE|\s+LIMIT|\s+GROUP BY|\s*$)/i
    );
    const fromMatch = dataviewQuery.match(
      /FROM\s+(.+?)(?:\s+SORT|\s+WHERE|\s+LIMIT|\s+GROUP BY|\s*$)/i
    );
    const whereMatch = dataviewQuery.match(
      /WHERE\s+(.+?)(?:\s+SORT|\s+LIMIT|\s+GROUP BY|\s*$)/i
    );
    const sortMatch = dataviewQuery.match(
      /SORT\s+(.+?)(?:\s+WHERE|\s+LIMIT|\s+GROUP BY|\s*$)/i
    );
    const limitMatch = dataviewQuery.match(/LIMIT\s+(\d+)/i);
    const groupByMatch = dataviewQuery.match(
      /GROUP BY\s+(.+?)(?:\s+SORT|\s+WHERE|\s+LIMIT|\s*$)/i
    );

    // Initialize the base structure
    const baseFile: any = {
      views: [
        {
          type: "table",
          name: "Default view",
        },
      ],
    };

    // Add display fields from TABLE clause
    if (tableMatch && tableMatch[1]) {
      const fields = parseDataviewFields(tableMatch[1]);
      baseFile.display = {};
      const columnOrder: string[] = [];
      const formulas: Record<string, string> = {};

      fields.forEach((field, index) => {
        let fieldName: string;
        let displayName: string;
        let formulaKeyForYaml: string | null = null; // Key for the 'formulas' object
        let rawFormulaExpression: string | null = null; // Expression before parsing

        const trimmedField = field.trim();

        // Attempt to match: (expression) as Alias
        // Regex captures: 1: expression, 2: optional quote, 3: alias
        const formulaWithAliasMatch = trimmedField.match(
          /^\(\s*(.+?)\s*\)\s+[Aa][Ss]\s+(['"]?)(.+?)\2\s*$/
        );
        if (formulaWithAliasMatch) {
          rawFormulaExpression = formulaWithAliasMatch[1].trim();
          const alias = formulaWithAliasMatch[3].trim(); // Original alias for display name

          displayName = alias;
          // Use the alias, lowercased, as the key for the formulas object
          // And as part of the fieldName for display/order
          formulaKeyForYaml = alias.toLowerCase();
          fieldName = `formula.${formulaKeyForYaml}`;
        } else {
          // Attempt to match: (expression) - formula without alias
          const formulaOnlyMatch = trimmedField.match(/^\(\s*(.+?)\s*\)\s*$/);
          if (formulaOnlyMatch) {
            rawFormulaExpression = formulaOnlyMatch[1].trim();
            formulaKeyForYaml = `formula_${index}`; // Generic key
            displayName = `Formula ${index + 1}`; // Generic display name
            fieldName = `formula.${formulaKeyForYaml}`;
          } else {
            // Not a formula, attempt to match: FieldName as Alias
            // Regex captures: 1: field name part, 2: optional quote, 3: alias
            const fieldWithAliasMatch = trimmedField.match(
              /(.+?)\s+[Aa][Ss]\s+(['"]?)(.+?)\2\s*$/
            );
            if (fieldWithAliasMatch) {
              const fieldNamePart = fieldWithAliasMatch[1].trim();
              const alias = fieldWithAliasMatch[3].trim();
              fieldName = mapDataviewPropertyToBaseProperty(fieldNamePart);
              displayName = alias;
            } else {
              // Simple field, no formula, no alias
              fieldName = mapDataviewPropertyToBaseProperty(trimmedField);
              displayName = getDisplayNameForProperty(fieldName);
            }
          }
        }

        baseFile.display[fieldName] = displayName;
        columnOrder.push(fieldName);

        if (rawFormulaExpression !== null && formulaKeyForYaml !== null) {
          formulas[formulaKeyForYaml] =
            parseDataviewFormula(rawFormulaExpression);
        }
      });

      // Set the order property to reflect column order in the TABLE clause
      baseFile.views[0].order = columnOrder;

      // Add formulas to the base definition if any exist
      if (Object.keys(formulas).length > 0) {
        baseFile.formulas = formulas;
      }
    }

    // Add FROM clause to filters
    let filters = null;
    if (fromMatch && fromMatch[1]) {
      const fromValue = fromMatch[1].trim();

      if (fromValue.startsWith('"') && fromValue.endsWith('"')) {
        // Handle folder path
        const folderPath = fromValue.slice(1, -1);
        filters = 'in_folder(file.file, "' + folderPath + '")';
      } else if (fromValue.startsWith("#")) {
        // Handle tag
        const tag = fromValue.substring(1);
        filters = 'tagged_with(file.file, "' + tag + '")';
      }
    }

    // Add filters from WHERE clause
    if (whereMatch && whereMatch[1]) {
      const parsedFilters = parseDataviewFilters(whereMatch[1]);
      if (!filters) {
        filters = parsedFilters;
      } else {
        // Combine FROM and WHERE filters with AND
        filters = {
          and: [filters, parsedFilters],
        };
      }
    }

    // Set the filters based on user preference
    if (filters) {
      if (placeFiltersInView) {
        // Place filters in the first view
        baseFile.views[0].filters = filters;
      } else {
        // Place filters globally
        baseFile.filters = filters;
      }
    }

    // Add sorting from SORT clause to the first view
    if (sortMatch && sortMatch[1]) {
      const sortFields = parseSortFields(sortMatch[1]);

      // Add sort array for sorting data
      if (sortFields.length > 0) {
        baseFile.views[0].sort = sortFields;
      }
    }

    // Add limit from LIMIT clause to the first view
    if (limitMatch && limitMatch[1]) {
      baseFile.views[0].limit = parseInt(limitMatch[1], 10);
    }

    // Add group by from GROUP BY clause to the first view
    if (groupByMatch && groupByMatch[1]) {
      baseFile.views[0].group_by = mapDataviewPropertyToBaseProperty(
        groupByMatch[1].trim()
      );
    }

    // Convert to YAML
    return yaml.dump(baseFile);
  } catch (error) {
    console.error("Error parsing Dataview query:", error);
    return "# Error parsing Dataview query";
  }
}

/**
 * Map Dataview property names to Bases property names
 */
function mapDataviewPropertyToBaseProperty(prop: string): string {
  prop = prop.trim();

  // Handle common Dataview file property mappings
  const propertyMap: Record<string, string> = {
    "file.path": "file.path",
    "file.name": "file.name",
    "file.folder": "file.folder",
    "file.ext": "file.extension",
    "file.size": "file.size",
    "file.ctime": "file.ctime",
    "file.mtime": "file.mtime",
    "file.cday": "file.ctime",
    "file.mday": "file.mtime",
  };

  if (propertyMap[prop]) {
    return propertyMap[prop];
  }

  // Handle properties with hyphens by converting to underscores
  if (prop.includes("-")) {
    return prop.replace(/-/g, "_");
  }

  // If not in the map, return as is
  return prop;
}

/**
 * Get a human-readable display name for a property
 */
function getDisplayNameForProperty(prop: string): string {
  // Handle file properties
  if (prop.startsWith("file.")) {
    const displayMap: Record<string, string> = {
      "file.path": "File Path",
      "file.name": "File Name",
      "file.folder": "Folder",
      "file.extension": "Extension",
      "file.size": "File Size",
      "file.ctime": "Created Time",
      "file.mtime": "Modified Time",
    };

    return displayMap[prop] || prop.split(".").pop() || prop;
  }

  // For other properties, return the property name with first letter capitalized
  return prop.charAt(0).toUpperCase() + prop.slice(1);
}

/**
 * Parse a Dataview formula expression into a Bases formula expression
 */
function parseDataviewFormula(formula: string): string {
  // For now, this does a straightforward conversion of property names
  // and preserves the formula structure

  // Replace property names with underscores instead of hyphens
  let processedFormula = formula.replace(
    /([a-zA-Z0-9_-]+)-([a-zA-Z0-9_-]+)/g,
    (match, p1, p2) => {
      return `${p1}_${p2}`;
    }
  );

  // Handle any Dataview formula functions
  const functionMap: Record<string, string> = {
    round: "round",
    floor: "floor",
    ceil: "ceil",
    min: "min",
    max: "max",
    sum: "sum",
    avg: "average",
    length: "length",
    contains: "contains",
    dateformat: "date_format",
  };

  for (const [dvFunc, basesFunc] of Object.entries(functionMap)) {
    const regex = new RegExp(`\\b${dvFunc}\\(`, "g");
    processedFormula = processedFormula.replace(regex, `${basesFunc}(`);
  }

  return processedFormula;
}

/**
 * Parse the fields from the TABLE clause
 */
function parseDataviewFields(fieldsStr: string): string[] {
  // Split by commas, but respect function calls with commas and parenthesized expressions
  let fields = [];
  let currentField = "";
  let parenDepth = 0;
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < fieldsStr.length; i++) {
    const char = fieldsStr[i];

    // Handle quoted strings
    if (
      (char === '"' || char === "'") &&
      (i === 0 || fieldsStr[i - 1] !== "\\")
    ) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
      currentField += char;
      continue;
    }

    if (char === "(" && !inQuotes) {
      parenDepth++;
      currentField += char;
    } else if (char === ")" && !inQuotes) {
      parenDepth--;
      currentField += char;
    } else if (char === "," && parenDepth === 0 && !inQuotes) {
      fields.push(currentField.trim());
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField.trim()) {
    fields.push(currentField.trim());
  }

  return fields;
}

/**
 * Parse the WHERE clause into a filters object
 */
function parseDataviewFilters(whereStr: string): any {
  // Check for parentheses which might indicate nested conditions
  if (whereStr.includes("(") && !whereStr.match(/^[a-zA-Z0-9_.]+\(/)) {
    return parseNestedConditions(whereStr);
  }

  // Basic parsing for simple conditions
  if (whereStr.toLowerCase().includes(" and ")) {
    return {
      and: whereStr
        .split(/ and /i)
        .map((cond) => cond.trim())
        .map(parseCondition),
    };
  } else if (whereStr.toLowerCase().includes(" or ")) {
    return {
      or: whereStr
        .split(/ or /i)
        .map((cond) => cond.trim())
        .map(parseCondition),
    };
  } else {
    return parseCondition(whereStr);
  }
}

/**
 * Parse potentially nested conditions with parentheses
 */
function parseNestedConditions(condition: string): any {
  // This is a simplified approach - a full parser would be more complex

  // First, handle simple cases where there's just one level of nesting
  if (condition.startsWith("(") && condition.endsWith(")")) {
    // Remove outer parentheses and parse the inner content
    return parseDataviewFilters(condition.substring(1, condition.length - 1));
  }

  // For more complex nested expressions
  if (/ and /i.test(condition)) {
    // Split by AND at the top level (respecting parentheses)
    const parts = splitRespectingParentheses(condition, / and /i);
    return {
      and: parts.map((part) => parseDataviewFilters(part.trim())),
    };
  } else if (/ or /i.test(condition)) {
    // Split by OR at the top level (respecting parentheses)
    const parts = splitRespectingParentheses(condition, / or /i);
    return {
      or: parts.map((part) => parseDataviewFilters(part.trim())),
    };
  }

  // If no logical operators at the top level, then it's a simple condition
  return parseCondition(condition);
}

/**
 * Split a string by a pattern, respecting parentheses nesting
 */
function splitRespectingParentheses(str: string, pattern: RegExp): string[] {
  const result: string[] = [];
  let currentPart = "";
  let parenDepth = 0;
  let i = 0;

  while (i < str.length) {
    // Check if we have a potential operator match at current position
    const restOfString = str.substring(i);
    const match = restOfString.match(pattern);

    if (match && match.index === 0 && parenDepth === 0) {
      // We found an operator at the top level
      if (currentPart.trim()) {
        result.push(currentPart.trim());
      }
      currentPart = "";
      i += match[0].length;
    } else {
      // Normal character or nested
      const char = str[i];
      if (char === "(") parenDepth++;
      else if (char === ")") parenDepth--;

      currentPart += char;
      i++;
    }
  }

  if (currentPart.trim()) {
    result.push(currentPart.trim());
  }

  return result;
}

/**
 * Parse an individual condition
 */
function parseCondition(condition: string): any {
  // Handle common comparison operators
  const operators = [
    "!=",
    ">=",
    "<=",
    "=",
    ">",
    "<",
    "contains",
    "not_contains",
    "contains_any",
    "contains_all",
    "startswith",
    "endswith",
    "empty",
    "not_empty",
    "date_equals",
    "date_not_equals",
    "date_before",
    "date_after",
    "date_on_or_before",
    "date_on_or_after",
  ];

  for (const op of operators) {
    if (condition.includes(op)) {
      // Split only on the first occurrence
      const parts = condition.split(new RegExp(`\\s*${op}\\s*`, "i"), 2);
      if (parts.length === 2) {
        let [left, right] = parts;

        // Map property names to Bases format
        left = mapDataviewPropertyToBaseProperty(left);

        // Convert Dataview operators to Bases format
        if (op === "=") return `${left.trim()} == ${right.trim()}`;
        if (op === "contains")
          return `contains(${left.trim()}, ${right.trim()})`;
        if (op === "not_contains")
          return `not_contains(${left.trim()}, ${right.trim()})`;
        if (op === "contains_any")
          return `contains_any(${left.trim()}, ${right.trim()})`;
        if (op === "contains_all")
          return `contains_all(${left.trim()}, ${right.trim()})`;
        if (op === "startswith")
          return `startswith(${left.trim()}, ${right.trim()})`;
        if (op === "endswith")
          return `endswith(${left.trim()}, ${right.trim()})`;
        if (op === "empty") return `empty(${left.trim()})`;
        if (op === "not_empty") return `not_empty(${left.trim()})`;
        if (op === "date_equals")
          return `date_equals(${left.trim()}, ${right.trim()})`;
        if (op === "date_not_equals")
          return `date_not_equals(${left.trim()}, ${right.trim()})`;
        if (op === "date_before")
          return `date_before(${left.trim()}, ${right.trim()})`;
        if (op === "date_after")
          return `date_after(${left.trim()}, ${right.trim()})`;
        if (op === "date_on_or_before")
          return `date_on_or_before(${left.trim()}, ${right.trim()})`;
        if (op === "date_on_or_after")
          return `date_on_or_after(${left.trim()}, ${right.trim()})`;

        return `${left.trim()} ${op} ${right.trim()}`;
      }
    }
  }

  // Handle other common Dataview filters
  if (condition.includes("file.tags")) {
    const tagMatch = condition.match(/file\.tags\.includes\("([^"]+)"\)/);
    if (tagMatch) {
      return `tagged_with(file.file, "${tagMatch[1]}")`;
    }
  }

  // Handle links_to function
  if (condition.includes("links")) {
    const linksMatch = condition.match(/links\s*\(\s*"([^"]+)"\s*\)/i);
    if (linksMatch) {
      return `links_to(file.file, "${linksMatch[1]}")`;
    }
  }

  // Handle not function
  if (condition.startsWith("not ")) {
    const innerCondition = condition.substring(4).trim();
    const parsedInner = parseCondition(innerCondition);
    return `not(${parsedInner})`;
  }

  // Handle if function
  if (condition.startsWith("if(") && condition.endsWith(")")) {
    // Keep the if function as is, just map any property names inside
    const ifContent = condition.substring(3, condition.length - 1);
    // This is a simplistic approach - for a full implementation, you'd need
    // to parse the if conditions and arguments properly
    return `if(${ifContent})`;
  }

  // Handle tag function
  if (condition.startsWith("#")) {
    const tag = condition.substring(1);
    return `tag(file.file, "${tag}")`;
  }

  // Map any property name in the condition
  return mapDataviewPropertyToBaseProperty(condition);
}

/**
 * Parse sort fields including direction
 */
function parseSortFields(
  sortStr: string
): { column: string; direction: string }[] {
  const fields = sortStr.split(",").map((field) => field.trim());

  return fields.map((field) => {
    let direction = "ASC";
    let fieldName = field;

    if (field.toLowerCase().endsWith(" desc")) {
      direction = "DESC";
      fieldName = field.slice(0, -5).trim();
    } else if (field.toLowerCase().endsWith(" asc")) {
      fieldName = field.slice(0, -4).trim();
    }

    // Map property name to Bases format
    fieldName = mapDataviewPropertyToBaseProperty(fieldName);

    // Return as object format
    return {
      column: fieldName,
      direction: direction,
    };
  });
}
/**
 * Example conversion from Dataview to Bases
 */
export function getExampleDataviewConversion(): {
  dataview: string;
  bases: string;
  basesWithGlobalFilters: string;
} {
  const dataviewExample = `TABLE file.name, file.ctime as "Created", file.mtime as "Modified", rating, category
FROM "projects"
WHERE rating >= 4 AND category = "active"
SORT rating DESC
LIMIT 20`;

  return {
    dataview: dataviewExample,
    bases: parseDataviewTable(dataviewExample, true), // Filters in view
    basesWithGlobalFilters: parseDataviewTable(dataviewExample, false), // Global filters
  };
}

/**
 * Generate an example with complex filters in views
 */
export function getComplexFilterExample(): string {
  const complexExample = {
    display: {
      "file.mtime": "Time",
      "file.name": "Name",
      priority: "Priority",
      status: "Status",
    },
    views: [
      {
        type: "table",
        name: "Default view",
        filters: {
          and: [
            'contains(file.path, "_Work")',
            'date_before(file.ctime, "2025-05-22T09:24:00")',
          ],
        },
        // Order determines the column display order in the table
        order: ["priority", "status", "file.name", "file.mtime"],
        // Sort determines how data is sorted
        sort: [
          {
            column: "priority",
            direction: "DESC",
          },
          {
            column: "file.mtime",
            direction: "DESC",
          },
        ],
      },
    ],
  };

  return yaml.dump(complexExample);
}

/**
 * Generate an example with complex global filters
 */
export function getComplexGlobalFilterExample(): string {
  const complexExample = {
    display: {
      "file.mtime": "Time",
      "file.name": "Name",
      category: "Category",
    },
    filters: {
      and: [
        'contains(file.path, "_Work")',
        'date_before(file.ctime, "2025-05-22T09:24:00")',
      ],
    },
    views: [
      {
        type: "table",
        name: "Default view",
        // Order of columns in the table
        order: ["category", "file.name", "file.mtime"],
        // How data is sorted
        sort: [
          {
            column: "category",
            direction: "ASC",
          },
          {
            column: "file.name",
            direction: "ASC",
          },
        ],
      },
    ],
  };

  return yaml.dump(complexExample);
}

/**
 * Generate an example with nested filter groups
 */
export function getNestedFilterExample(): string {
  const nestedExample = {
    display: {
      "file.mtime": "Time",
      "file.name": "Name",
      status: "Status",
      priority: "Priority",
    },
    views: [
      {
        type: "table",
        name: "Complex Filters",
        filters: {
          and: [
            'contains(file.path, "_Work")',
            'date_before(file.ctime, "2025-05-22T09:24:00")',
            {
              and: ["file.size > 2000", "not_empty(status)"],
            },
            {
              or: [
                "priority > 3",
                {
                  and: [
                    'status == "in-progress"',
                    'tagged_with(file.file, "urgent")',
                  ],
                },
              ],
            },
          ],
        },
        // Order defines column arrangement in the table
        order: ["status", "priority", "file.name", "file.mtime"],
        // Sort defines how the data is sorted
        sort: [
          {
            column: "priority",
            direction: "DESC",
          },
          {
            column: "file.name",
            direction: "ASC",
          },
        ],
      },
      {
        type: "table",
        name: "Alternative View",
        filters: {
          or: [
            'contains(file.name, "report")',
            {
              and: [
                'date_after(file.mtime, "2023-01-01")',
                'links_to(file.file, "projects/index.md")',
              ],
            },
          ],
        },
        // Different column order for this view
        order: ["file.name", "file.mtime", "status", "priority"],
        sort: [
          {
            column: "file.mtime",
            direction: "DESC",
          },
        ],
      },
    ],
  };

  return yaml.dump(nestedExample);
}

/**
 * Generate an example with formula fields
 */
export function getFormulaExample(): {
  dataview: string;
  bases: string;
} {
  const dataviewExample = `TABLE
	pages-read AS "Pages Read",
	total-pages AS "Total Pages",
	file.mtime AS "Last Accessed",
	(round((pages-read/total-pages)*100) + "%") AS Progress
FROM #queue
SORT file.mtime DESC`;

  return {
    dataview: dataviewExample,
    bases: parseDataviewTable(dataviewExample, true),
  };
}

/**
 * Generate an example matching the expected format with formulas in a separate section
 */
export function getExpectedFormulaExample(): string {
  const exampleYaml = {
    filters: {
      or: [
        'tagged_with(file.file, "tag")',
        {
          and: [
            'tagged_with(file.file, "book")',
            'links_to(file.file, "Textbook")',
          ],
        },
        {
          not: [
            'tagged_with(file.file, "book")',
            'in_folder(file.file, "Required Reading")',
          ],
        },
      ],
    },
    formulas: {
      formatted_price: 'concat(price, " dollars")',
      ppu: "price / age",
    },
    display: {
      status: "Status",
      "formula.formatted_price": "Price",
      "file.ext": "Extension",
    },
    views: [
      {
        type: "table",
        name: "My table",
        limit: 10,
        filters: {
          and: [
            'status != "done"',
            {
              or: ["formula.ppu > 5", "price > 2.1"],
            },
          ],
        },
        group_by: "status",
        agg: "sum(price)",
        order: [
          "file.name",
          "file.ext",
          "property.age",
          "formula.ppu",
          "formula.formatted_price",
        ],
      },
      {
        type: "map",
        name: "Example map",
        filters: "has_coords == true",
        lat: "lat",
        long: "long",
        title: "file.name",
      },
    ],
  };

  return yaml.dump(exampleYaml);
}
