import { parseQuery } from "./query-parse";
import { DataviewToBasesTransformer } from "./transformer";

/**
 * Parse a Dataview TABLE query and convert it to Bases YAML
 * @param dataviewQuery The Dataview query string
 * @param placeFiltersInView Whether to place filters in the view (true) or globally (false)
 * @returns The Bases YAML string
 */
export function parseDataviewTable(
  dataviewQuery: string,
  placeFiltersInView: boolean = true
): string {
  try {
    // Parse the query using Parsimmon parser
    const parseResult = parseQuery(dataviewQuery);

    console.log(parseResult);

    if (!parseResult.successful) {
      throw new Error(`Failed to parse Dataview query: ${parseResult.error}`);
    }

    // Transform the AST to Bases structure
    const transformer = new DataviewToBasesTransformer();
    return transformer.toYaml(parseResult.value, placeFiltersInView);
  } catch (error) {
    console.error("Error parsing Dataview query:", error);
    if (error instanceof Error) {
      return `# Error parsing Dataview query: ${error.message}`;
    }
    return "# Error parsing Dataview query";
  }
}

// Re-export types and utilities for external use
export { parseQuery } from "./query-parse";
export { DataviewToBasesTransformer } from "./transformer";
export type { Query, QueryHeader, QueryOperation } from "./query-types";
export type { Field } from "./field";
export type { Source } from "./source-types";
