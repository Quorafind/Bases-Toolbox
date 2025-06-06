# Obsidian Bases Toolbox

A comprehensive toolbox for working with Obsidian Bases files, featuring:

1. **Bases Preview** - Preview and test your Obsidian Bases files
2. **Dataview Converter** - Convert Dataview TABLE queries to Bases format

## Features

### Bases Preview

- Preview how your .base file will look in Obsidian
- Test different view types: Table, Board, Gallery, Map, Calendar
- Drag and drop a .base file or edit YAML directly
- Try pre-built templates to get started quickly
- Generate random mock data to test your views

### Dataview Converter

- Convert existing Dataview TABLE queries to Bases YAML
- Supports most common Dataview features:
  - Fields with aliases
  - FROM source
  - WHERE conditions (AND, OR)
  - SORT with ASC/DESC directions
  - LIMIT and GROUP BY
- Copy converted YAML to create your .base files
 
## Usage

1. Clone this repository
2. Install dependencies with `npm install` or `pnpm install`
3. Run the development server with `npm run dev` or `pnpm dev`
4. Open your browser to the localhost URL displayed in the terminal

## Development

This application is built with:

- Svelte
- TypeScript
- Vite

## Building

To build for production:

```bash
npm run build
# or
pnpm build
```

The build files will be in the `dist` folder.

## License

MIT