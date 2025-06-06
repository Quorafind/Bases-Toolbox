import type {
  Query,
  QueryHeader,
  QueryOperation,
  WhereStep,
  SortByStep,
  LimitStep,
  GroupStep,
  NamedField,
  QuerySortBy,
} from "./query-types";
import type {
  Field,
  BinaryOpField,
  FunctionField,
  VariableField,
  LiteralField,
  IndexField,
  NegatedField,
  ListField,
} from "./field";
import type {
  Source,
  TagSource,
  FolderSource,
  LinkSource,
  BinaryOpSource,
  NegatedSource,
} from "./source-types";
import * as yaml from "js-yaml";
import { DateTime, Duration } from "luxon";

/**
 * Transformer class that converts parsed Dataview AST to Bases YAML structure
 */
export class DataviewToBasesTransformer {
  private formulaCounter: number = 0;

  /**
   * Helper method to flatten nested AND/OR operations
   */
  private flattenLogicalOperations(
    operator: "and" | "or",
    operations: any[]
  ): any {
    const flattened: any[] = [];

    for (const op of operations) {
      if (op && typeof op === "object" && operator in op) {
        // If the operation is the same type, flatten it
        flattened.push(...op[operator]);
      } else if (op !== null && op !== undefined) {
        // Otherwise, add it as is
        flattened.push(op);
      }
    }

    // If only one element after flattening, return it directly
    if (flattened.length === 1) {
      return flattened[0];
    }

    // Otherwise return the flattened array
    return flattened.length > 0 ? { [operator]: flattened } : null;
  }

  /**
   * Transform a parsed Dataview query to Bases YAML structure
   */
  transform(query: Query, placeFiltersInView: boolean = true): any {
    const result: any = {
      views: [
        {
          type: "table",
          name: "Default view",
        },
      ],
    };

    // Transform the query header (TABLE, LIST, TASK, CALENDAR)
    this.transformHeader(query.header, result);

    // Transform the source (FROM clause)
    const sourceFilters = this.transformSource(query.source);

    // Process operations (WHERE, SORT, LIMIT, GROUP BY, etc.)
    let whereFilters: any = null;

    for (const operation of query.operations) {
      switch (operation.type) {
        case "where":
          whereFilters = this.transformWhereClause(operation as WhereStep);
          break;
        case "sort":
          this.transformSortClause(operation as SortByStep, result);
          break;
        case "limit":
          this.transformLimitClause(operation as LimitStep, result);
          break;
        case "group":
          this.transformGroupClause(operation as GroupStep, result);
          break;
        // Handle other operations as needed
      }
    }

    // Combine source and where filters
    let combinedFilters = this.combineFilters(sourceFilters, whereFilters);

    if (combinedFilters) {
      if (placeFiltersInView) {
        result.views[0].filters = combinedFilters;
      } else {
        result.filters = combinedFilters;
      }
    }

    return result;
  }

  /**
   * Convert the result to YAML string
   */
  toYaml(query: Query, placeFiltersInView: boolean = true): string {
    const basesObject = this.transform(query, placeFiltersInView);
    return yaml.dump(basesObject);
  }

  /**
   * Transform the query header (TABLE, LIST, etc.)
   */
  private transformHeader(header: QueryHeader, result: any): void {
    switch (header.type) {
      case "table":
        result.views[0].type = "table";
        if (header.fields.length > 0) {
          result.display = {};
          const columnOrder: string[] = [];
          const formulas: Record<string, string> = {};

          // Add file.name column if showId is true (no "WITHOUT ID")
          if (header.showId) {
            result.display["file.name"] = "Name";
            columnOrder.unshift("file.name");
          }

          header.fields.forEach((namedField, index) => {
            const transformed = this.transformNamedField(namedField, index);
            result.display[transformed.fieldName] = transformed.displayName;
            columnOrder.push(transformed.fieldName);

            if (transformed.formula && transformed.formulaKey) {
              formulas[transformed.formulaKey] = transformed.formula;
            }
          });

          result.views[0].order = columnOrder;

          if (Object.keys(formulas).length > 0) {
            result.formulas = formulas;
          }
        } else {
          // Handle case when no fields are specified
          if (header.showId) {
            result.display = { "file.name": "Name" };
            result.views[0].order = ["file.name"];
          }
        }
        break;

      case "list":
        throw new Error(
          "LIST queries are not supported. Please use TABLE queries instead."
        );

      case "task":
        throw new Error(
          "TASK queries are not supported. Please use TABLE queries instead."
        );

      case "calendar":
        throw new Error(
          "CALENDAR queries are not supported. Please use TABLE queries instead."
        );
    }
  }

  /**
   * Transform a named field (used in TABLE columns)
   */
  private transformNamedField(
    namedField: NamedField,
    index: number
  ): {
    fieldName: string;
    displayName: string;
    formula?: string;
    formulaKey?: string;
  } {
    const displayName = namedField.name;

    // Check if this is a computed field (formula)
    if (this.isFormulaField(namedField.field)) {
      const formulaKey = displayName.toLowerCase().replace(/\s+/g, "_");
      const formula = this.transformFieldExpression(namedField.field);

      return {
        fieldName: `formula.${formulaKey}`,
        displayName: displayName,
        formula: formula,
        formulaKey: formulaKey,
      };
    } else {
      // Simple field reference
      const fieldName = this.transformFieldExpression(namedField.field);

      return {
        fieldName: fieldName,
        displayName: displayName,
      };
    }
  }

  /**
   * Check if a field is a formula (computed field)
   */
  private isFormulaField(field: Field): boolean {
    // A field is considered a formula if it's not just a simple variable or property access
    switch (field.type) {
      case "variable":
        return false;
      case "index":
        // Property access like file.name is not a formula
        return this.isFormulaField(field.object);
      default:
        // Binary operations, functions, etc. are formulas
        return true;
    }
  }

  /**
   * Transform the source (FROM clause)
   */
  private transformSource(source: Source): any {
    switch (source.type) {
      case "folder":
        if (!source.folder || source.folder === "") {
          return null;
        }
        return `file.inFolder("${source.folder}")`;
      case "tag":
        // Remove the # prefix if it exists
        const tag = source.tag.startsWith("#")
          ? source.tag.slice(1)
          : source.tag;
        return `file.hasTag("${tag}")`;
      case "link":
        return `file.hasLink("${source.file}")`;

      case "negate":
        const inner = this.transformSource(source.child);
        if (!inner) return null;

        // If inner is an object with and/or, wrap it in not
        if (typeof inner === "object" && ("and" in inner || "or" in inner)) {
          return { not: [inner] };
        }
        return { not: [inner] };

      case "binaryop":
        const left = this.transformSource(source.left);
        const right = this.transformSource(source.right);

        if (!left && !right) return null;
        if (!left) return right;
        if (!right) return left;

        const operator = source.op === "&" ? "and" : "or";
        return this.flattenLogicalOperations(operator, [left, right]);

      case "empty":
        return null;

      default:
        return null;
    }
  }

  /**
   * Transform WHERE clause
   */
  private transformWhereClause(whereStep: WhereStep): any {
    return this.transformFieldExpression(whereStep.clause);
  }

  /**
   * Transform SORT clause
   */
  private transformSortClause(sortStep: SortByStep, result: any): void {
    const sortFields = sortStep.fields.map((sortField) => ({
      column: this.transformFieldExpression(sortField.field),
      direction: sortField.direction === "ascending" ? "asc" : "desc",
    }));

    result.views[0].sort = sortFields;
  }

  /**
   * Transform LIMIT clause
   */
  private transformLimitClause(limitStep: LimitStep, result: any): void {
    // Extract the limit value
    if (
      limitStep.amount.type === "literal" &&
      typeof limitStep.amount.value === "number"
    ) {
      result.views[0].limit = limitStep.amount.value;
    } else {
      // Handle dynamic limits if needed
      const limitExpr = this.transformFieldExpression(limitStep.amount);
      // For now, we'll try to parse it as a number if it's a simple expression
      const parsed = parseInt(limitExpr);
      if (!isNaN(parsed)) {
        result.views[0].limit = parsed;
      }
    }
  }

  /**
   * Transform GROUP BY clause
   */
  private transformGroupClause(groupStep: GroupStep, result: any): void {
    const groupField = this.transformFieldExpression(groupStep.field.field);
    result.views[0].group_by = groupField;
  }

  /**
   * Transform a field expression to Bases format
   */
  private transformFieldExpression(field: Field): any {
    switch (field.type) {
      case "variable":
        return this.mapDataviewPropertyToBaseProperty(field.name);

      case "literal":
        return this.transformLiteral(field);

      case "index":
        return this.transformIndexField(field);

      case "binaryop":
        return this.transformBinaryOp(field);

      case "function":
        return this.transformFunction(field);

      case "negated":
        const negatedChild = this.transformFieldExpression(field.child);

        // If the child is a logical object, wrap it in not
        if (
          typeof negatedChild === "object" &&
          ("and" in negatedChild || "or" in negatedChild)
        ) {
          return { not: [negatedChild] };
        }

        // For simple expressions, use the not object format
        return { not: [negatedChild] };

      case "list":
        // Transform list literals
        const listItems = field.values.map((v) =>
          this.transformFieldExpression(v)
        );
        return `[${listItems.join(", ")}]`;

      default:
        // Fallback for unhandled field types
        return "";
    }
  }

  /**
   * Transform literal values
   */
  private transformLiteral(field: LiteralField): string {
    const value = field.value;

    if (typeof value === "string") {
      return `"${value}"`;
    } else if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    } else if (value === null) {
      return "null";
    } else if (value instanceof DateTime) {
      // Handle DateTime literals
      return `date("${value.toISODate()}")`;
    } else if (value && typeof value === "object" && "toISO" in value) {
      // Handle Duration literals (they have toISO method)
      // Convert Duration to a string format for Bases
      const dur = value as any;
      if (dur.years) return `"${dur.years} year${dur.years !== 1 ? "s" : ""}"`;
      if (dur.months)
        return `"${dur.months} month${dur.months !== 1 ? "s" : ""}"`;
      if (dur.weeks) return `"${dur.weeks} week${dur.weeks !== 1 ? "s" : ""}"`;
      if (dur.days) return `"${dur.days} day${dur.days !== 1 ? "s" : ""}"`;
      if (dur.hours) return `"${dur.hours} hour${dur.hours !== 1 ? "s" : ""}"`;
      if (dur.minutes)
        return `"${dur.minutes} minute${dur.minutes !== 1 ? "s" : ""}"`;
      if (dur.seconds)
        return `"${dur.seconds} second${dur.seconds !== 1 ? "s" : ""}"`;
      return `"0 days"`;
    } else {
      // Handle other literal types as needed
      return String(value);
    }
  }

  /**
   * Transform index fields (property access)
   */
  private transformIndexField(field: IndexField): string {
    const object = this.transformFieldExpression(field.object);
    const index = field.index;

    if (index.type === "literal" && typeof index.value === "string") {
      // Handle special date property accessors
      const dateAccessors = [
        "year",
        "month",
        "day",
        "hour",
        "minute",
        "second",
        "millisecond",
      ];
      if (dateAccessors.includes(index.value.toLowerCase())) {
        return `${object}.${index.value.toLowerCase()}`;
      }

      // Regular property access
      return this.mapDataviewPropertyToBaseProperty(`${object}.${index.value}`);
    }

    // Dynamic index access
    return `${object}[${this.transformFieldExpression(index)}]`;
  }

  /**
   * Transform binary operations
   */
  private transformBinaryOp(field: BinaryOpField): any {
    const left = this.transformFieldExpression(field.left);
    const right = this.transformFieldExpression(field.right);

    // Map Dataview operators to Bases operators
    const operatorMap: Record<string, string> = {
      "=": "==",
      "!=": "!=",
      ">": ">",
      ">=": ">=",
      "<": "<",
      "<=": "<=",
      "+": "+",
      "-": "-",
      "*": "*",
      "/": "/",
      "%": "%",
      "&": "&&",
      "|": "||",
    };

    const operator = operatorMap[field.op] || field.op;

    // Handle logical operators using object format for filters
    if (field.op === "&" || field.op === "|") {
      const logicalOp = field.op === "&" ? "and" : "or";

      // Check if we're in a filter context (both operands are filter expressions)
      if (
        this.isFilterExpression(field.left) ||
        this.isFilterExpression(field.right) ||
        this.isLogicalObject(left) ||
        this.isLogicalObject(right)
      ) {
        return this.flattenLogicalOperations(logicalOp, [left, right]);
      }

      // For non-filter contexts, use string format
      return `${left} ${operator} ${right}`;
    }

    // Handle date arithmetic specially
    if (field.op === "+" || field.op === "-") {
      // Check if left side is a date function or now()
      const isLeftDate =
        this.isDateExpression(field.left) ||
        (field.left.type === "function" &&
          field.left.func.type === "variable" &&
          field.left.func.name.toLowerCase() === "date");

      // Check if right side is a duration
      const isRightDuration =
        (field.right.type === "function" &&
          field.right.func.type === "variable" &&
          field.right.func.name.toLowerCase() === "dur") ||
        (field.right.type === "literal" &&
          field.right.value &&
          typeof field.right.value === "object" &&
          "toISO" in field.right.value);

      if (isLeftDate && isRightDuration) {
        // Handle date +/- duration using the new syntax
        let durationStr = right;
        if (durationStr.startsWith('"') && durationStr.endsWith('"')) {
          // Remove quotes from duration string
          durationStr = durationStr.slice(1, -1);
        }

        if (field.op === "-") {
          // For subtraction, negate the duration
          if (!durationStr.startsWith("-")) {
            durationStr = `-${durationStr}`;
          }
        }

        return `${left} + "${durationStr}"`;
      }

      // Check if both sides are dates (for date difference)
      if (isLeftDate && this.isDateExpression(field.right)) {
        // Date difference - this would need to be handled as a formula
        // For now, return a basic subtraction
        return `${left} - ${right}`;
      }
    }

    // Handle string concatenation with +
    if (
      field.op === "+" &&
      field.right.type === "literal" &&
      typeof field.right.value === "string"
    ) {
      return `${left} + ${right}`;
    }

    return `${left} ${operator} ${right}`;
  }

  /**
   * Check if a field is a date expression
   */
  private isDateExpression(field: Field): boolean {
    if (field.type === "function" && field.func.type === "variable") {
      const funcName = field.func.name.toLowerCase();
      return funcName === "date" || funcName === "now";
    }
    if (field.type === "literal" && field.value instanceof DateTime) {
      return true;
    }
    return false;
  }

  /**
   * Check if a field expression is a filter expression (comparison or filter function)
   */
  private isFilterExpression(field: Field): boolean {
    if (field.type === "binaryop") {
      const compareOps = ["=", "!=", ">", ">=", "<", "<="];
      return compareOps.includes(field.op);
    }

    if (field.type === "function") {
      // Check if it's a filter function
      const filterFunctions = [
        "contains",
        "containsAny",
        "containsAll",
        "startswith",
        "endswith",
        "empty",
        "notEmpty",
        "hasTag",
        "hasLink",
        "inFolder",
      ];

      if (field.func.type === "variable") {
        return filterFunctions.includes(field.func.name.toLowerCase());
      }
    }

    if (field.type === "negated") {
      return true; // not() is always a filter expression
    }

    return false;
  }

  /**
   * Check if a value is a logical filter object (has 'and' or 'or' keys)
   */
  private isLogicalObject(value: any): boolean {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !("type" in value) && // Not a Field object
      ("and" in value || "or" in value)
    );
  }

  /**
   * Transform function calls
   */
  private transformFunction(field: FunctionField): string {
    // Extract function name
    let funcName = "";
    if (field.func.type === "variable") {
      funcName = field.func.name;
    } else if (
      field.func.type === "literal" &&
      typeof field.func.value === "string"
    ) {
      funcName = field.func.value;
    }

    // Special handling for link() function - transform to link() function call
    if (funcName.toLowerCase() === "link") {
      if (field.arguments.length === 1) {
        const linkTarget = this.transformFieldExpression(field.arguments[0]);
        return `link(${linkTarget})`;
      } else if (field.arguments.length === 2) {
        const linkTarget = this.transformFieldExpression(field.arguments[0]);
        const displayText = this.transformFieldExpression(field.arguments[1]);
        return `link(${linkTarget}, ${displayText})`;
      }
    }

    // Map Dataview functions to Bases functions
    const functionMap: Record<string, string> = {
      round: "round",
      floor: "floor",
      ceil: "ceil",
      abs: "abs",
      min: "min",
      max: "max",
      sum: "sum",
      avg: "average",
      length: "length",
      contains: "contains",
      containsany: "containsAny",
      containsall: "containsAll",
      startswith: "startsWith",
      endswith: "endsWith",
      empty: "isEmpty",
      notempty: "!isEmpty",
      dateformat: "format",
      date: "date",
      now: "now",
      dur: "duration",
      year: "year",
      month: "month",
      day: "day",
      hour: "hour",
      minute: "minute",
      second: "second",
      millisecond: "millisecond",
      tofixed: "toFixed",
      tostring: "toString",
      trim: "trim",
      title: "title",
      split: "split",
      replace: "replace",
      slice: "slice",
      reverse: "reverse",
      join: "join",
      sort: "sort",
      flat: "flat",
      unique: "unique",
    };

    const basesFunc = functionMap[funcName.toLowerCase()] || funcName;

    // Special handling for date function BEFORE transforming arguments
    if (basesFunc === "date" && field.arguments.length === 1) {
      // Check if the argument is a variable like today, tomorrow, yesterday
      if (field.arguments[0].type === "variable") {
        const varName = field.arguments[0].name.toLowerCase();
        switch (varName) {
          case "today":
            return "now()";
          case "tomorrow":
            return 'now() + "1 day"';
          case "yesterday":
            return 'now() + "-1 day"';
        }
      }

      // Check if the argument looks like a date expression (YYYY-MM-DD)
      if (this.isDateLikeExpression(field.arguments[0])) {
        const dateStr = this.extractDateString(field.arguments[0]);
        if (dateStr) {
          return `date("${dateStr}")`;
        }
      }
    }

    // Transform arguments
    const args = field.arguments.map((arg) =>
      this.transformFieldExpression(arg)
    );

    // Special handling for certain functions
    switch (basesFunc) {
      case "contains":
        // Special handling for tags - convert to file.hasTag()
        if (args.length === 2 && args[0] === "tags") {
          const tag = args[1].replace(/^"/, "").replace(/"$/, "");
          return `file.hasTag("${tag}")`;
        }
        break;

      case "date":
        // Handle string literal date keywords (already handled variable case above)
        if (args.length === 1) {
          const dateArg = args[0].replace(/^"/, "").replace(/"$/, "");
          switch (dateArg.toLowerCase()) {
            case "today":
              return "now()";
            case "tomorrow":
              return 'now() + "1 day"';
            case "yesterday":
              return 'now() + "-1 day"';
            default:
              return `date(${args[0]})`;
          }
        }
        break;

      case "duration":
        // Handle dur() function - convert to string format
        if (args.length === 1) {
          // Extract the duration string from dur(X days) format
          const durMatch = args[0].match(/(\d+)\s*([a-zA-Z]+)/);
          if (durMatch) {
            const [, num, unit] = durMatch;
            const numVal = parseInt(num);
            let unitName = unit.toLowerCase();

            // Convert weeks to days
            if (unitName.startsWith("week")) {
              const days = numVal * 7;
              return `"${days} day${days !== 1 ? "s" : ""}"`;
            }

            // Ensure proper pluralization
            if (numVal !== 1 && !unitName.endsWith("s")) {
              unitName += "s";
            } else if (numVal === 1 && unitName.endsWith("s")) {
              unitName = unitName.slice(0, -1);
            }

            return `"${num} ${unitName}"`;
          }
        }
        break;

      case "!isEmpty":
        // Handle notEmpty as negated isEmpty
        return `!(${args.join(", ")}.isEmpty())`;
    }

    return `${basesFunc}(${args.join(", ")})`;
  }

  /**
   * Map Dataview property names to Bases property names
   */
  private mapDataviewPropertyToBaseProperty(prop: string): string {
    prop = prop.trim();

    // Handle common Dataview file property mappings
    const propertyMap: Record<string, string> = {
      "file.path": "file.path",
      "file.name": "file.name",
      "file.folder": "file.folder",
      "file.ext": "file.ext",
      "file.size": "file.size",
      "file.ctime": "file.ctime",
      "file.mtime": "file.mtime",
      "file.cday": "file.ctime",
      "file.mday": "file.mtime",
      tags: "tags",
    };

    if (propertyMap[prop]) {
      return propertyMap[prop];
    }

    // Handle properties with hyphens by converting to underscores
    if (prop.includes("-")) {
      return prop.replace(/-/g, "_");
    }

    return prop;
  }

  /**
   * Combine source and where filters
   */
  private combineFilters(sourceFilters: any, whereFilters: any): any {
    if (!sourceFilters && !whereFilters) {
      return null;
    }

    if (!sourceFilters) {
      return whereFilters;
    }

    if (!whereFilters) {
      return sourceFilters;
    }

    // Combine with AND using the object format
    return this.flattenLogicalOperations("and", [sourceFilters, whereFilters]);
  }

  /**
   * Check if a field looks like a date expression (e.g., 2023-01-01)
   */
  private isDateLikeExpression(field: Field): boolean {
    // Check for pattern: number - number - number
    if (field.type === "binaryop" && field.op === "-") {
      // Check if right side is also a subtraction
      if (field.right.type === "binaryop" && field.right.op === "-") {
        // Check if all parts are numbers that could be date components
        if (
          field.left.type === "literal" &&
          typeof field.left.value === "number" &&
          field.right.left.type === "literal" &&
          typeof field.right.left.value === "number" &&
          field.right.right.type === "literal" &&
          typeof field.right.right.value === "number"
        ) {
          const year = field.left.value;
          const month = field.right.left.value;
          const day = field.right.right.value;

          // Basic validation for date components
          return (
            year >= 1900 &&
            year <= 2100 &&
            month >= 1 &&
            month <= 12 &&
            day >= 1 &&
            day <= 31
          );
        }
      }
    }
    return false;
  }

  /**
   * Extract date string from a date-like expression
   */
  private extractDateString(field: Field): string | null {
    if (
      field.type === "binaryop" &&
      field.op === "-" &&
      field.right.type === "binaryop" &&
      field.right.op === "-"
    ) {
      const year = (field.left as LiteralField).value;
      const month = (field.right.left as LiteralField).value;
      const day = (field.right.right as LiteralField).value;

      // Format with leading zeros
      const monthStr = String(month).padStart(2, "0");
      const dayStr = String(day).padStart(2, "0");

      return `${year}-${monthStr}-${dayStr}`;
    }
    return null;
  }
}
