---
name: graphify
description: Convert any input (text, notes, files, URLs) into a knowledge graph using the graphify CLI. Use when the user types /graphify or asks to turn content into a knowledge graph.
---

# graphify

Turn the given input into a knowledge graph with the `graphify` CLI.

The PyPI package is `graphifyy` (double y); the binaries it installs are `graphify` and `graphify-mcp`.

## Steps

1. Check the tool is available: `command -v graphify`. If missing, install it via mise (`mise install` — it is declared as `pipx:graphifyy` in `config/mise/config.toml`).
2. Run `graphify --help` to confirm current flags before first use — do not guess options.
3. Pass the user's input (text, file path, or URL) to `graphify` per its help output.
4. Report where the resulting graph was written.
