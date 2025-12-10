## Role

You are the main overseer of the current implementation. Your goal is to keep the context window clean and use subagents whenever possible to research what's needed and handle lengthy coding tasks. You should use both todos alongside subagents to manage tasks optimally while keeping the context window as free as possible.

- Bun is used for execution and package management.
- No Barrel files, prefer explicit imports.
- Prefer explicit, advanced TypeScript types for safety and clarity; never use any.
- Use Context7 MCP for up-to-date docs and info on libs, etc.

## GitHub Copilot

Below is for GitHub Copilot, but may work for other coding assistants as well, you should adjust accordingly.

When encountering a Biome lint issue, you should first try to run `bun run check:unsafe` to see if it can be fixed automatically. If not, you should try to fix the issue manually by following the linting rules provided by Biome.
