# Fresh-User Setup

Full setup sequence for a brand-new macOS user account (or any machine
that's never seen these dotfiles). Run top-to-bottom.

## Prerequisites

First-time on a Mac with no Homebrew:

```bash
xcode-select --install
```

## Sequence

```bash
# 1. Clone the dotfiles
git clone https://github.com/milesibastos/dotfiles.git ~/code/dotfiles
cd ~/code/dotfiles

# 2. Symlink everything + post-link fixes
mkdir -p ~/.config
bin/dot link
bin/dot bootstrap            # compaudit perms + ghostty terminfo

# 3. Install Homebrew + all brew/cask packages from Brewfile
bin/dot homebrew install     # installs Homebrew if missing, runs brew bundle

# 4. Configure git identity
#    Prompts for name/email/github user → ~/.gitconfig-local
bin/dot git setup

# 5. Apply macOS defaults (keyrepeat, dock, finder, etc.)
bin/dot macos defaults

# 6. Set default shell to zsh and install terminfo for tmux/nvim/ghostty
bin/dot shell change
bin/dot shell terminfo

# 7. Reload shell so everything picks up
exec zsh -l

# 8. First-run plugin installs
#    zsh plugins auto-clone on shell startup via zfetch.
#    Force the rest now:
nvim --headless "+Lazy! sync" +qa
[ -x ~/.config/tmux/plugins/tpm/bin/install_plugins ] && \
  ~/.config/tmux/plugins/tpm/bin/install_plugins
```

## One-liner (after step 1)

```bash
mkdir -p ~/.config && bin/dot link && bin/dot bootstrap && \
  bin/dot homebrew install && bin/dot git setup && bin/dot macos defaults && \
  bin/dot shell change && bin/dot shell terminfo && exec zsh -l
```

Not fully non-interactive: `bin/dot homebrew install` prompts for
`sudo`, and `bin/dot git setup` prompts for name/email/github user.

## Ongoing maintenance

```bash
bin/dot update all           # nvim plugins + brew + dotfiles + zsh plugins
```

## Notes for isolated workspace users (separate macOS account)

If this fresh user is a per-project isolation workspace created with
`sysadminctl -addUser` (see `docs/research/macos-isolated-user-workspaces.md`):

- **SSH/HTTPS:** plugin cloning uses HTTPS, so no SSH key is needed for
  initial setup. Generate per-workspace keys and register them with
  GitHub afterward if you'll be pushing.
- **Override git identity** after `bin/dot git setup` if it picked the
  wrong defaults:
  ```bash
  git config --global user.email "antonio@milesibastos.com"
  git config --global user.name  "Antonio"
  ```
- **Homebrew is shared** with the main user at `/opt/homebrew`. You do
  not need to reinstall it per workspace — but the first time a new
  user invokes `brew`, eval its shellenv (our `.zshenv` handles this).
- **Ghostty terminfo** is user-local. `bin/dot bootstrap` copies it
  from `/Applications/Ghostty.app/Contents/Resources/terminfo` into
  `~/.terminfo` so this user's shells stop emitting
  `tput: unknown terminal "xterm-ghostty"`.

## Clean-slate removal

Tear down an isolation workspace user when you're done with the project:

```bash
sudo sysadminctl -deleteUser <username> -secure
```

`-secure` overwrites the home directory before deletion. Homebrew
installs under `/opt/homebrew` persist (shared resource).
