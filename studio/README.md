# RuVector Studio

Visual development environment for RuVector - PostgreSQL vector database with advanced AI features.

## Features

- **Vector Index Management**: Visual interface for HNSW and IVFFlat indexes
- **Attention Mechanisms**: Configure and visualize multi-head attention layers
- **Graph Neural Networks**: Design and train GNN architectures
- **Hyperbolic Embeddings**: Work with Poincaré and Lorentz models
- **Learning Algorithms**: Interactive TF-IDF, BM25, and neural learning
- **Routing Systems**: Configure hybrid search and semantic routing
- **Database Explorer**: Browse tables, schemas, and vector data
- **SQL Editor**: Advanced SQL editor with autocomplete and syntax highlighting

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL with RuVector extension installed

### Installation

```bash
cd studio
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

### Testing

```bash
npm test              # Run tests
npm run test:ui       # Run tests with UI
npm run type-check    # Type checking
```

## Project Structure

```
studio/
├── src/
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   ├── layouts/         # Layout components
│   │   └── interfaces/      # Feature-specific interfaces
│   │       ├── VectorIndex/
│   │       ├── Attention/
│   │       ├── GNN/
│   │       ├── Hyperbolic/
│   │       ├── Learning/
│   │       ├── Routing/
│   │       ├── Database/
│   │       └── SQLEditor/
│   ├── lib/
│   │   ├── api/            # API client functions
│   │   ├── hooks/          # Custom React hooks
│   │   └── utils/          # Utility functions
│   ├── pages/              # Next.js pages
│   ├── styles/             # Global styles
│   └── types/              # TypeScript type definitions
└── public/                 # Static assets
```

## Technology Stack

- **Framework**: Next.js 14
- **UI**: React 18, Tailwind CSS, Radix UI
- **State Management**: TanStack Query
- **Visualization**: Recharts, ReactFlow, Cytoscape, D3
- **Code Editor**: Monaco Editor
- **Database**: PostgreSQL with pg client
- **Validation**: Zod
- **Testing**: Vitest, Testing Library

## Environment Variables

Create a `.env.local` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/ruvector
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## Contributing

See the main RuVector repository for contribution guidelines.

## License

See the main RuVector repository for license information.
