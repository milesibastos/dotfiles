# Fresh-User Setup

End-to-end setup for a brand-new macOS user account (or any machine
that's never seen these dotfiles). Run top-to-bottom.

## Prerequisites

First time on a Mac with no Homebrew:

```bash
xcode-select --install
```

## Sequence

```bash
# 1. Clone the dotfiles (HTTPS — no SSH key required)
git clone https://github.com/milesibastos/dotfiles.git ~/code/dotfiles
cd ~/code/dotfiles

# 2. Symlink everything + post-link fixes
mkdir -p ~/.config
bin/dot link
bin/dot bootstrap            # pre-creates ~/.local/bin and ~/bin,
                             # fixes compaudit perms, installs Ghostty terminfo

# 3. Install Homebrew + all Brewfile packages
#    (first run installs Homebrew; existing installs just run brew bundle)
bin/dot homebrew install

# 4. Configure git identity (prompts for name/email/GitHub user → ~/.gitconfig-local)
bin/dot git setup

# 5. Apply macOS defaults (keyrepeat, dock, finder, etc.)
bin/dot macos defaults

# 6. Set default shell to zsh and install terminfo for tmux/nvim/ghostty
bin/dot shell change
bin/dot shell terminfo

# 7. Reload shell so everything picks up
exec zsh -l

# 8. Plugins + tools
#    - zsh plugins: auto-cloned on shell startup via zfetch (over HTTPS)
#    - everything else via one command:
bin/dot update all
#    This runs nvim Lazy sync, brew upgrade, dotfiles pull, zsh plugin
#    updates, AND installs/updates Claude Code via Anthropic's native
#    installer (no Homebrew cask — it lagged upstream by many versions).

# 9. Optional: tmux plugins
[ -x ~/.config/tmux/plugins/tpm/bin/install_plugins ] && \
  ~/.config/tmux/plugins/tpm/bin/install_plugins
```

## One-liner (after step 1)

```bash
mkdir -p ~/.config && bin/dot link && bin/dot bootstrap && \
  bin/dot homebrew install && bin/dot git setup && bin/dot macos defaults && \
  bin/dot shell change && bin/dot shell terminfo && exec zsh -l
```

Interactive prompts:

- `bin/dot homebrew install` — macOS password for cask installs (Ghostty, Aerospace, Karabiner-Elements, etc.) that copy into `/Applications`
- `bin/dot git setup` — name / email / GitHub username
- `bin/dot shell change` — your user password for `chsh`

## Ongoing maintenance

```bash
bin/dot update all
```

Runs:

- `nvim --headless '+Lazy! sync'` — update Neovim plugins (skipped if nvim isn't installed)
- `brew update && brew upgrade` — update Homebrew (skipped with a warning if Cellar isn't writable by the current user — see isolated-workspace notes)
- zsh plugin `git pull` for each registered plugin
- `git fetch --ff-only` on the dotfiles repo (only pulls if remote is ahead; reports ahead/diverged without clobbering)
- `claude update` if Claude Code is installed, else run Anthropic's installer

Individual commands: `bin/dot update nvim`, `brew`, `zsh`, `dotfiles`, `claude`.

## Isolated workspace users (non-admin account)

If this user was created as an isolated workspace via
`sudo sysadminctl -addUser ...` (see
`docs/research/macos-isolated-user-workspaces.md`), a few things differ:

- **Homebrew is read-only.** `/opt/homebrew` is owned by the admin who
  installed brew. `bin/dot update all` detects this and skips the
  Homebrew step with a warning — no failure. Install new packages from
  the admin user; the isolated user sees them automatically.
- **SSH keys are empty.** All git clones (dotfiles itself, zsh plugins
  via `zfetch`) use HTTPS, so no key setup is required for the first
  pass. Generate per-workspace SSH keys only if you'll be pushing from
  this account.
- **Git identity** may inherit the dotfiles' defaults. After
  `bin/dot git setup`, override if needed:
  ```bash
  git config --global user.email "antonio@milesibastos.com"
  git config --global user.name  "Antonio"
  ```
- **Ghostty terminfo** is user-local. `bin/dot bootstrap` copies it
  from `/Applications/Ghostty.app/Contents/Resources/terminfo` into
  `~/.terminfo` so this user's shells don't emit
  `tput: unknown terminal "xterm-ghostty"`.
- **Claude Code** installs per-user into `~/.local/bin/claude`. Each
  workspace authenticates separately.
- **`dot shell change`** (adding `/opt/homebrew/bin/zsh` to
  `/etc/shells`) needs sudo, which non-admin users don't have. Use
  the system `/bin/zsh` instead:
  ```bash
  chsh -s /bin/zsh
  ```

## Troubleshooting

Common first-run pitfalls, resolved in the codebase but worth knowing:

| Symptom | Cause | Resolution |
|---|---|---|
| `DOTFILES: unbound variable` | `.zshenv` hasn't been linked yet | `bin/dot` and all `dot-*` commands self-derive `$DOTFILES` from their own path |
| `ln: ~/.config/aerospace: No such file or directory` | `~/.config` didn't exist on fresh user | `bin/dot link` now `mkdir -p`s parent dirs automatically — and step 2 above pre-creates `~/.config` |
| `zfetch: command not found: git clone --quiet` on plugin clone | SSH URL + no key; also a zsh word-splitting bug | `zfetch` now uses HTTPS and an array for clone args |
| `compinit: insecure directories and files` | Homebrew owns `/opt/homebrew/share/zsh` as a specific admin user, not root | Dotfiles' `.zshrc` uses `compinit -u` to trust fpath dirs on a single-user laptop |
| `tput: unknown terminal "xterm-ghostty"` | Ghostty terminfo is per-user, not system-wide | `bin/dot bootstrap` copies it into `~/.terminfo` |
| `nisi.plugins.extras.fzf … attempt to concatenate field 'HOMEBREW_PREFIX'` | nvim launched from a shell that didn't `eval $(brew shellenv)` | Plugin detects Homebrew prefix via env / `brew --prefix` / known paths |
| `brew bundle` → "Failed to fetch borders" | `FelixKratz/formulae` tap skipped when brew auto-updated mid-run | Brewfile uses fully-qualified `FelixKratz/formulae/borders` |
| `Error: homebrew/bundle was deprecated` | That tap is empty; `brew bundle` is now in core | Drop the `tap 'homebrew/bundle'` directive |
| `telescope-fzf-native … cmake: command not found` | cmake missing from Brewfile | Added |
| `sniprun … Could not find cargo` | rust toolchain missing | Added `brew 'rust'` |
| `claude update` → "up to date" but outdated | Homebrew cask lagged npm by ~16 versions | Removed cask; install via Anthropic's native installer, handled automatically by `bin/dot update claude` |
| `~/.local/bin is not in your PATH` after Claude install | `.zshrc`'s `prepend_path` skips non-existent dirs; first shell ran before the dir was created | `bin/dot bootstrap` pre-creates `~/.local/bin` so future shells pick it up; for a running shell, `exec zsh -l` |

## Clean-slate removal

Tear down an isolated workspace user when the project ends:

```bash
sudo sysadminctl -deleteUser <username> -secure
```

`-secure` overwrites the home directory before deletion. Homebrew
installs under `/opt/homebrew` persist (shared resource). The user's
`~/.local/bin/claude` is removed with the home dir.
