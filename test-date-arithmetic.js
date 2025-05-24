import { parseQuery } from "./src/dataview-parser/query-parse.js";
import { DataviewToBasesTransformer } from "./src/dataview-parser/transformer.js";

// Test cases for date arithmetic
const testCases = [
  'TABLE date(today) - dur(7 days) AS "Week Ago"',
  'TABLE date(today) + dur(1 week) AS "Next Week"',
  'TABLE date(today) - dur(30 days) AS "Month Ago"',
  "LIST WHERE file.mtime > date(today) - dur(7 days)",
  'TABLE date("2024-01-01") + dur(10 days) AS "Jan 11"',
];

console.log("Testing date arithmetic transformations:\n");

testCases.forEach((query, index) => {
  console.log(`Test ${index + 1}: ${query}`);

  const parseResult = parseQuery(query);
  if (parseResult.successful) {
    const transformer = new DataviewToBasesTransformer();
    const basesYaml = transformer.toYaml(parseResult.value, true);
    console.log("Result:");
    console.log(basesYaml);
    console.log("---\n");
  } else {
    console.log(`Parse error: ${parseResult.error}\n`);
  }
});
