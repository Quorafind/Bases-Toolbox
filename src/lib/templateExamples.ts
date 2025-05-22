/**
 * Collection of example Base templates to demonstrate different features
 */

export const baseTemplates = {
  basic: {
    name: "Basic Table",
    yaml: `filters:
  or:
    - tagged_with(file.file, "book")
    - and:
        - tagged_with(file.file, "book")
        - links_to(file.file, "Textbook")
formulas:
  formatted_price: 'concat(price, " dollars")'
  ppu: "price / age"
display:
  status: Status
  formula.formatted_price: "Price"
  "file.ext": Extension
views:
  - type: table
    name: "My table"
    limit: 10
    filters:
      and:
        - 'status != "done"'
        - or:
            - "formula.ppu > 5"
            - "price > 2.1"
    order:
      - file.name
      - file.ext
      - property.age
      - formula.ppu
      - formula.formatted_price`,
  },

  bookLibrary: {
    name: "Book Library",
    yaml: `filters:
  and:
    - tagged_with(file.file, "book")
    - not:
        - tagged_with(file.file, "textbook")
formulas:
  read_status: 'if(status == "Done", "Read", "Unread")'
  reading_time: 'wordCount / 250'
display:
  author: Author
  formula.read_status: "Reading Status"
  formula.reading_time: "Est. Reading Hours"
  tags: Tags
  priority: Priority
views:
  - type: table
    name: "Reading List"
    filters: 'formula.read_status == "Unread"'
    order:
      - file.name
      - author
      - priority
      - formula.reading_time
  - type: gallery
    name: "Book Gallery"
    filters: 'formula.read_status == "Unread"'
    title_field: file.name
    description_field: summary
  - type: board
    name: "Reading Board"
    group_by: "priority"
    title_field: file.name
    description_field: summary
  - type: table
    name: "Completed Books"
    filters: 'formula.read_status == "Read"'
    order:
      - file.name
      - author
      - priority
      - formula.reading_time`,
  },

  projectTracker: {
    name: "Project Tracker",
    yaml: `filters:
  and:
    - tagged_with(file.file, "project")
formulas:
  days_active: 'if(status == "In Progress", date_diff(now(), created) / 86400000, 0)'
  status_emoji: 'if(status == "Done", "✅", if(status == "In Progress", "🔄", if(status == "Backlog", "📌", "❓")))'
display:
  formula.status_emoji: ""
  status: Status
  priority: Priority
  category: Category
  formula.days_active: "Days Active"
views:
  - type: board
    name: "Project Board"
    group_by: "status"
    title_field: file.name
    description_field: summary
  - type: table
    name: "Active Projects"
    filters: 'status == "In Progress"'
    order:
      - priority
      - file.name
      - formula.days_active
  - type: table
    name: "Backlog"
    filters: 'status == "Backlog"'
    order:
      - priority
      - file.name`,
  },

  locationTracker: {
    name: "Location Tracker",
    yaml: `filters:
  and:
    - has_coords == true
formulas:
  location_name: 'concat(file.name, " (", lat, ", ", long, ")")'
display:
  formula.location_name: "Location"
  summary: "Description"
  category: "Category"
views:
  - type: map
    name: "All Locations"
    lat: lat
    long: long
    title: file.name
  - type: table
    name: "Location Details"
    order:
      - formula.location_name
      - category
      - summary`,
  },

  taskManagement: {
    name: "Task Management",
    yaml: `filters:
  or:
    - category == "Project"
    - tagged_with(file.file, "task")
formulas:
  due_soon: 'if(created > date_modify(now(), "-7 days"), true, false)'
  priority_label: 'if(priority == 5, "Critical", if(priority == 4, "High", if(priority == 3, "Medium", if(priority == 2, "Low", "None"))))'
display:
  status: "Status"
  formula.priority_label: "Priority"
  author: "Assigned To"
  formula.due_soon: "Due Soon"
views:
  - type: board
    name: "Task Board"
    group_by: "status"
    title_field: file.name
    description_field: summary
  - type: table
    name: "All Tasks"
    group_by: "status"
    order:
      - formula.priority_label
      - file.name
      - author
  - type: calendar
    name: "Task Calendar"
    date_field: created
    title_field: file.name
  - type: table
    name: "Due Soon"
    filters: 'formula.due_soon == true'
    order:
      - formula.priority_label
      - status
      - file.name`,
  },

  readingPlanner: {
    name: "Reading Planner",
    yaml: `filters:
  tagged_with(file.file, "book")
formulas:
  read_percentage: 'readingProgress'
  time_to_finish: 'if(readingProgress < 100, wordCount * (100 - readingProgress) / 100 / 250, 0)'
  read_status: 'if(readingProgress == 100, "Finished", if(readingProgress > 0, "In Progress", "Not Started"))'
  star_rating: 'if(rating == 5, "★★★★★", if(rating == 4, "★★★★☆", if(rating == 3, "★★★☆☆", if(rating == 2, "★★☆☆☆", if(rating == 1, "★☆☆☆☆", "Not rated")))))'
display:
  author: "Author"
  genre: "Genre"
  readingProgress: "Progress"
  formula.read_status: "Status"
  formula.time_to_finish: "Hours Left"
  formula.star_rating: "Rating"
views:
  - type: gallery
    name: "Book Collection"
    title_field: file.name
    description_field: summary
  - type: board
    name: "Reading Status"
    group_by: "formula.read_status"
    title_field: file.name
    description_field: summary
  - type: table
    name: "Reading List"
    filters: 'readingProgress < 100'
    order:
      - readingProgress
      - author
      - genre
  - type: table
    name: "Finished Books"
    filters: 'readingProgress == 100'
    order:
      - rating
      - author
      - genre
  - type: calendar
    name: "Reading Timeline"
    date_field: dateStarted
    title_field: file.name`,
  },
};
