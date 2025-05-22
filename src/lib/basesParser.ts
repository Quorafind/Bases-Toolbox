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

  // This is a very simplified implementation
  // In a real app, you'd need a proper formula parser

  // Simple arithmetic
  if (formula.includes("/")) {
    const [left, right] = formula.split("/").map((p) => p.trim());
    return getPropertyValue(file, left) / getPropertyValue(file, right);
  }

  // Check for concat
  if (formula.startsWith("concat(")) {
    const params = formula.substring(7, formula.length - 1).split(",");
    return params
      .map((p) => {
        if (p.trim().startsWith('"') && p.trim().endsWith('"')) {
          return p.trim().substring(1, p.trim().length - 1);
        }
        return getPropertyValue(file, p.trim());
      })
      .join("");
  }

  return "N/A";
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

  // Handle file properties
  if (propPath.startsWith("file.")) {
    const key = propPath.substring(5);
    return file.file[key];
  }

  // Handle formulas
  if (propPath.startsWith("formula.")) {
    const key = propPath.substring(8);
    return calculateFormulaValue(file, key);
  }

  // Regular properties
  return file[propPath];
}

/**
 * Calculate formula value
 */
function calculateFormulaValue(file: any, formula: string): any {
  // Basic implementation for the example
  if (formula === "ppu") {
    return file.price / file.age;
  } else if (formula === "formatted_price") {
    return `${file.price} dollars`;
  }
  return "N/A";
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
  // Handle function expressions like tagged_with(file.file, "tag")
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
    case "tagged_with":
      return evaluateTaggedWith(file, params);
    case "links_to":
      return evaluateLinksTo(file, params);
    case "in_folder":
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
 * Evaluate the tagged_with function
 */
function evaluateTaggedWith(file: any, params: string[]): boolean {
  if (params.length < 2) return false;

  const fileObj = getPropertyValue(file, params[0]);
  const tagToCheck = parseValue(params[1]);

  // In a mock environment, we're checking the tags array
  if (file.tags && Array.isArray(file.tags)) {
    return file.tags.includes(tagToCheck);
  }

  return false;
}

/**
 * Evaluate the links_to function
 */
function evaluateLinksTo(file: any, params: string[]): boolean {
  if (params.length < 2) return false;

  const fileObj = getPropertyValue(file, params[0]);
  const pathToCheck = parseValue(params[1]);

  // In our mock environment, we'll just check for path inclusion in the file path
  // In a real implementation, you'd check for actual links
  return file.file.path.includes(pathToCheck);
}

/**
 * Evaluate the in_folder function
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
