# tmux Cheat Sheet

Quick reference for `config/tmux/tmux.conf`. Prefix is `C-a` (not `C-b`).

## Config layout

- `config/tmux/tmux.conf` — main config, symlinked to `~/.config/tmux/tmux.conf`
- `config/tmux/theme/theme.tmux` — status bar + colors (auto dark/light per macOS appearance)
- `config/tmux/theme/colors/{dark,light}.sh` — palette vars (`@thm_*`)
- `$TMUX_MINIMAL` env var → hide status bar until >1 window in session
- Reload: `prefix r` (sources `~/.config/tmux/tmux.conf`)

## Prefix and core

| Key | Action |
|-----|--------|
| `C-a` | Prefix (sent through with `C-a C-a` or `prefix a`) |
| `prefix r` | Reload config (shows "Config Reloaded!") |
| `prefix T` | Toggle status bar |

## Windows

| Key | Action |
|-----|--------|
| `prefix c` | New window, keep cwd |
| `prefix C-h` | Previous window (repeatable) |
| `prefix C-l` | Next window (repeatable) |
| `prefix =` | Tile layout |

Windows auto-renumber, start at index 1, and auto-rename via
`tmux-smart-name '<command>' '<path>'`.

## Panes

| Key | Action |
|-----|--------|
| `prefix \|` | Split horizontally (cwd kept) |
| `prefix -` | Split vertically (cwd kept) |
| `prefix h/j/k/l` | Move left/down/up/right |
| `prefix H/J/K/L` | Resize by 10 (repeatable) |
| Mouse | Enabled — click to focus, drag borders |

Pane index starts at 1. `aggressive-resize` on (resize per-window, not per-session).

## Copy mode (vi)

| Key | Action |
|-----|--------|
| `prefix Escape` | Enter copy mode |
| `v` | Begin selection |
| `prefix p` | Paste buffer |

`set-clipboard on` pushes yanks to system clipboard via OSC 52.

## Popups

| Key | Action |
|-----|--------|
| `prefix g` | lazygit responsive popup at current pane path |
| `prefix G` | lazydocker responsive popup at current pane path |
| `prefix u` | `ai-usagebar-tui` responsive popup |
| `prefix y` | yazi responsive popup at current pane path |
| `prefix s` | `tm` compact responsive session picker popup |
| `prefix n` | `claude-next` — jump to next waiting agent pane |

Full TUI popups use 80% of the client, capped at 240×60 cells. The compact
session picker uses 60%×70%, capped at 160×40. A dimension below 100 columns
or 30 rows uses 90% in that direction. `tmux-popup --print-size` shows the
calculated dimensions for the current client.

## Terminal & keys

- `default-terminal = $TERM` (inherit from outer terminal)
- Italics, undercurl, and undercurl colors via `terminal-overrides`
- `extended-keys on` + `csi-u` — distinguishes `Shift+Enter`, `Ctrl+Enter`, etc.
- `escape-time 0` — no delay on `Esc`
- `history-limit 20000`
- `focus-events on`, `set-titles on` (title = `#T - #W`)
- Activity monitoring off

## Status bar

Positioned at top, transparent background.

- **Left:** session name with powerline chevron (purple)
- **Right:** `agent-status` → current song (if any) → `tmux-git-status` for pane path
- Refreshes every 3 s
- Window names: dim when inactive, magenta bold when current; falls back to basename of `pane_current_path`

### Theme

`theme.tmux` runs at startup, reads `defaults read -g AppleInterfaceStyle`, and
sources `dark.sh` or `light.sh`. Colors exposed as tmux user options (`@thm_*`)
and consumed by the status line.

### Minimal mode

Set `TMUX_MINIMAL=1` before `tmux` to hide the status bar in single-window
sessions; hooks auto-toggle it on/off as windows are added/removed.

## Helper scripts (in `bin/`)

Referenced from `tmux.conf` / `theme.tmux`:

- `tm`, `tmux-popup` — session picker and responsive popup sizing
- `claude-dashboard`, `claude-next`, `claude-reconcile`, `agent-status`
- `tmux-smart-name`, `tmux-git-status`, `current-song`

`claude-reconcile` runs in the background on config load to clean stale agent
status files from previous tmux servers.
