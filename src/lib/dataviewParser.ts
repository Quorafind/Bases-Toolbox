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
      /TABLE\s+([\s\S]+?)(?:\s+FROM|\s+SORT|\s+WHERE|\s+LIMIT|\s+GROUP BY|\s*$)/i
    );
    const fromMatch = dataviewQuery.match(
      /FROM\s+([\s\S]+?)(?:\s+SORT|\s+WHERE|\s+LIMIT|\s+GROUP BY|\s*$)/i
    );
    const whereMatch = dataviewQuery.match(
      /WHERE\s+([\s\S]+?)(?:\s+SORT|\s+LIMIT|\s+GROUP BY|\s*$)/i
    );
    const sortMatch = dataviewQuery.match(
      /SORT\s+([\s\S]+?)(?:\s+WHERE|\s+LIMIT|\s+GROUP BY|\s*$)/i
    );
    const limitMatch = dataviewQuery.match(/LIMIT\s+(\d+)/i);
    const groupByMatch = dataviewQuery.match(
      /GROUP BY\s+([\s\S]+?)(?:\s+SORT|\s+WHERE|\s+LIMIT|\s*$)/i
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
      if (!tableMatch[0].toLowerCase().includes('without id')) {
        columnOrder.push("file.name");
      }
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
        if (!folderPath) {
          filters = null;
        } else {
          filters = 'inFolder(file.file, "' + folderPath + '")';
        }
      } else if (fromValue.startsWith("#")) {
        // Handle tag
        const tag = fromValue.substring(1);
        filters = 'taggedWith(file.file, "' + tag + '")';
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

  // Handle date property accessors like due.month, due.year, etc.
  const dateAccessorMatch = prop.match(
    /^(.+)\.(year|month|day|hour|minute|second)$/i
  );
  if (dateAccessorMatch) {
    const [, propertyName, accessor] = dateAccessorMatch;
    // Recursively map the property name in case it needs further transformation
    const mappedPropertyName = mapDataviewPropertyToBaseProperty(propertyName);
    return `${accessor.toLowerCase()}(${mappedPropertyName})`;
  }

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
  // Handle date functions like month(due), year(due)
  const dateFunctionMatch = prop.match(
    /^(year|month|day|hour|minute|second)\((.+)\)$/i
  );
  if (dateFunctionMatch) {
    const [, func, property] = dateFunctionMatch;
    const funcName = func.charAt(0).toUpperCase() + func.slice(1).toLowerCase();
    const propName = getDisplayNameForProperty(property);
    return `${funcName} of ${propName}`;
  }

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
  // 1. Replace property names with hyphens to use underscores.
  // e.g., "pages-read" becomes "pages_read"
  let processedFormula = formula.replace(
    /([a-zA-Z0-9_]+)-([a-zA-Z0-9_]+)/g,
    (match, p1, p2) => {
      return `${p1}_${p2}`;
    }
  );

  // Handle date property accessors like now().year, due.month before processing date functions
  // This needs to be done before processDataviewDateFunctions to avoid conflicts
  processedFormula = processedFormula.replace(
    /(\w+(?:\(\s*[^)]*\s*\))?|\w+(?:\.\w+)*)\.(year|month|day|hour|minute|second)\b/gi,
    (match, expr, accessor) => {
      // Recursively process the expression part in case it needs mapping
      const mappedExpr = mapDataviewPropertyToBaseProperty(expr);
      return `${accessor.toLowerCase()}(${mappedExpr})`;
    }
  );

  // Process date functions before other operations
  processedFormula = processDataviewDateFunctions(processedFormula);

  // 2. Handle Dataview string concatenation: expression + "string_literal" or expression + 'string_literal'
  //    This is converted to Bases `join("", expression, "string_literal_content")`.
  //    Regex matches: (expression_part) + ("literal_part" or 'literal_part') at the end of the string.
  //    Group 1: expression_part
  //    Group 2: quote type (' or ")
  //    Group 3: literal_part (content of the string, without the quotes)
  const concatenationMatch = processedFormula.match(
    /^(.*)\s*\+\s*(["'])(.*?)\2\s*$/
  );

  if (concatenationMatch) {
    const expressionPart = concatenationMatch[1].trim();
    const stringLiteralContent = concatenationMatch[3];

    // Recursively process the expression part first
    const processedExpressionPart = parseDataviewFormula(expressionPart);

    // Construct the join function call, ensuring the string literal is properly quoted.
    processedFormula = `join("", ${processedExpressionPart}, "${stringLiteralContent.replace(
      /"/g,
      '\\\\"'
    )}")`;
  } else {
    // 3. If no top-level string concatenation of the specific form `expr + "literal"`,
    //    then proceed to map Dataview functions to Bases functions.
    const functionMap: Record<string, string> = {
      round: "round",
      floor: "floor",
      ceil: "ceil",
      min: "min",
      max: "max",
      sum: "sum", // Assuming Dataview 'sum' maps to Bases 'sum'
      avg: "average", // Dataview 'avg' to Bases 'average'
      length: "len", // Dataview 'length' to Bases 'len'
      contains: "contains", // Dataview 'contains' maps to Bases 'contains'
      dateformat: "dateFormat", // Dataview 'dateformat' to Bases 'dateFormat'

      // Date functions from function.md
      now: "now",
      dateModify: "dateModify",
      date_diff: "dateDiff",
      dateEquals: "dateEquals",
      dateNotEquals: "dateNotEquals",
      dateBefore: "dateBefore",
      dateAfter: "dateAfter",
      dateOnOrBefore: "dateOnOrBefore",
      dateOnOrAfter: "dateOnOrAfter",
      year: "year",
      month: "month",
      day: "day",
      hour: "hour",
      minute: "minute",
      second: "second",
      // Other functions from function.md could be added here if needed.
    };

    for (const [dvFunc, basesFunc] of Object.entries(functionMap)) {
      // Match the function name as a whole word, followed by an optional space and an opening parenthesis.
      // Case-insensitive match for the Dataview function name ('i' flag).
      // Global match ('g' flag) to replace all occurrences.
      const regex = new RegExp(`\\b${dvFunc}\\s*\\(`, "gi");
      processedFormula = processedFormula.replace(regex, `${basesFunc}(`);
    }
  }

  // Ensure operators +, *, / are surrounded by single spaces.
  // Step 1: Remove existing spaces around operators +, *, / and collapse them with the operator.
  processedFormula = processedFormula.replace(/\s*([+*/-])\s*/g, "$1");
  // Step 2: Add a single space before and after each operator +, *, /.
  processedFormula = processedFormula.replace(/([+*/-])/g, " $1 ");
  // Step 3: Normalize multiple consecutive spaces into a single space.
  processedFormula = processedFormula.replace(/\s\s+/g, " ");

  return processedFormula;
}

/**
 * Process Dataview date functions and convert them to Bases date functions
 */
function processDataviewDateFunctions(formula: string): string {
  // Process date(today) pattern to now()
  formula = formula.replace(/date\s*\(\s*today\s*\)/gi, "now()");

  // Process date(tomorrow) pattern to dateModify(now(), "1 day")
  formula = formula.replace(
    /date\s*\(\s*tomorrow\s*\)/gi,
    'dateModify(now(), "1 day")'
  );

  // Process date(yesterday) pattern to dateModify(now(), "-1 day")
  formula = formula.replace(
    /date\s*\(\s*yesterday\s*\)/gi,
    'dateModify(now(), "-1 day")'
  );

  // Process date() function calls with other arguments
  formula = formula.replace(/date\s*\(\s*([^)]+)\s*\)/gi, (match, arg) => {
    // If the argument is a string or variable, just return it as is
    if (
      arg.trim().startsWith('"') ||
      arg.trim().startsWith("'") ||
      /^[a-zA-Z0-9_.]+$/.test(arg.trim())
    ) {
      return arg.trim();
    }
    // Otherwise, keep the original format for now
    return match;
  });

  // Process dur() function calls and convert to Bases duration format
  // e.g., dur(7 days) becomes "7 days"
  // Convert weeks to days (2 weeks = 14 days)
  formula = formula.replace(
    /dur\s*\(\s*(\d+)\s*([a-zA-Z]+)\s*\)/gi,
    (match, number, unit) => {
      // Convert weeks to days
      if (unit.toLowerCase().startsWith("week")) {
        const days = parseInt(number) * 7;
        return `"${days} days"`;
      }

      // Make sure the unit is properly formatted (singular for 1, plural for others)
      const unitStr =
        number === "1" ? unit.replace(/s$/, "") : unit.replace(/s$/, "") + "s";
      return `"${number} ${unitStr}"`;
    }
  );

  // Process expressions like now() + "7 days" or now() + "7 days"
  // This regex matches patterns like variable/function + duration or variable/function - duration
  formula = formula.replace(
    /(now\(\)|\w+(?:\.\w+)*)\s*([+-])\s*"(\d+\s+[a-zA-Z]+)"/gi,
    (match, expr, operator, duration) => {
      // Convert weeks to days in duration string
      if (duration.toLowerCase().includes("week")) {
        const parts = duration.match(/(\d+)\s+([a-zA-Z]+)/i);
        if (parts) {
          const num = parseInt(parts[1]);
          const days = num * 7;
          duration = `${days} days`;
        }
      }

      // For subtraction, make the duration negative
      const sign = operator === "-" ? "-" : "";
      return `dateModify(${expr}, "${sign}${duration}")`;
    }
  );

  // Process date math expressions: something + dur(...) or something - dur(...)
  // This regex looks for a pattern like: expression + dur(...) or expression - dur(...)
  formula = formula.replace(
    /(\w+(?:\(\s*[^)]*\s*\))?|\w+(?:\.\w+)*)\s*([+-])\s*dur\s*\(\s*(\d+)\s*([a-zA-Z]+)\s*\)/gi,
    (match, expr, operator, number, unit) => {
      // Convert weeks to days
      if (unit.toLowerCase().startsWith("week")) {
        const days = parseInt(number) * 7;
        unit = "day";
        number = days.toString();
      }

      // Make sure the unit is properly formatted
      const unitStr =
        number === "1" ? unit.replace(/s$/, "") : unit.replace(/s$/, "") + "s";
      // If subtraction, make the number negative
      const sign = operator === "-" ? "-" : "";
      return `dateModify(${expr}, "${sign}${number} ${unitStr}")`;
    }
  );

  return formula;
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
function parseDataviewFilters(whereStr: string, depth: number = 0): any {
  // Prevent infinite recursion by limiting depth
  if (depth > 10) {
    console.warn("Maximum recursion depth reached in parseDataviewFilters");
    return parseCondition(whereStr);
  }

  // Normalize whitespace and remove line breaks to handle multi-line conditions
  whereStr = whereStr.replace(/\s+/g, " ").trim();

  // Check for parentheses which might indicate nested conditions
  if (whereStr.includes("(") && !whereStr.match(/^[a-zA-Z0-9_.]+\(/)) {
    return parseNestedConditions(whereStr, depth + 1);
  }

  // Use the more robust splitting function for AND/OR operations
  if (/ and /i.test(whereStr)) {
    const parts = splitRespectingParentheses(whereStr, / and /i);
    if (parts.length > 1) {
      return {
        and: parts.map((part) => parseDataviewFilters(part.trim(), depth + 1)),
      };
    }
  }

  if (/ or /i.test(whereStr)) {
    const parts = splitRespectingParentheses(whereStr, / or /i);
    if (parts.length > 1) {
      return {
        or: parts.map((part) => parseDataviewFilters(part.trim(), depth + 1)),
      };
    }
  }

  // If no logical operators found, it's a simple condition
  return parseCondition(whereStr);
}

/**
 * Parse potentially nested conditions with parentheses
 */
function parseNestedConditions(condition: string, depth: number = 0): any {
  // Prevent infinite recursion by limiting depth
  if (depth > 10) {
    console.warn("Maximum recursion depth reached in parseNestedConditions");
    return parseCondition(condition);
  }

  // Normalize whitespace
  condition = condition.replace(/\s+/g, " ").trim();

  // First, handle simple cases where there's just one level of nesting
  if (condition.startsWith("(") && condition.endsWith(")")) {
    // Check if the entire condition is wrapped in parentheses
    let parenCount = 0;
    let isFullyWrapped = true;

    for (let i = 0; i < condition.length; i++) {
      if (condition[i] === "(") parenCount++;
      else if (condition[i] === ")") parenCount--;

      // If parentheses close before the end, it's not fully wrapped
      if (parenCount === 0 && i < condition.length - 1) {
        isFullyWrapped = false;
        break;
      }
    }

    if (isFullyWrapped) {
      // Remove outer parentheses and parse the inner content
      return parseDataviewFilters(
        condition.substring(1, condition.length - 1),
        depth + 1
      );
    }
  }

  // For more complex nested expressions, use the robust splitting function
  if (/ and /i.test(condition)) {
    const parts = splitRespectingParentheses(condition, / and /i);
    if (parts.length > 1) {
      return {
        and: parts.map((part) => parseDataviewFilters(part.trim(), depth + 1)),
      };
    }
  }

  if (/ or /i.test(condition)) {
    const parts = splitRespectingParentheses(condition, / or /i);
    if (parts.length > 1) {
      return {
        or: parts.map((part) => parseDataviewFilters(part.trim(), depth + 1)),
      };
    }
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
  let inQuotes = false;
  let quoteChar = "";
  let i = 0;

  while (i < str.length) {
    const char = str[i];

    // Handle quoted strings
    if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== "\\")) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
      currentPart += char;
      i++;
      continue;
    }

    // Track parentheses depth only when not in quotes
    if (!inQuotes) {
      if (char === "(") {
        parenDepth++;
      } else if (char === ")") {
        parenDepth--;
      }
    }

    // Check if we have a potential operator match at current position
    if (!inQuotes && parenDepth === 0) {
      const restOfString = str.substring(i);
      const match = restOfString.match(pattern);

      if (match && match.index === 0) {
        // We found an operator at the top level
        if (currentPart.trim()) {
          result.push(currentPart.trim());
        }
        currentPart = "";
        i += match[0].length;
        continue;
      }
    }

    // Normal character
    currentPart += char;
    i++;
  }

  if (currentPart.trim()) {
    result.push(currentPart.trim());
  }

  return result.length > 1 ? result : [str];
}

/**
 * Parse an individual condition
 */
function parseCondition(condition: string): any {
  // Process date functions in the condition before handling operators
  condition = processDataviewDateFunctions(condition);

  console.log("condition", condition);

  // Handle function calls first (like contains, startswith, etc.) before handling operators
  // This prevents misinterpreting function arguments as separate conditions
  const functionPattern =
    /^(contains|not_contains|containsAny|containsAll|startswith|endswith|empty|notEmpty|dateEquals|dateNotEquals|dateBefore|dateAfter|dateOnOrBefore|dateOnOrAfter)\s*\(/i;
  const functionMatch = condition.match(functionPattern);

  if (functionMatch) {
    const funcName = functionMatch[1].toLowerCase();

    // Extract the function arguments
    const argsStart = condition.indexOf("(") + 1;
    const argsEnd = condition.lastIndexOf(")");

    if (argsEnd > argsStart) {
      const argsStr = condition.substring(argsStart, argsEnd);
      const args = parseDataviewFields(argsStr); // Reuse the field parsing logic to handle commas properly

      if (args.length >= 1) {
        const mappedArgs = args.map((arg) => {
          // Map property names to Bases format
          const trimmedArg = arg.trim();
          if (
            !trimmedArg.startsWith('"') &&
            !trimmedArg.startsWith("'") &&
            !trimmedArg.match(/^\d/)
          ) {
            if (trimmedArg.startsWith('link(')) {
              // pull out string within quotation marks
              const startIndexModified = trimmedArg.indexOf('"') + 1;
              const endIndexModified = trimmedArg.lastIndexOf('"');
              const extractedTextModified = `"[[` + trimmedArg.substring(startIndexModified, endIndexModified) + `]]"`;
              return mapDataviewPropertyToBaseProperty(extractedTextModified);
            } else {
              return mapDataviewPropertyToBaseProperty(trimmedArg);
            }
          }
          return trimmedArg;
        });

        // Special handling for contains with tags
        if (funcName === "contains" && mappedArgs.length === 2) {
          const [left, right] = mappedArgs;
          if (left.trim().toLowerCase() === "tags") {
            // Extract the tag value from the right side
            const tagMatch = right.trim().match(/^["'](.+)["']$/);
            if (tagMatch) {
              return `taggedWith(file.file, "${tagMatch[1]}")`;
            }
          }
        }

        return `${funcName}(${mappedArgs.join(", ")})`;
      }
    }

    // If we couldn't parse the function properly, fall back to the original
    return condition;
  }

  // Handle common comparison operators
  const operators = ["!=", ">=", "<=", "=", ">", "<"];

  for (const op of operators) {
    if (condition.includes(op)) {
      // Split only on the first occurrence
      const parts = condition.split(new RegExp(`\\s*${op}\\s*`, "i"), 2);
      if (parts.length === 2) {
        let [left, right] = parts;

        console.log("left", left);
        console.log("right", right);

        // Map property names to Bases format
        left = mapDataviewPropertyToBaseProperty(left);

        // Also map the right side if it's not a literal value
        const rightTrimmed = right.trim();
        if (
          !rightTrimmed.startsWith('"') &&
          !rightTrimmed.startsWith("'") &&
          !rightTrimmed.match(/^\d+$/) &&
          !rightTrimmed.match(/^true$|^false$/i)
        ) {
          right = mapDataviewPropertyToBaseProperty(right);
        }

        // Convert Dataview operators to Bases format
        if (op === "=") return `${left.trim()} == ${right.trim()}`;

        return `${left.trim()} ${op} ${right.trim()}`;
      }
    }
  }

  // Handle other common Dataview filters
  if (condition.includes("file.tags")) {
    const tagMatch = condition.match(/file\.tags\.includes\("([^"]+)"\)/);
    if (tagMatch) {
      return `taggedWith(file.file, "${tagMatch[1]}")`;
    }
  }

  // Handle linksTo function
  if (condition.includes("links")) {
    const linksMatch = condition.match(/links\s*\(\s*"([^"]+)"\s*\)/i);
    if (linksMatch) {
      return `linksTo(file.file, "${linksMatch[1]}")`;
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
