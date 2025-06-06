/**
 * Lazy-loaded mock data generator to reduce initial bundle size
 */

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
    tags: string[];
    links: string[];
  };
  status: string;
  priority: number;
  tags: string[];
  price: number;
  age: number;
  has_coords: boolean;
  lat: number;
  long: number;
  author: string;
  created: Date;
  summary: string;
  wordCount: number;
  category: string;
  [key: string]: any;
}

let fakerInstance: any = null;

async function getFaker() {
  if (!fakerInstance) {
    const { faker } = await import('@faker-js/faker');
    fakerInstance = faker;
  }
  return fakerInstance;
}

/**
 * Generate mock files with realistic data using Faker.js
 */
export async function generateMockFiles(count: number = 20): Promise<MockFile[]> {
  const faker = await getFaker();
  
  const statuses = ["Todo", "In Progress", "Done", "Cancelled"];
  const extensions = [".md", ".txt", ".pdf", ".docx"];

  return Array.from({ length: count }, (_, index): MockFile => {
    const ext = extensions[Math.floor(Math.random() * extensions.length)];
    const tags = Array.from(
      { length: Math.floor(Math.random() * 4) + 1 },
      () => faker.lorem.word()
    );

    // Random links
    const possibleLinks = ["Home", "Projects", "Books", "Reading", "Textbook"];
    const links = Array.from(
      { length: Math.floor(Math.random() * 3) },
      () => possibleLinks[Math.floor(Math.random() * possibleLinks.length)]
    );

    // Base file properties
    const fileName = faker.system.fileName().replace(/\.[^/.]+$/, "") + ".md";

    return {
      file: {
        file: `file_${index}`,
        name: fileName,
        ctime: faker.date.past(),
        mtime: faker.date.recent(),
        ext,
        size: faker.number.int({ min: 1024, max: 1024 * 1024 * 10 }),
        folder: faker.system.directoryPath(),
        path: faker.system.filePath().replace(/\.[^/.]+$/, ext),
        tags,
        links,
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
  });
}

/**
 * Generate book-specific mock data
 */
export async function generateBookData(count: number = 10): Promise<MockFile[]> {
  const faker = await getFaker();
  
  const bookStatuses = ["Todo", "In Progress", "Done"];
  const bookGenres = ["Fiction", "Non-Fiction", "Biography", "History", "Science", "Technology"];

  return Array.from({ length: count }, (_, i): MockFile => {
    const status = bookStatuses[Math.floor(Math.random() * bookStatuses.length)];
    const genre = bookGenres[Math.floor(Math.random() * bookGenres.length)];
    const wordCount = faker.number.int({ min: 20000, max: 150000 });
    const readingProgress = status === "Done" ? 100 : Math.floor(Math.random() * 100);

    const tags = [
      "book",
      genre.toLowerCase(),
      ...(Math.random() > 0.5 ? ["favorite"] : []),
    ];

    // Some books should link to Textbook for our filter to work
    const links = ["Books", "Reading"];
    if (Math.random() > 0.5) {
      links.push("Textbook");
    }

    return {
      file: {
        file: `book_${i}`,
        name: faker.lorem.words(3) + ".md",
        ctime: faker.date.past(),
        mtime: faker.date.recent(),
        ext: ".md",
        size: faker.number.int({ min: 5000, max: 50000 }),
        folder: "/Books",
        path: `/Books/${faker.lorem.words(3)}.md`,
        tags,
        links,
      },
      status,
      priority: faker.number.int({ min: 1, max: 5 }),
      tags,
      price: faker.number.float({ min: 10, max: 50, fractionDigits: 2 }),
      age: faker.number.int({ min: 1, max: 10 }),
      has_coords: false,
      lat: 0,
      long: 0,
      author: faker.person.fullName(),
      created: faker.date.past(),
      summary: faker.lorem.paragraph(),
      wordCount,
      category: "Book",
      genre,
      readingProgress,
      rating: faker.number.int({ min: 1, max: 5 }),
      dateStarted: faker.date.past(),
    };
  });
}

/**
 * Generate a specific number of files with known properties for demonstrations
 */
export async function generateDemoFiles(): Promise<MockFile[]> {
  const baseFiles = await generateMockFiles(15);
  const bookFiles = await generateBookData(15);

  return [...baseFiles, ...bookFiles];
}
