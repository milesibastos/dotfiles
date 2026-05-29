# OpenCode Clipboard Fails Under Isolated macOS User

## Summary

OpenCode clipboard copy fails when running as the `woot` user inside tmux on macOS, even though tmux/Ghostty OSC52 clipboard writes work.

## Environment

- Shell user: `woot`
- macOS console user: `milesibastos`
- Terminal: Ghostty
- Multiplexer: tmux
- OpenCode: `1.15.10`

## Symptoms

This works:

```sh
printf test | tmux load-buffer -w -
```

This does not write to the GUI clipboard:

```sh
printf test | pbcopy
```

OpenCode copy actions also fail because OpenCode uses macOS AppleScript clipboard writes:

```sh
osascript -e 'set the clipboard to "..."'
```

## Root Cause

macOS pasteboard access is tied to the logged-in Aqua/GUI session. The OpenCode process runs as `woot`, while the GUI pasteboard belongs to `milesibastos`, so native clipboard writes through `pbcopy` or `osascript` do not affect the visible desktop clipboard.

tmux OSC52 works because Ghostty receives the escape sequence and writes to the GUI clipboard from the terminal side.

## Local Fix

Added shims:

- `bin/pbcopy`: routes stdin to `tmux load-buffer -w -` when inside tmux.
- `bin/osascript`: intercepts only `set the clipboard to ...` and routes that text to `tmux load-buffer -w -`; all other AppleScript calls fall back to `/usr/bin/osascript`.

Updated shell PATH ordering so user/dotfile shims precede `/usr/bin` in fish and zsh startup.

Also symlinked shims into `~/.opencode/bin` so existing OpenCode PATHs can resolve them before `/usr/bin`:

```sh
~/.opencode/bin/osascript -> /Users/woot/code/dotfiles/bin/osascript
~/.opencode/bin/pbcopy -> /Users/woot/code/dotfiles/bin/pbcopy
```

## Verification

```sh
PATH="/Users/woot/.opencode/bin:/usr/local/bin:/usr/bin:/bin" \
  osascript -e 'set the clipboard to "current opencode path fixed"'

tmux save-buffer -
# current opencode path fixed
```

## Follow-Up

Prefer an upstream OpenCode option to use OSC52/tmux for clipboard writes on macOS when `$TMUX` is set, instead of relying on command shims.
