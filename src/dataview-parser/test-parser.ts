import { parseDataviewTable } from "./index";

// Test cases
const testQueries = [
  // Simple TABLE query
  `TABLE file.name, file.size
   FROM "projects"
   WHERE completed = true
   SORT file.mtime DESC
   LIMIT 10`,

  // TABLE with formulas
  `TABLE (file.size / 1024) as "Size (KB)", 
         (file.mtime.year) as Year,
         pages-read + " pages" as Progress
   FROM #book
   WHERE rating > 3`,

  // Complex WHERE with functions
  `TABLE title, author, due
   FROM "tasks"
   WHERE contains(tags, "urgent") AND due < date(tomorrow)
   SORT due ASC`,

  // GROUP BY example
  `TABLE count(file.name) as Count
   FROM "notes"
   WHERE file.ctime > date(today) - dur(7 days)
   GROUP BY file.folder`,

  // Multiple filters with OR/AND
  `TABLE file.name, priority
   FROM #project or #task
   WHERE (status = "active" AND priority > 2) OR contains(file.name, "urgent")
   SORT priority DESC, file.name ASC`,
];

console.log("Testing Dataview to Bases parser...\n");

testQueries.forEach((query, index) => {
  console.log(`\n--- Test ${index + 1} ---`);
  console.log("Input Dataview Query:");
  console.log(query);
  console.log("\nOutput Bases YAML:");

  try {
    const result = parseDataviewTable(query);
    console.log(result);
  } catch (error) {
    console.error("Error:", error);
  }
});

// Test error handling
console.log("\n--- Error Handling Test ---");
const invalidQuery = "INVALID QUERY FORMAT";
console.log("Input:", invalidQuery);
console.log("Output:", parseDataviewTable(invalidQuery));
