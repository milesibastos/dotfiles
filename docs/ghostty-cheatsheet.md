# Ghostty Cheat Sheet

Quick reference for `config/ghostty/config`, symlinked to
`~/.config/ghostty/config`.

## Config layout

- `config/ghostty/config` — main config
- `config/ghostty/shaders/` — GLSL shaders (cursor effects, CRT, bloom, etc.), not loaded by default
- Last line: `config-file = ?./overrides` — optional local `overrides` file next to `config` (ignored if missing)
- Reload after edit: `cmd+shift+,` (Ghostty's built-in reload) — or quit and relaunch

## Appearance

- Theme: `TokyoNight Night` (dark) / `TokyoNight Day` (light), switches with system
- `background-opacity = 0.85`, `background-blur-radius = 30`
- `bold-is-bright = true`
- `cursor-invert-fg-bg = true`, `cursor-style = block`
- `window-colorspace = display-p3`
- `adjust-cell-height = 10%`, `adjust-underline-position = 4`
- `mouse-hide-while-typing = true`

## Window

- `macos-titlebar-style = hidden`
- `window-decoration = true`, `window-theme = auto`
- `window-padding-{x,y} = 0`, `window-padding-color = background`, `window-padding-balance = false`
- `confirm-close-surface = false` — no prompt when closing a split/tab

## Font

- `Monaspace Neon Regular` @ 16pt
- Italic: `Monaspace Radon Var Regular Italic`
- Bold italic: `Monaspace Radon Var Bold Italic`
- `font-feature = +liga` (ligatures on)

## Clipboard

- `clipboard-read = allow`, `clipboard-write = allow`
- `clipboard-trim-trailing-spaces = true`
- `copy-on-select = clipboard`

Image paste requires running as the logged-in GUI user — it won't work under
`su - other_user` (macOS pasteboard is scoped per-Aqua-session).

## Shell integration

`shell-integration-features = cursor,sudo,no-title`

- `cursor` — shape changes per mode (from shell integration)
- `sudo` — forwards terminfo so `sudo` keeps Ghostty features
- `no-title` — shell doesn't set the window title

(The config line appears twice; the last one wins — `no-cursor,sudo` is overridden.)

## Keybindings — splits & tabs

Prefix is `cmd+s` (chord). Modeled after tmux.

### Splits

| Keys | Action |
|------|--------|
| `cmd+s` `\` | New split right |
| `cmd+s` `-` | New split down |
| `cmd+s` `h/j/k/l` | Focus split left/down/up/right |
| `cmd+s` `z` | Toggle split zoom |
| `cmd+s` `e` | Equalize splits |

### Tabs

| Keys | Action |
|------|--------|
| `cmd+s` `c` | New tab |
| `cmd+s` `shift+l` | Next tab |
| `cmd+s` `shift+h` | Previous tab |
| `cmd+s` `,` | Move tab left |
| `cmd+s` `.` | Move tab right |
| `cmd+s` `1`…`9` | Go to tab N |

## Local overrides

Create `config/ghostty/overrides` (same dir as `config`) to layer machine- or
experiment-specific settings without editing the tracked file. Example:

```
background-opacity = 1.0
font-size = 14
# custom-shader = shaders/cursor_smear.glsl
```

## Shaders

Drop in via `custom-shader = <path>` (absolute or relative to config dir).
Bundled in `config/ghostty/shaders/`: CRT (`crt.glsl`, `bettercrt.glsl`,
`retro-terminal.glsl`, `tft.glsl`), bloom variants (`bloom025.glsl` …
`bloom1.glsl`), cursor effects (`cursor_blaze.glsl`, `cursor_smear*.glsl`),
ambient (`starfield*.glsl`, `matrix-hallway.glsl`, `just-snow.glsl`,
`underwater.glsl`, `water.glsl`, `fireworks*.glsl`, `drunkard.glsl`,
`spotlight.glsl`, `gears-and-belts.glsl`, `cubes.glsl`), and debug
(`debug_cursor_*.glsl`).
