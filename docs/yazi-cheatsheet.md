# Yazi Cheat Sheet

Quick reference for `config/yazi/yazi.toml`, symlinked to
`~/.config/yazi/yazi.toml`. This repo only customizes the manager pane ratio;
keybindings below are Yazi defaults for 26.1.22.

## Config layout

- `config/yazi/yazi.toml` — main config
- `[mgr] ratio = [1, 2, 4]` — parent : file list : preview pane widths
- No tracked `keymap.toml`, `theme.toml`, `vfs.toml`, `init.lua`, or plugins
- Link with `bin/dot link yazi` or all packages with `bin/dot link`

## Launch and help

| Command / Key | Action |
|---------------|--------|
| `yazi [path]` | Open Yazi, optionally at `path` |
| `q` | Quit and write cwd if launched with `--cwd-file` |
| `Q` | Quit without writing `--cwd-file` |
| `C-c` | Close current tab, or quit if it is the last tab |
| `C-z` | Suspend; resume with shell `fg` |
| `~` / `F1` | Open help menu |
| `yazi --debug` | Print detected config, terminal, and preview environment |
| `yazi --clear-cache` | Clear Yazi cache |

Useful CLI flags:

- `--cwd-file <file>` — write final cwd on exit, for shell wrappers that `cd`
- `--chooser-file <file>` — write selected files when an open action fires
- `--local-events <events>` / `--remote-events <events>` — stream DDS events

## Navigation

| Key | Action |
|-----|--------|
| `j` / `k` | Next / previous file |
| `h` / `l` | Parent directory / enter hovered directory |
| Arrow keys | Same as `h/j/k/l` |
| `H` / `L` | Back / forward in directory history |
| `C-u` / `C-d` | Half page up / down |
| `C-b` / `C-f` | Page up / down |
| `gg` / `G` | Top / bottom |
| `K` / `J` | Scroll preview up / down 5 units |
| `g h` | Go home |
| `g c` | Go `~/.config` |
| `g d` | Go `~/Downloads` |
| `g Space` | Jump to a path interactively |
| `g f` | Follow hovered symlink |
| `z` | Jump via fzf |
| `Z` | Jump to directory via zoxide |

## Selection

| Key | Action |
|-----|--------|
| `Space` | Toggle hovered item and move down |
| `v` | Visual selection mode |
| `V` | Visual unset mode |
| `C-a` | Select all files in current directory |
| `C-r` | Invert selection in current directory |
| `Esc` | Exit visual mode, clear selection, or cancel search/filter |

## File operations

| Key | Action |
|-----|--------|
| `Enter` / `o` | Open selected files |
| `Shift-Enter` / `O` | Open selected files interactively |
| `Tab` | Spot hovered file info |
| `y` | Yank selected files (copy) |
| `x` | Yank selected files (cut) |
| `p` | Paste yanked files |
| `P` | Paste and overwrite destination conflicts |
| `Y` / `X` | Cancel yank status |
| `d` | Trash selected files |
| `D` | Permanently delete selected files |
| `a` | Create file; end with `/` for a directory |
| `r` | Rename selected file(s); bulk rename uses `$EDITOR` |
| `.` | Toggle hidden files |
| `-` | Symlink yanked files with absolute paths |
| `_` | Symlink yanked files with relative paths |
| `C--` | Hardlink yanked files |

## Copy paths

| Key | Action |
|-----|--------|
| `c c` | Copy file path |
| `c d` | Copy directory path |
| `c f` | Copy filename |
| `c n` | Copy filename without extension |

## Search and filter

| Key | Action |
|-----|--------|
| `f` | Filter files in the current directory |
| `/` | Find next file in current directory |
| `?` | Find previous file in current directory |
| `n` / `N` | Next / previous find match |
| `s` | Search by filename via `fd` |
| `S` | Search by content via `rg` |
| `C-s` | Cancel ongoing search |

## Sorting and line mode

Sorting keys start with `,`.

| Key | Action |
|-----|--------|
| `,m` / `,M` | Sort by modified time / reverse |
| `,b` / `,B` | Sort by birth time / reverse |
| `,e` / `,E` | Sort by extension / reverse |
| `,a` / `,A` | Sort alphabetically / reverse |
| `,n` / `,N` | Sort naturally / reverse |
| `,s` / `,S` | Sort by size / reverse |
| `,r` | Sort randomly |

Line mode keys start with `m`.

| Key | Action |
|-----|--------|
| `m s` | Show size |
| `m p` | Show permissions |
| `m b` | Show birth time |
| `m m` | Show modified time |
| `m o` | Show owner |
| `m n` | No line mode |

## Shell commands

| Key | Action |
|-----|--------|
| `;` | Run shell command interactively |
| `:` | Run shell command interactively and block until finished |

Command templates can use `%h` for hovered path, `%s` for selected paths, `%d`
for selected parent directories, and uppercase variants (`%H`, `%S`, `%D`) for
URLs.

## Tabs and tasks

| Key | Action |
|-----|--------|
| `t` | New tab at current directory |
| `1`...`9` | Switch to tab N |
| `[` / `]` | Previous / next tab |
| `{` / `}` | Swap current tab left / right |
| `C-c` | Close current tab, or quit if it is the last tab |
| `w` | Show task manager |

Task manager keys:

| Key | Action |
|-----|--------|
| `j` / `k` | Next / previous task |
| `Enter` | Inspect task log |
| `x` | Cancel task |
| `w` / `Esc` / `C-c` | Close task manager |

## Prompts and popups

Most Yazi popups use vi-style movement plus obvious submit/cancel keys.

| Context | Keys |
|---------|------|
| Confirm dialog | `y` / `Enter` submits, `n` / `Esc` cancels |
| Pick menu | `j/k` or arrows to move, `Enter` submits, `Esc` cancels |
| Input prompt normal mode | `i/a/v`, `h/l`, `b/w/e`, `0/$`, `d/y/p`, `u/C-r` |
| Input prompt insert mode | `Enter` submits, `Esc` returns normal/cancels, `C-c` cancels |
| Completion menu | `Tab` submits completion, `Enter` completes and submits input |
| Help menu | `j/k` move, `f` filters help items, `Esc` clears filter or closes |

## Customizing keymaps

Add `config/yazi/keymap.toml` only when defaults need overriding.

```toml
[[mgr.prepend_keymap]]
on = [ "g", "p" ]
run = "cd ~/Pictures"
desc = "Go ~/Pictures"
```

Use `prepend_keymap` to override defaults, `append_keymap` for fallback keys,
or `keymap` to replace a layer completely.
