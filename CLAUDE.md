# Dotfiles

Personal dotfiles (fork of nicknisi/dotfiles). Manages configs for fish, zsh, neovim, tmux, ghostty, git, and Claude Code.

## Structure

- `home/` — Entries symlinked directly to `~/` (`.zshenv`, `.claude/`, `.pi/`)
- `config/` — App configs symlinked into `~/.config/` (nvim, tmux, fish, zsh, git, etc.)
- `bin/` — Scripts added to `$PATH` (dot, claude-status-hook, etc.)
- `docs/` — Setup guide, cheatsheets, research notes
- `resources/` — Fonts, themes, static assets
- `tools/` — Standalone tooling (gpt5-mcp-server)

## Setup

```bash
bin/dot link          # Symlink all packages
bin/dot link nvim     # Symlink single package
bin/dot unlink        # Remove symlinks
bin/dot backup        # Backup existing before linking
```

Full fresh-machine sequence: `docs/setup.md`.

## Key conventions

- `config/` dirs map 1:1 to `~/.config/<name>/`
- `home/` entries are symlinked directly to `~/`
- Claude Code settings live in `home/.claude/settings.json` → `~/.claude/settings.json` (directory-level symlink: `~/.claude` → `home/.claude`, so runtime state lands in the repo tree — `.gitignore` tracks only curated files)
- Interactive shell is **fish** (`config/fish/config.fish`) with starship prompt; zsh (`home/.zshenv` → `config/zsh/`) is kept for login/non-interactive compatibility
- fish and zsh env/aliases are synced by hand — change both when touching env vars or aliases
- Git identity is NOT in `config/git/config`; it lives in `~/.gitconfig-local` (written by `dot git setup`)
- Scripts derive `$DOTFILES` from their own location — never hardcode the repo path
- `bin/claude-statusline`, `bin/nerdwin` and `bin/tmux-git-status` embed nerd-font glyphs **literally** (macOS system bash 3.2 does not expand `\u`/`\U` in `printf`). Never retype a glyph — copy the line or restore it from `git show HEAD:<file>`. After any rewrite of these files, verify the codepoints survived; `perl -pi` without `-CSD` double-encodes UTF-8 already in the file:

  ```bash
  python3 -c 'import io,sys
  for l in io.open(sys.argv[1],encoding="utf-8"):
      g=[hex(ord(c)) for c in l if ord(c)>0x2500]
      if g: print(g, repr(l))' bin/claude-statusline
  ```
