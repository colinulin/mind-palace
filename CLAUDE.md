# Code Style
*   Use ES modules (`import`/`export`) syntax, not CommonJS (`require`).
*   Destructure imports when possible (e.g., `import { foo } from 'bar'`).
*   Always use `kebab-case` for URL paths and `camelCase` for JSON properties.
*   Use arrow functions instead of normal functions
*   Prefer to allow Typescript to infer types where possible instead of defining types
*   Avoid using type assertions ("as")
*   Prefer smaller files (under 300 lines) by breaking out files into multiple smaller utility files as needed
*   Prefer functional coding approaches over mutating. Use JS methods like reduce, map, and filter instead of for and .forEach to help with that.

# Workflow
*   Be sure to typecheck and lint when a series of code changes is done.
*   Prefer running single tests for performance, not the whole test suite initially.
*   Key commands:
    *   `npm test`: run all tests
    *   `npm run build`: build the project
    *   `npm start`: run the project locally