# Dotfiles

Personal dotfiles for macOS, forked from [nicknisi/dotfiles](https://github.com/nicknisi/dotfiles) and heavily customized. Manages configuration for fish, zsh, Neovim, tmux, Ghostty, git, window management (AeroSpace, Karabiner, borders), and a suite of Claude Code / agent tooling.

The repo is location-independent — clone it anywhere; every script derives paths from its own location.

## Setup

Full fresh-machine (or fresh macOS user) instructions live in [docs/setup.md](docs/setup.md). Quick start:

```bash
git clone https://github.com/milesibastos/dotfiles.git
cd dotfiles
mkdir -p ~/.config
bin/dot link          # symlink everything
bin/dot bootstrap     # pre-create dirs, fix perms, install Ghostty terminfo
bin/dot homebrew install
bin/dot git setup     # writes identity to ~/.gitconfig-local (kept out of git)
bin/dot macos defaults
```

## The `dot` command

`bin/dot` is the dotfiles manager. Core subcommands:

```bash
dot help              # list commands
dot link [package]    # symlink all packages, or one
dot unlink [package]  # remove symlinks
dot backup            # back up existing dotfiles before linking
dot clean             # remove broken legacy symlinks
dot bootstrap         # post-link fixes for a fresh user
```

External subcommands (any `dot-<name>` script on `$PATH`):

```bash
dot git setup         # interactive git identity → ~/.gitconfig-local
dot homebrew install  # install Homebrew + brew bundle
dot macos defaults    # apply macOS system defaults
dot shell change      # change default shell / install terminfo
dot update all        # nvim plugins, brew, zsh plugins, dotfiles pull, Claude Code
```

## Structure

- `home/` — entries symlinked directly into `~/` (`.zshenv`, `.claude/`, `.pi/`)
- `config/` — app configs, each dir symlinked 1:1 to `~/.config/<name>/`
- `bin/` — scripts added to `$PATH`
- `docs/` — [setup guide](docs/setup.md), cheatsheets, research notes
- `resources/` — fonts, themes, static assets
- `tools/` — standalone tooling (e.g. `gpt5-mcp-server`, an MCP server exposing GPT-5)

## Shell

**fish** is the daily interactive shell (`config/fish/config.fish`), with the prompt rendered by **starship** (`config/starship/starship.toml`). The zsh configuration (`home/.zshenv` → `config/zsh/`) is kept for login-shell and non-interactive compatibility — `.zshenv` sets `DOTFILES`, `PATH`, and mise shims for scripts and subprocesses. When changing environment variables or aliases, update both `config/fish/config.fish` and the zsh equivalents; they are synced by hand.

## Terminal & window management

[Ghostty](https://ghostty.org) is the primary terminal (`config/ghostty/`); a WezTerm config is kept as a fallback. Window management is [AeroSpace](https://github.com/nikitabobko/AeroSpace) with [borders](https://github.com/FelixKratz/JankyBorders) for focus highlighting, and Karabiner for key remapping.

## tmux + Claude Code tooling

Everything runs inside tmux. The status bar shows git state (`bin/tmux-git-status`), smart window names (`bin/tmux-smart-name`), and live Claude Code agent status. The `claude-*` scripts in `bin/` form an agent-monitoring system:

- `claude-status-hook` — writes per-pane status files from Claude Code hooks (wired in `home/.claude/settings.json`)
- `claude-statusline` — Claude Code status line (path, branch, cost, context remaining, session id)
- `agent-status` / `claude-dashboard` / `claude-next` / `claude-smart-switch` — tmux status glyphs, fzf dashboard, and pane navigation across running agents
- `claude-reconcile` / `claude-tmux-cleanup` — garbage-collect stale state and reset pane borders

`tm` (bound to `prefix s`) lists/creates tmux sessions.

## Claude Code

`home/.claude/` is symlinked to `~/.claude`. Only curated files are tracked (`settings.json`, `CLAUDE.md`, themes); runtime state is gitignored. Hooks are defined inline in `settings.json` and call scripts in `bin/`.

## Neovim

Config starts at `config/nvim/init.lua`, plugins managed by [lazy.nvim](https://github.com/folke/lazy.nvim) under `config/nvim/lua/nisi/plugins/`. First run installs everything automatically; `vimu` syncs headlessly.

## Isolated workspace users

`docs/research/macos-isolated-user-workspaces.md` documents running per-project isolated macOS user accounts. The dotfiles support this: HTTPS-only clones, per-user terminfo, read-only Homebrew detection in `dot update`, and clipboard routing through tmux (`bin/pbcopy`, `bin/osascript`) so copy/paste works in `su`/SSH sessions.
