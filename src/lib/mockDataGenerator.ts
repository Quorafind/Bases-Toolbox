import { faker } from "@faker-js/faker";

export interface MockFile {
  file: {
    file: string;
    name: string;
    ctime: Date;
    mtime: Date;
    ext: string;
    size: number;
    folder: string;
    path: string;
  };
  [key: string]: any;
}

/**
 * Generate mock files with properties that might be found in Obsidian notes
 */
export function generateMockFiles(count: number = 100): MockFile[] {
  return Array.from({ length: count }, (_, i) => generateMockFile(i));
}

/**
 * Generate a single mock file with properties
 */
function generateMockFile(index: number): MockFile {
  // Common file statuses in task management
  const statuses = ["TODO", "In Progress", "Done", "Backlog", "Waiting"];

  // Only use markdown files
  const ext = ".md";

  // Random tags that might be used in notes
  const possibleTags = [
    "book",
    "article",
    "blog",
    "research",
    "project",
    "idea",
    "meeting",
    "review",
    "personal",
    "work",
    "study",
    "reference",
    "tag",
    "important",
    "urgent",
    "later",
    "textbook",
  ];

  // Random list of tags
  const tags = Array.from(
    { length: Math.floor(Math.random() * 5) },
    () => possibleTags[Math.floor(Math.random() * possibleTags.length)]
  );

  // Base file properties
  const fileName = faker.system.fileName().replace(/\.[^/.]+$/, "") + ".md";

  return {
    file: {
      file: `file_${index}`, // Placeholder for file object
      name: fileName,
      ctime: faker.date.past(),
      mtime: faker.date.recent(),
      ext,
      size: faker.number.int({ min: 1024, max: 1024 * 1024 * 10 }),
      folder: faker.system.directoryPath(),
      path: faker.system.filePath().replace(/\.[^/.]+$/, ext),
    },
    status: statuses[Math.floor(Math.random() * statuses.length)],
    priority: faker.number.int({ min: 1, max: 5 }),
    tags,
    price: faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
    age: faker.number.int({ min: 1, max: 100 }),
    has_coords: Math.random() > 0.7,
    lat: faker.location.latitude(),
    long: faker.location.longitude(),
    author: faker.person.fullName(),
    created: faker.date.past(),
    summary: faker.lorem.paragraph(),
    wordCount: faker.number.int({ min: 100, max: 10000 }),
    category: ["Reference", "Project", "Daily Note", "Meeting"][
      Math.floor(Math.random() * 4)
    ],
  };
}

/**
 * Generate book data for reading list and completed books
 */
function generateBookData(count: number): MockFile[] {
  const bookStatuses = ["TODO", "In Progress", "Done"];
  const bookGenres = [
    "Fiction",
    "Non-Fiction",
    "Science Fiction",
    "Fantasy",
    "Biography",
    "History",
    "Self-Help",
    "Business",
    "Technology",
  ];

  return Array.from({ length: count }, (_, i): MockFile => {
    const status =
      bookStatuses[Math.floor(Math.random() * bookStatuses.length)];
    const genre = bookGenres[Math.floor(Math.random() * bookGenres.length)];
    const wordCount = faker.number.int({ min: 20000, max: 150000 });
    const readingProgress =
      status === "Done" ? 100 : Math.floor(Math.random() * 100);

    return {
      file: {
        file: `book_${i}`,
        name: `${faker.word.adjective()} ${faker.word.noun()} - ${faker.person.lastName()}`,
        ctime: faker.date.past(),
        mtime: faker.date.recent(),
        ext: ".md",
        size: faker.number.int({ min: 5000, max: 15000 }),
        folder: "/Reading/Books",
        path: `/Reading/Books/book_${i}.md`,
      },
      status,
      priority: faker.number.int({ min: 1, max: 5 }),
      tags: [
        "book",
        genre.toLowerCase(),
        ...(Math.random() > 0.5 ? ["favorite"] : []),
      ],
      author: faker.person.fullName(),
      created: faker.date.past(),
      summary: faker.lorem.paragraph(),
      wordCount,
      category: "Reference",
      isbn: faker.string.numeric(13),
      genre,
      publicationYear: faker.number.int({ min: 1950, max: 2023 }),
      publisher: faker.company.name(),
      readingProgress,
      rating: status === "Done" ? faker.number.int({ min: 1, max: 5 }) : null,
      dateStarted: faker.date.past(),
      dateFinished: status === "Done" ? faker.date.recent() : null,
    };
  });
}

/**
 * Generate a specific number of files with known properties for specific demonstrations
 */
export function generateDemoFiles(): MockFile[] {
  const baseFiles = generateMockFiles(15);
  const bookFiles = generateBookData(15);

  // Add specific files with properties for demonstrating filters
  const specialFiles = [
    {
      file: {
        file: "special_1",
        name: "1984 by George Orwell",
        ctime: new Date("2023-01-15"),
        mtime: new Date("2023-03-20"),
        ext: ".md",
        size: 15460,
        folder: "/Reading/Books",
        path: "/Reading/Books/1984.md",
      },
      status: "Done",
      priority: 5,
      tags: ["book", "fiction", "classic", "dystopian"],
      author: "George Orwell",
      created: new Date("2023-01-15"),
      summary:
        "Classic dystopian novel about a society under totalitarian rule",
      wordCount: 88000,
      category: "Reference",
      isbn: "9780451524935",
      genre: "Fiction",
      publicationYear: 1949,
      publisher: "Penguin Books",
      readingProgress: 100,
      rating: 5,
      dateStarted: new Date("2023-01-20"),
      dateFinished: new Date("2023-02-15"),
    },
    {
      file: {
        file: "special_2",
        name: "The Hobbit by J.R.R. Tolkien",
        ctime: new Date("2023-04-10"),
        mtime: new Date("2023-05-10"),
        ext: ".md",
        size: 12240,
        folder: "/Reading/Books",
        path: "/Reading/Books/The_Hobbit.md",
      },
      status: "In Progress",
      priority: 4,
      tags: ["book", "fiction", "fantasy"],
      author: "J.R.R. Tolkien",
      created: new Date("2023-04-10"),
      summary:
        "Fantasy novel about Bilbo Baggins' adventure with dwarves to reclaim their treasure",
      wordCount: 95000,
      category: "Reference",
      isbn: "9780547928227",
      genre: "Fantasy",
      publicationYear: 1937,
      publisher: "Houghton Mifflin",
      readingProgress: 65,
      rating: null,
      dateStarted: new Date("2023-04-15"),
      dateFinished: null,
    },
    {
      file: {
        file: "special_3",
        name: "Project Alpha Planning",
        ctime: new Date("2023-05-10"),
        mtime: new Date("2023-05-10"),
        ext: ".md",
        size: 8240,
        folder: "/Projects/Alpha",
        path: "/Projects/Alpha/Planning.md",
      },
      status: "In Progress",
      priority: 4,
      tags: ["project", "planning", "important"],
      price: 0,
      age: 2,
      has_coords: true,
      lat: 40.7128,
      long: -74.006,
      author: "Team Lead",
      created: new Date("2023-05-10"),
      summary: "Project planning document for Alpha",
      wordCount: 4500,
      category: "Project",
    },
    {
      file: {
        file: "special_4",
        name: "Meeting Notes - Research Review",
        ctime: new Date("2023-06-22"),
        mtime: new Date("2023-06-22"),
        ext: ".md",
        size: 5130,
        folder: "/Meetings",
        path: "/Meetings/Research_Review.md",
      },
      status: "Done",
      priority: 3,
      tags: ["meeting", "research", "notes"],
      price: 0,
      age: 1,
      has_coords: true,
      lat: 37.7749,
      long: -122.4194,
      author: "Meeting Scribe",
      created: new Date("2023-06-22"),
      summary: "Notes from the research review meeting",
      wordCount: 2200,
      category: "Meeting",
    },
  ];

  return [...specialFiles, ...bookFiles, ...baseFiles];
}
