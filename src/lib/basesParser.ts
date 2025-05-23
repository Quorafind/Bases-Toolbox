import * as yaml from "js-yaml";

// Simplified types for a Base file
export interface BaseFile {
  filters?: any;
  formulas?: Record<string, string>;
  display?: Record<string, string>;
  views?: BaseView[];
}

export interface BaseView {
  type: string;
  name?: string;
  limit?: number;
  filters?: any;
  order?: string[];
  group_by?: string;
  agg?: string;
  lat?: string;
  long?: string;
  title?: string;
}

/**
 * Parse a base YAML file content
 */
export function parseBaseFile(content: string): BaseFile | null {
  try {
    return yaml.load(content) as BaseFile;
  } catch (e) {
    console.error("Error parsing YAML:", e);
    return null;
  }
}

/**
 * Apply a formula to a file
 */
export function applyFormula(file: any, formula: string): any {
  if (!formula) return "N/A";

  return evaluateFormulaExpression(file, formula);
}

/**
 * Get a property value from a file
 */
export function getPropertyValue(file: any, propPath: string): any {
  if (!propPath) return undefined;

  propPath = propPath.trim();

  // Handle quoted property names
  if (propPath.startsWith('"') && propPath.endsWith('"')) {
    propPath = propPath.substring(1, propPath.length - 1);
  }

  // Special case for file.file - return the full file object for functions like taggedWith
  if (propPath === "file.file") {
    return file.file;
  }

  // Handle file properties
  if (propPath.startsWith("file.")) {
    const key = propPath.substring(5);
    return file.file[key];
  }

  // Handle formulas - first check cache, then calculate if needed
  if (propPath.startsWith("formula.")) {
    const key = propPath.substring(8);

    // Check if we have a pre-calculated value in the cache
    if (file._formulaCache && file._formulaCache[key] !== undefined) {
      return file._formulaCache[key];
    }

    // Otherwise calculate and potentially cache the result
    const result = calculateFormulaValue(file, key);

    // Cache the result for future use
    if (file._formulaCache) {
      file._formulaCache[key] = result;
    } else {
      file._formulaCache = { [key]: result };
    }

    return result;
  }

  console.log(propPath, file[propPath], file);

  // Regular properties
  return file[propPath];
}

/**
 * Calculate formula value
 */
function calculateFormulaValue(file: any, formulaKey: string): any {
  // Get the formula string from the parsedBase
  if (!file || !formulaKey) return undefined;

  // If we're passed a formula directly instead of a key
  if (
    formulaKey.includes("(") ||
    formulaKey.includes("/") ||
    formulaKey.includes("==")
  ) {
    return evaluateFormulaExpression(file, formulaKey);
  }

  // Try to get the formula from the parsed base
  const formula = file._baseData?.formulas?.[formulaKey];
  if (!formula) {
    console.log("Formula not found:", formulaKey, file);
    // Basic fallback for demo purposes
    if (formulaKey === "ppu") {
      return file.price && file.age ? file.price / file.age : NaN;
    } else if (formulaKey === "formatted_price") {
      return file.price ? `${file.price} dollars` : "N/A";
    } else if (formulaKey === "read_status") {
      return file.status === "Done" ? "Read" : "Unread";
    } else if (formulaKey === "reading_time") {
      return file.wordCount ? file.wordCount / 250 : NaN;
    }
    return "N/A";
  }

  // Evaluate the formula
  return evaluateFormulaExpression(file, formula);
}

/**
 * Evaluate a formula expression
 */
function evaluateFormulaExpression(file: any, expression: string): any {
  if (!expression) return "N/A";

  try {
    // Handle if conditions: if(condition, trueValue, falseValue)
    if (expression.startsWith("if(") && expression.endsWith(")")) {
      const params = parseParameters(
        expression.substring(3, expression.length - 1)
      );
      if (params.length >= 3) {
        const condition = params[0].trim();
        const trueValue = params[1].trim();
        const falseValue = params[2].trim();

        // Evaluate the condition
        const conditionResult = evaluateCondition(file, condition);

        // Return the appropriate value based on the condition
        if (conditionResult) {
          // Remove quotes if the value is a string literal
          if (
            (trueValue.startsWith('"') && trueValue.endsWith('"')) ||
            (trueValue.startsWith("'") && trueValue.endsWith("'"))
          ) {
            return trueValue.substring(1, trueValue.length - 1);
          }
          // Check if this is a formula reference
          if (trueValue.startsWith("formula.")) {
            return calculateFormulaValue(file, trueValue.substring(8));
          }
          // Check if it's a property reference
          return getPropertyValue(file, trueValue);
        } else {
          // Remove quotes if the value is a string literal
          if (
            (falseValue.startsWith('"') && falseValue.endsWith('"')) ||
            (falseValue.startsWith("'") && falseValue.endsWith("'"))
          ) {
            return falseValue.substring(1, falseValue.length - 1);
          }
          // Check if this is a formula reference
          if (falseValue.startsWith("formula.")) {
            return calculateFormulaValue(file, falseValue.substring(8));
          }
          // Check if it's a property reference
          return getPropertyValue(file, falseValue);
        }
      }
      return "N/A";
    }

    // Handle concat function
    if (expression.startsWith("concat(") && expression.endsWith(")")) {
      const paramsStr = expression.substring(7, expression.length - 1);
      const params = parseParameters(paramsStr);

      return params
        .map((param) => {
          param = param.trim();
          // If it's a string literal, remove the quotes
          if (
            (param.startsWith('"') && param.endsWith('"')) ||
            (param.startsWith("'") && param.endsWith("'"))
          ) {
            return param.substring(1, param.length - 1);
          }

          // Check if this is a formula reference
          if (param.startsWith("formula.")) {
            return calculateFormulaValue(file, param.substring(8));
          }

          // Get property value
          return getPropertyValue(file, param);
        })
        .join("");
    }

    // Handle basic arithmetic operations
    // Division
    if (expression.includes("/")) {
      const [left, right] = expression.split("/").map((part) => part.trim());

      // Get the values for the left and right operands
      let leftValue: any = left;
      let rightValue: any = right;

      // Check for formula references
      if (left.startsWith("formula.")) {
        leftValue = calculateFormulaValue(file, left.substring(8));
      } else {
        leftValue = getPropertyValue(file, left);
      }

      if (right.startsWith("formula.")) {
        rightValue = calculateFormulaValue(file, right.substring(8));
      } else {
        rightValue = getPropertyValue(file, right);
      }

      // Convert to numbers if needed
      if (typeof leftValue === "string") leftValue = Number(leftValue);
      if (typeof rightValue === "string") rightValue = Number(rightValue);

      // Perform the division
      return leftValue / rightValue;
    }

    // Multiplication
    if (expression.includes("*")) {
      const [left, right] = expression.split("*").map((part) => part.trim());

      // Get the values for the left and right operands
      let leftValue: any = left;
      let rightValue: any = right;

      // Check for formula references
      if (left.startsWith("formula.")) {
        leftValue = calculateFormulaValue(file, left.substring(8));
      } else {
        leftValue = getPropertyValue(file, left);
      }

      if (right.startsWith("formula.")) {
        rightValue = calculateFormulaValue(file, right.substring(8));
      } else {
        rightValue = getPropertyValue(file, right);
      }

      // Convert to numbers if needed
      if (typeof leftValue === "string") leftValue = Number(leftValue);
      if (typeof rightValue === "string") rightValue = Number(rightValue);

      // Perform the multiplication
      return leftValue * rightValue;
    }

    // Addition
    if (expression.includes("+")) {
      const [left, right] = expression.split("+").map((part) => part.trim());

      // Get the values for the left and right operands
      let leftValue: any = left;
      let rightValue: any = right;

      // Check for formula references
      if (left.startsWith("formula.")) {
        leftValue = calculateFormulaValue(file, left.substring(8));
      } else {
        leftValue = getPropertyValue(file, left);
      }

      if (right.startsWith("formula.")) {
        rightValue = calculateFormulaValue(file, right.substring(8));
      } else {
        rightValue = getPropertyValue(file, right);
      }

      // If either is a string, do string concatenation
      if (typeof leftValue === "string" || typeof rightValue === "string") {
        return String(leftValue) + String(rightValue);
      }

      // Otherwise do numeric addition
      return leftValue + rightValue;
    }

    // Subtraction
    if (expression.includes("-")) {
      const [left, right] = expression.split("-").map((part) => part.trim());

      // Get the values for the left and right operands
      let leftValue: any = left;
      let rightValue: any = right;

      // Check for formula references
      if (left.startsWith("formula.")) {
        leftValue = calculateFormulaValue(file, left.substring(8));
      } else {
        leftValue = getPropertyValue(file, left);
      }

      if (right.startsWith("formula.")) {
        rightValue = calculateFormulaValue(file, right.substring(8));
      } else {
        rightValue = getPropertyValue(file, right);
      }

      // Convert to numbers if needed
      if (typeof leftValue === "string") leftValue = Number(leftValue);
      if (typeof rightValue === "string") rightValue = Number(rightValue);

      // Perform the subtraction
      return leftValue - rightValue;
    }

    // If it's a simple property reference
    if (
      !expression.includes("(") &&
      !expression.includes(")") &&
      !expression.includes("+") &&
      !expression.includes("-") &&
      !expression.includes("*") &&
      !expression.includes("/")
    ) {
      return getPropertyValue(file, expression);
    }

    return "N/A";
  } catch (err) {
    console.error("Error evaluating formula expression:", expression, err);
    return "Error";
  }
}

/**
 * Evaluate a condition for the if() formula function
 */
function evaluateCondition(file: any, condition: string): boolean {
  try {
    // Handle equality check
    if (condition.includes("==")) {
      const [left, right] = condition.split("==").map((part) => part.trim());

      // Get the values for comparison
      let leftValue: any;
      let rightValue: any;

      // Check for formula references
      if (left.startsWith("formula.")) {
        leftValue = calculateFormulaValue(file, left.substring(8));
      } else {
        leftValue = getPropertyValue(file, left);
      }

      // Handle string literals for right value
      if (
        (right.startsWith('"') && right.endsWith('"')) ||
        (right.startsWith("'") && right.endsWith("'"))
      ) {
        rightValue = right.substring(1, right.length - 1);
      } else if (right.startsWith("formula.")) {
        rightValue = calculateFormulaValue(file, right.substring(8));
      } else {
        rightValue = getPropertyValue(file, right);
      }

      return leftValue == rightValue;
    }

    // Handle inequality check
    if (condition.includes("!=")) {
      const [left, right] = condition.split("!=").map((part) => part.trim());

      // Get the values for comparison
      let leftValue: any;
      let rightValue: any;

      // Check for formula references
      if (left.startsWith("formula.")) {
        leftValue = calculateFormulaValue(file, left.substring(8));
      } else {
        leftValue = getPropertyValue(file, left);
      }

      // Handle string literals for right value
      if (
        (right.startsWith('"') && right.endsWith('"')) ||
        (right.startsWith("'") && right.endsWith("'"))
      ) {
        rightValue = right.substring(1, right.length - 1);
      } else if (right.startsWith("formula.")) {
        rightValue = calculateFormulaValue(file, right.substring(8));
      } else {
        rightValue = getPropertyValue(file, right);
      }

      return leftValue != rightValue;
    }

    // Handle greater than
    if (condition.includes(">") && !condition.includes(">=")) {
      const [left, right] = condition.split(">").map((part) => part.trim());

      // Get the values for comparison
      let leftValue: any;
      let rightValue: any;

      // Check for formula references
      if (left.startsWith("formula.")) {
        leftValue = calculateFormulaValue(file, left.substring(8));
      } else {
        leftValue = getPropertyValue(file, left);
      }

      // Handle string literals for right value
      if (
        (right.startsWith('"') && right.endsWith('"')) ||
        (right.startsWith("'") && right.endsWith("'"))
      ) {
        rightValue = right.substring(1, right.length - 1);
      } else if (right.startsWith("formula.")) {
        rightValue = calculateFormulaValue(file, right.substring(8));
      } else {
        rightValue = getPropertyValue(file, right);
      }

      // Convert to numbers if needed
      if (typeof leftValue === "string") leftValue = Number(leftValue);
      if (typeof rightValue === "string") rightValue = Number(rightValue);

      return leftValue > rightValue;
    }

    // Handle greater than or equal
    if (condition.includes(">=")) {
      const [left, right] = condition.split(">=").map((part) => part.trim());

      // Get the values for comparison
      let leftValue: any;
      let rightValue: any;

      // Check for formula references
      if (left.startsWith("formula.")) {
        leftValue = calculateFormulaValue(file, left.substring(8));
      } else {
        leftValue = getPropertyValue(file, left);
      }

      // Handle string literals for right value
      if (
        (right.startsWith('"') && right.endsWith('"')) ||
        (right.startsWith("'") && right.endsWith("'"))
      ) {
        rightValue = right.substring(1, right.length - 1);
      } else if (right.startsWith("formula.")) {
        rightValue = calculateFormulaValue(file, right.substring(8));
      } else {
        rightValue = getPropertyValue(file, right);
      }

      // Convert to numbers if needed
      if (typeof leftValue === "string") leftValue = Number(leftValue);
      if (typeof rightValue === "string") rightValue = Number(rightValue);

      return leftValue >= rightValue;
    }

    // Handle less than
    if (condition.includes("<") && !condition.includes("<=")) {
      const [left, right] = condition.split("<").map((part) => part.trim());

      // Get the values for comparison
      let leftValue: any;
      let rightValue: any;

      // Check for formula references
      if (left.startsWith("formula.")) {
        leftValue = calculateFormulaValue(file, left.substring(8));
      } else {
        leftValue = getPropertyValue(file, left);
      }

      // Handle string literals for right value
      if (
        (right.startsWith('"') && right.endsWith('"')) ||
        (right.startsWith("'") && right.endsWith("'"))
      ) {
        rightValue = right.substring(1, right.length - 1);
      } else if (right.startsWith("formula.")) {
        rightValue = calculateFormulaValue(file, right.substring(8));
      } else {
        rightValue = getPropertyValue(file, right);
      }

      // Convert to numbers if needed
      if (typeof leftValue === "string") leftValue = Number(leftValue);
      if (typeof rightValue === "string") rightValue = Number(rightValue);

      return leftValue < rightValue;
    }

    // Handle less than or equal
    if (condition.includes("<=")) {
      const [left, right] = condition.split("<=").map((part) => part.trim());

      // Get the values for comparison
      let leftValue: any;
      let rightValue: any;

      // Check for formula references
      if (left.startsWith("formula.")) {
        leftValue = calculateFormulaValue(file, left.substring(8));
      } else {
        leftValue = getPropertyValue(file, left);
      }

      // Handle string literals for right value
      if (
        (right.startsWith('"') && right.endsWith('"')) ||
        (right.startsWith("'") && right.endsWith("'"))
      ) {
        rightValue = right.substring(1, right.length - 1);
      } else if (right.startsWith("formula.")) {
        rightValue = calculateFormulaValue(file, right.substring(8));
      } else {
        rightValue = getPropertyValue(file, right);
      }

      // Convert to numbers if needed
      if (typeof leftValue === "string") leftValue = Number(leftValue);
      if (typeof rightValue === "string") rightValue = Number(rightValue);

      return leftValue <= rightValue;
    }

    // For simple property checks (like 'status' alone)
    return !!getPropertyValue(file, condition);
  } catch (err) {
    console.error("Error evaluating condition:", condition, err);
    return false;
  }
}

/**
 * Parse a value from a string, handling quotes and numeric values
 */
function parseValue(value: string): any {
  // Handle string literals
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.substring(1, value.length - 1);
  }

  // Handle numbers
  if (!isNaN(Number(value))) {
    return Number(value);
  }

  // Handle booleans
  if (value === "true") return true;
  if (value === "false") return false;

  // Return as is for properties
  return value;
}

/**
 * Evaluate a function expression against a file
 */
function evaluateFunction(file: any, expression: string): boolean {
  // Extract function name and parameters
  const match = expression.match(/(\w+)\((.*)\)/);
  if (!match) return false;

  const [_, functionName, paramsStr] = match;
  const params = parseParameters(paramsStr);
  // Handle specific functions
  switch (functionName) {
    case "taggedWith":
      return evaluateTaggedWith(file, params);
    case "linksTo":
      return evaluateLinksTo(file, params);
    case "inFolder":
      return evaluateInFolder(file, params);
    case "contains":
      return evaluateContains(file, params);
    case "empty":
      return evaluateEmpty(file, params);
    default:
      return false;
  }
}

/**
 * Parse function parameters, handling commas in quoted strings
 */
function parseParameters(paramsStr: string): string[] {
  const params: string[] = [];
  let currentParam = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr[i];

    if (
      (char === '"' || char === "'") &&
      (i === 0 || paramsStr[i - 1] !== "\\")
    ) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
      currentParam += char;
    } else if (char === "," && !inQuotes) {
      params.push(currentParam.trim());
      currentParam = "";
    } else {
      currentParam += char;
    }
  }

  if (currentParam.trim()) {
    params.push(currentParam.trim());
  }

  return params;
}

/**
 * Evaluate the taggedWith function
 */
function evaluateTaggedWith(file: any, params: string[]): boolean {
  if (params.length < 2) return false;

  const fileObj = getPropertyValue(file, params[0]);
  const tagToCheck = parseValue(params[1]);

  // Check tags in the file.tags property (where we've added them in the mockDataGenerator)
  if (fileObj && fileObj.tags && Array.isArray(fileObj.tags)) {
    return fileObj.tags.includes(tagToCheck);
  }

  // Fallback to checking in the root tags property
  if (file.tags && Array.isArray(file.tags)) {
    return file.tags.includes(tagToCheck);
  }

  return false;
}

/**
 * Evaluate the linksTo function
 */
function evaluateLinksTo(file: any, params: string[]): boolean {
  if (params.length < 2) return false;

  const fileObj = getPropertyValue(file, params[0]);
  const pathToCheck = parseValue(params[1]);

  // Check if the file has links to the specified path
  if (fileObj && fileObj.links && Array.isArray(fileObj.links)) {
    return fileObj.links.includes(pathToCheck);
  }

  // Fallback to checking for path inclusion
  return file.file.path.includes(pathToCheck);
}

/**
 * Evaluate the inFolder function
 */
function evaluateInFolder(file: any, params: string[]): boolean {
  if (params.length < 2) return false;

  const fileObj = getPropertyValue(file, params[0]);
  const folderToCheck = parseValue(params[1]);

  // Check if the file's folder contains the folder path
  return file.file.folder.includes(folderToCheck);
}

/**
 * Evaluate the contains function
 */
function evaluateContains(file: any, params: string[]): boolean {
  if (params.length < 2) return false;

  const target = getPropertyValue(file, params[0]);
  const query = parseValue(params[1]);

  if (Array.isArray(target)) {
    return target.includes(query);
  }

  if (typeof target === "string") {
    return target.includes(query);
  }

  return false;
}

/**
 * Evaluate the empty function
 */
function evaluateEmpty(file: any, params: string[]): boolean {
  if (params.length < 1) return false;

  const target = getPropertyValue(file, params[0]);

  if (Array.isArray(target)) {
    return target.length === 0;
  }

  if (typeof target === "string") {
    return target.length === 0;
  }

  if (typeof target === "object" && target !== null) {
    return Object.keys(target).length === 0;
  }

  return !target;
}

/**
 * Apply filters to a list of files
 * This is a more comprehensive implementation that handles nested conditions
 */
export function applyFilters(files: any[], filters: any): any[] {
  if (!filters) return files;

  return files.filter((file) => evaluateFilter(file, filters));
}

/**
 * Evaluate a filter condition against a file
 */
function evaluateFilter(file: any, filter: any): boolean {
  // Handle string expressions (like "status != 'done'")
  if (typeof filter === "string") {
    return evaluateExpression(file, filter);
  }

  // Handle AND condition
  if (filter.and) {
    return filter.and.every((condition: any) =>
      evaluateFilter(file, condition)
    );
  }

  // Handle OR condition
  if (filter.or) {
    return filter.or.some((condition: any) => evaluateFilter(file, condition));
  }

  // Handle NOT condition
  if (filter.not) {
    if (Array.isArray(filter.not)) {
      // If not is an array, none of the conditions should be true
      return !filter.not.some((condition: any) =>
        evaluateFilter(file, condition)
      );
    } else {
      // If not is a single condition, negate it
      return !evaluateFilter(file, filter.not);
    }
  }

  // Default to true if no recognizable filter structure
  return true;
}

/**
 * Evaluate a string expression against a file
 */
function evaluateExpression(file: any, expression: string): boolean {
  // Handle function expressions like taggedWith(file.file, "tag")
  if (expression.includes("(") && expression.includes(")")) {
    return evaluateFunction(file, expression);
  }

  // Handle comparison expressions
  const comparisons = [
    { op: "==", fn: (a: any, b: any) => a == b },
    { op: "!=", fn: (a: any, b: any) => a != b },
    { op: ">=", fn: (a: any, b: any) => a >= b },
    { op: "<=", fn: (a: any, b: any) => a <= b },
    { op: ">", fn: (a: any, b: any) => a > b },
    { op: "<", fn: (a: any, b: any) => a < b },
  ];

  for (const { op, fn } of comparisons) {
    if (expression.includes(op)) {
      const [left, right] = expression.split(op).map((part) => part.trim());
      const leftValue = getPropertyValue(file, left);
      const rightValue = parseValue(right);
      return fn(leftValue, rightValue);
    }
  }

  // If it's just a property name, check if it's truthy
  return !!getPropertyValue(file, expression);
}
