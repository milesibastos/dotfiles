# Neovim Cheat Sheet

Quick reference for the `nisi` Neovim config in `config/nvim/`.
Leader key is `,`. `jk` exits insert mode.

## Config layout

- `init.lua` — entry point, calls `nisi.setup()`
- `lua/nisi/init.lua` — core config + lazy.nvim loader
- `lua/nisi/config/{options,keymaps,filetype}.lua` — core options/maps
- `lua/nisi/plugins/*.lua` — plugin specs (auto-imported)
- `lua/nisi/plugins/extras/{copilot,fzf,python}.lua` — opt-in via `setup({...})`
- `plugin/*.vim` — legacy vimscript (zoom, WinMove, HiInterestingWord, numbers)
- `lazy-lock.json` — plugin version lockfile

## Core keymaps (leader = `,`)

### Files & buffers

| Key | Action |
|-----|--------|
| `,,` | Save file (silent) |
| `C-s` / `D-s` | Save file (any mode) |
| `,.` | Jump to last buffer |
| `,r` / `,fb` | Telescope buffers |
| `,t` | Find files (git-aware when in repo, hidden incl.) |
| `D-p` | Git files picker |
| `,ff` | Telescope find_files |
| `,fg` | Live grep |
| `,fr` | Live grep (raw args) |
| `,fo` | Recent files |
| `,fs` | Git files |
| `,fh` | Help tags |
| `,fn` | node_modules list |
| `,k` | Toggle neo-tree (right, 40 cols) |
| `-` | Open parent dir in Oil |
| `,bd` | Delete buffer (snacks) |
| `,cR` | Rename current file (snacks) |
| `gTT` | Open buffer in new tab |

### Editing

| Key | Action |
|-----|--------|
| `jk` (insert) | Exit insert mode |
| `<space>` | Toggle search highlight |
| `,l` | Toggle invisible chars |
| `,i` | Toggle cursorline |
| `\t` / `\s` | Switch to tabs / spaces (width 4) |
| `<` / `>` (visual) | Indent and keep selection |
| `.` (visual) | Repeat last command on selection |
| `Up`/`Down` (n) | Move line up/down |
| `Up`/`Down`, `J`/`K` (v) | Move selection up/down |
| `M-S-h/j/k/l` | mini.move directional move |
| `$(` `$[` `${` `$'` `$"` `$<` `$\` (v) | Wrap selection |
| `saiw)` | mini.surround add `)` around word |
| `sd'` | Delete surrounding `'` |
| `sr)'` | Replace `)` with `'` |
| `gS` / `gJ` | mini.splitjoin split / join |
| `C-a` / `C-x` | boole.nvim increment/decrement toggles |
| `,y` (v) | Copy + normalize whitespace |

### Navigation & windows

| Key | Action |
|-----|--------|
| `C-h/j/k/l` | Move window (creates split if at edge) |
| `,z` | Zoom pane to tab, toggle back |
| `,Z` | snacks zoom |
| `C-e` / `C-y` | Scroll 3 lines down/up |
| `j`/`k` | Wrap-aware moves (count-preserving) |
| `^`/`$` | Wrap-aware line start/end |
| `[q` / `]q` | Prev/next quickfix |
| `]]` / `[[` | Next/prev reference (snacks.words) |

### Interesting words

`,1` … `,6` highlight word under cursor in distinct colors. `,0` clears.

## LSP (buffer-local on attach)

| Key | Action |
|-----|--------|
| `gd` | Definition |
| `gD` | Declaration |
| `go` / `gy` | Type definition |
| `gr` | Rename |
| `gR` | References |
| `gO` | Organize imports (`:OR` cmd) |
| `ga` | Code action (n, v) |
| `K` | Hover |
| `S` / `C-x C-x` | Signature help |
| `,hh` | Toggle inlay hints |
| `,aa` | Show diagnostics (float) |
| `,aq` | Diagnostics to loclist |
| `[d` / `]d` | Prev/next diagnostic |
| `RightMouse` | Context menu |

Servers (via mason-lspconfig): eslint, elixirls, ts_ls, lua_ls, denols,
astro, gopls, intelephense, tailwindcss, jsonls, ruby_lsp, pylsp, vimls.

## Formatting (conform.nvim, format-on-save)

`stop_after_first = true`, 2s timeout, no LSP fallback.

- JS/TS/MD/Astro/JSON/HTML/YAML → `prettier` → `vpfmt` → `oxfmt`
- CSS → `stylelint` → `prettier` → `vpfmt` → `oxfmt`
- Shell → `shellcheck`, `shfmt` · Lua → `stylua` · Go → `gofmt`
- Python → `black`, `isort` · Ruby → `rubocop` · PHP → `pint`

## Completion (blink.cmp)

| Key (insert) | Action |
|--------------|--------|
| `C-j` / `C-k` | Next / prev item |
| `CR` / `Tab` | Accept |
| `C-y` | Select and accept |
| `C-space` | Show / toggle docs |
| `Esc` | Cancel menu (fallback if hidden) |

Sources: `lsp`, `copilot` (via blink-copilot), `snippets`, `path`, `buffer`.

## Git

| Key | Action |
|-----|--------|
| `,gg` | Lazygit |
| `,gl` | Lazygit log (cwd) |
| `,gf` | Lazygit file history |
| `,gB` | Git browse (open on remote) |
| `,gc` / `,gs` | Telescope commits / status |
| `,gr` | `:Gread` (checkout file) |
| `,gb` | `:G blame` |
| `]c` / `[c` | Next / prev hunk |
| `,hs` / `,hr` | Stage / reset hunk (n, v) |
| `,hS` / `,hR` | Stage / reset buffer |
| `,hu` | Undo stage hunk |
| `,hp` | Preview hunk |
| `,hb` | Blame line (full) |
| `,hd` / `,hD` | Diff this / vs. `~` |
| `,tb` / `,td` | Toggle line blame / deleted |
| `ih` (o, x) | Select hunk text object |

Conflicts handled by `git-conflict.nvim`.

## Search & replace (spectre)

| Key | Action |
|-----|--------|
| `,sr` / `,ss` | Open spectre |
| `,sw` | Spectre on word |
| `,sp` | Spectre file search |

## Trouble (diagnostics UI)

| Key | Action |
|-----|--------|
| `,xx` | Diagnostics |
| `,xX` | Buffer diagnostics |
| `,cs` | Symbols |
| `,cl` | LSP refs/defs (right) |
| `,xL` / `,xQ` | Location / quickfix list |

## Snacks toggles (`,u*`)

`,us` spell · `,uw` wrap · `,ul` line nums · `,uL` relative nums ·
`,ud` diagnostics · `,uc` conceal · `,uT` treesitter · `,ub` light/dark
bg · `,uh` inlay hints · `,ug` indent guides · `,uD` dim · `,un` dismiss
notifications · `,n` notification history.

Other snacks: `,/` scratch · `,S` select scratch · `C-/` terminal · `,N` neovim news.

## Setup flags (`nisi.setup({...})` in `init.lua`)

| Flag | Default | Effect |
|------|---------|--------|
| `copilot` | `true` | Loads `extras/copilot.lua` |
| `python` | `false` | Loads `extras/python.lua` |
| `fzf` | `true` | Loads `extras/fzf.lua` |
| `transparent` | `false` | Transparent background |
| `zen` | `false` | Minimal UI |
| `colorscheme` | tokyonight (auto dark/light) | Override |
| `prefer_git` | `false` | Git over curl for deps |
| `proxy` | `nil` | Sets `http(s)_proxy` env |
| `snippets_dir` | `nil` | Load snippets from path |
| `startup_art` / `startup_color` | `nicknisi` / `#653CAD` | Dashboard |

Current `init.lua` sets `python = true` and `transparent = true`.

## Defaults worth knowing

- `shiftwidth` / `tabstop` / `softtabstop` = 2, `expandtab`
- `textwidth` 120, soft wrap on, `showbreak = ↪`
- `scrolloff` 7, `sidescrolloff` 8, `laststatus` 3 (global)
- `cmdheight` 0 (1 inside vscode), `signcolumn` always on
- `clipboard = unnamedplus` (skipped over SSH)
- `undofile` on · no swap/backup files
- Folding: treesitter expr, disabled by default (`foldenable = false`)
- Grep: ripgrep when available, quickfix auto-opens on `:grep`
- Diagnostics: virtual text + virtual lines (current line), severity-sorted
- Yank highlight on `TextYankPost`
