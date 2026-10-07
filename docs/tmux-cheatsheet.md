# tmux Cheat Sheet

Practical reference for this repository's tmux configuration.

Notation:

- `C-a` means hold Ctrl and press a.
- `prefix x` means press `C-a`, release it, then press x.
- The configured prefix is `C-a`, not the tmux default `C-b`.

## Start and connect

| Command | Action |
|---------|--------|
| `tmux` | Start tmux or create an unnamed session |
| `tmux new -s work` | Create a session named work |
| `tmux ls` | List sessions |
| `tmux attach` | Attach to the most recent session |
| `tmux attach -t work` | Attach to session work |
| `tmux kill-session -t work` | Kill session work |
| `tmux kill-server` | Kill all sessions and the tmux server |

Inside tmux, `prefix d` detaches without stopping programs. Reattach later with
`tmux attach`.

## Sessions

| Key | Action |
|-----|--------|
| `prefix s` | Open the custom session picker |
| `prefix d` | Detach from the current session |
| `prefix $` | Rename the current session |
| `prefix (` | Switch to the previous session |
| `prefix )` | Switch to the next session |
| `prefix L` | Switch to the last session |

## Windows

A window is similar to a terminal tab. Window numbering starts at 1.

| Key | Action |
|-----|--------|
| `prefix c` | Create a window in the current directory |
| `prefix C-h` | Select previous window; repeatable |
| `prefix C-l` | Select next window; repeatable |
| `prefix 1` through `prefix 9` | Select window by number |
| `prefix n` | Jump to the next waiting agent pane |
| `prefix w` | Choose a window interactively |
| `prefix ,` | Rename the current window |
| `prefix &` | Kill the current window after confirmation |
| `prefix =` | Arrange all panes in a tiled layout |

Windows are automatically renumbered and named from the active command or
directory unless explicitly renamed.

## Panes

A pane is a terminal region inside a window. Pane numbering starts at 1.

| Key | Action |
|-----|--------|
| `prefix |` | Split left and right; keep current directory |
| `prefix -` | Split top and bottom; keep current directory |
| `prefix h` | Focus pane to the left |
| `prefix j` | Focus pane below |
| `prefix k` | Focus pane above |
| `prefix l` | Focus pane to the right |
| `prefix H/J/K/L` | Resize by 10 cells; repeatable |
| `prefix q` | Display pane numbers; press a number to select |
| `prefix o` | Select the next pane |
| `prefix ;` | Return to the previously active pane |
| `prefix z` | Toggle pane zoom |
| `prefix x` | Kill the active pane after confirmation |
| `prefix !` | Move the active pane into a new window |
| `prefix Space` | Cycle pane layouts |
| `prefix {` / `prefix }` | Swap pane backward / forward |
| Mouse click | Focus a pane or window |
| Mouse drag | Resize pane borders |

`prefix Z` marks the current pane, switches to a 50 percent main-vertical
layout, and moves the marked pane to the main position. This is different from
the default lowercase `prefix z` zoom action.

## Scroll and copy

Copy mode uses vi keys.

| Key | Action |
|-----|--------|
| `prefix Escape` | Enter copy mode and scrollback |
| `h/j/k/l` | Move the cursor in copy mode |
| `C-u` / `C-d` | Move half a page up / down |
| `C-b` / `C-f` | Move one page up / down |
| `g` / `G` | Move to top / bottom of history |
| `/` / `?` | Search forward / backward |
| `n` / `N` | Select next / previous search match |
| `v` | Start a selection |
| `y` | Copy selection and leave copy mode |
| `Escape` | Cancel selection or leave copy mode |
| `prefix p` | Paste the tmux buffer |
| Mouse wheel | Scroll through history |

Copied text is also sent to the system clipboard when the terminal supports
OSC 52. Scrollback stores up to 20,000 lines per pane.

## Custom popups

| Key | Action |
|-----|--------|
| `prefix g` | Open lazygit in the current directory |
| `prefix G` | Open lazydocker in the current directory |
| `prefix u` | Open ai-usagebar-tui |
| `prefix y` | Open Yazi in the current directory |
| `prefix s` | Open the custom session picker |

## Config and status

| Key or command | Action |
|----------------|--------|
| `prefix r` | Reload `~/.config/tmux/tmux.conf` |
| `prefix T` | Toggle the status bar |
| `prefix ?` | Show every active key binding |
| `tmux show-options -g` | Show global server options |
| `tmux list-keys` | Print all key bindings |
| `tmux info` | Print terminal capability information |

Set `TMUX_MINIMAL=1` before starting tmux to hide the status bar while a
session has only one window.

## Common workflows

Create a named workspace:

```sh
tmux new -s project
```

Leave it running:

```text
prefix d
```

Resume it later:

```sh
tmux attach -t project
```

Create a coding layout:

```text
prefix |    split editor and shell side by side
prefix -    split the active pane top and bottom
prefix h/j/k/l
             move between panes
prefix H/J/K/L
             resize the active pane
```

Recover when the prefix appears unresponsive:

```text
1. Press C-a once.
2. Press ? to confirm tmux is receiving commands.
3. Press prefix r to reload the configuration.
```
