# milesibastos/dotfiles

Personal dotfiles maintained in [milesibastos/dotfiles](https://github.com/milesibastos/dotfiles), forked from [Nick Nisi's dotfiles](https://github.com/nicknisi/dotfiles). This is a machine configuration, not a starter kit. The host setup assumes Apple Silicon macOS, a checkout at `~/Developer/dotfiles`, and companion repositories under `~/Developer`. The devcontainer runs the same bootstrap in Ubuntu to check the portable terminal configuration without changing the host.

> [!NOTE]
> Nick Nisi's original [vim + tmux talk](https://www.youtube.com/watch?v=5r6yzFEXajQ) and the [repository snapshot used in that recording](https://github.com/nicknisi/dotfiles/tree/aa72bed5c4ecec540a31192581294818b69b93e2) remain available. This fork inherits his setup and adds local customizations; companion tools still come from their original repositories.

<img width="3600" height="2338" alt="Upstream dotfiles screenshot by Nick Nisi" src="https://github.com/user-attachments/assets/96e69aca-610c-4679-9bb7-b03014cda3b4" />

*Screenshot from the upstream README; this fork's appearance may differ.*

## What this sets up

| Area | Current choice |
| --- | --- |
| Machine setup | Mise bootstrap and tasks |
| Terminal | Ghostty, with WezTerm and Kitty configs still tracked |
| Shell and prompt | Homebrew zsh and Starship |
| Multiplexer | tmux |
| Editor | Neovim with lazy.nvim |
| Window management | OmniWM, SketchyBar, and Karabiner-Elements |
| CLI agents | Pi and Claude Code |
| Agent orchestration | Fleet |
| Fonts and color | Monaspace, Symbols Nerd Font, Tokyo Night |

## Install

Run this on a Mac:

```bash
curl -fsSL https://raw.githubusercontent.com/milesibastos/dotfiles/main/install.sh | bash
```

The installer checks for Git, clones this repository, installs Mise, and runs one full bootstrap. On a Mac without the Xcode Command Line Tools, the first run opens Apple's installer and stops. Run the command again after the tools finish installing.

The bootstrap expects:

- Apple Silicon Homebrew paths under `/opt/homebrew`
- a working GitHub SSH key for the additional repositories declared in `[bootstrap.repos]`

After the install, open a new login shell and configure the machine-local Git identity:

```bash
mise run setup-git
```

The Git task asks for a name, email, and GitHub username, then writes `~/.gitconfig-local`. That file is included by the tracked Git config but never committed.

### Preview the install

```bash
curl -fsSL https://raw.githubusercontent.com/milesibastos/dotfiles/main/install.sh | bash -s -- --dry-run
```

Set `NO_COLOR=1` for plain output.

### Run it by hand

```bash
xcode-select --install # only when Git is missing

git clone https://github.com/milesibastos/dotfiles.git ~/Developer/dotfiles
curl -fsSL https://mise.run | sh
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

MISE_GLOBAL_CONFIG_FILE=~/Developer/dotfiles/config/mise/config.toml \
  mise bootstrap --yes --skip-dirty
mise trust ~/Developer/dotfiles
mise -C ~/Developer/dotfiles bootstrap dotfiles apply --yes
```

The explicit `MISE_GLOBAL_CONFIG_FILE` is only needed before bootstrap creates `~/.config/mise`. The final commands apply the repository-local link manifest even when setup is run from outside the checkout.

## How bootstrap works

`config/mise/config.toml` is the machine manifest. A full `mise bootstrap` does the following work:

1. On macOS, runs the pre-packages hook that installs Homebrew and the tap packages mise cannot resolve.
2. Installs the remaining OS-specific packages and macOS apps from `[bootstrap.packages]`.
3. Clones missing repositories from `[bootstrap.repos]` without changing existing checkouts.
4. Applies the `[dotfiles]` symlinks when the repository-local manifest is active; the installer also explicitly applies them after bootstrap.
5. Applies macOS defaults where available and sets the OS-specific login shell.
6. Installs the runtimes and command-line tools from `[tools]`.
7. Runs the `bootstrap` task to register the repository's Git clean filter and install dependencies for the Pi extension and Ideation checkouts.

The installer points Mise at the cloned config, so the same manifest handles the first run and every later run.

### Mise tasks

```bash
mise tasks
```

| Task | Purpose |
| --- | --- |
| `mise run bootstrap` | Register the `pi-settings` Git clean filter and install Pi extension dependencies |
| `mise run install-homebrew` | Install Homebrew with the official installer if needed |
| `mise run install-tap-packages` | Install the macOS packages unavailable to mise |
| `mise run setup-git` | Write the machine-local Git identity |
| `mise run update:all` | Run every scoped update task in sequence |
| `mise run update:system` | Update Homebrew packages if this account can write to the installation |
| `mise run update:tools` | Update mise-managed tools, uv tools, and Pi extensions |
| `mise run update:plugins` | Update Neovim and zsh plugins |
| `mise run update:dotfiles` | Fast-forward this repo when it is on `main` |

<details>
<summary>Software managed by Mise</summary>

### Runtimes

- Node.js 24 and Python 3.14.7
- pnpm, Bun, Deno, Lua, and tree-sitter

### Command-line tools

- 1Password CLI, Claude Code, Pi, Wrangler, Greptile, and the WorkOS CLI
- bat, delta, eza, fd, fzf, GitHub CLI, glow, gum, jq, lazygit, ripgrep, shellcheck, Starship, StyLua, tmux, yazi, zoxide, and superfile
- Neovim
- `diffdad`, `fleet`, `tm`, and `sessions` from Nick Nisi's GitHub repositories. Linux ARM skips these until their releases include ARM assets.

### System packages and macOS apps

- newer Bash, Git, zsh, grep, and Vim builds
- btop, cloc, entr, fswatch, GnuPG, highlight, tree, wdiff, and wget through Homebrew or apt
- noti, trash, Ghostty, WezTerm, Karabiner-Elements, SketchyBar, Monaspace, and Symbols Nerd Font on macOS

### Additional repositories

Bootstrap clones these upstream repositories over SSH:

- `~/Developer/pi-extensions` — `nicknisi/pi-extensions`
- `~/Developer/ideation` — `nicknisi/ideation`
- `~/Developer/claude-plugins` — `nicknisi/claude-plugins`

It also clones these over HTTPS:

- `~/Developer/fleet` — `nicknisi/fleet`
- `~/Developer/skills` — `nicknisi/skills`

</details>

## Repository layout

| Path | What it contains | Destination |
| --- | --- | --- |
| `config/` | App configuration | `~/.config/*` |
| `home/` | Home-directory configuration | `~/.claude`, `~/.pi`, and `~/.zshenv` |
| `bin/` | Personal commands placed on `PATH` | Used directly from this checkout |
| `tools/` | Larger one-off tools and build helpers | Run from the repository |
| `install.sh` | Bare-machine bootstrap | Run directly or through `curl` |
| `mise.toml` | Repository-local dotfile link manifest | Applied from this checkout |
| `.devcontainer/` | Ubuntu development environment and smoke test | Local Docker container |

Mise links directories rather than copying individual files. The two declarations in the repository-root `mise.toml` are intentionally broad:

```toml
[dotfiles]
"~/.config/*" = "config/*"
"~/.??*" = "home/.??*"
```

Sources resolve relative to this checkout, not to `~/.config/mise`. The installer defaults to `~/Developer/dotfiles`; the link manifest can work from another location, but companion repository paths and other configuration still assume `~/Developer`.

### Manage dotfile links

```bash
cd ~/Developer/dotfiles
mise bootstrap dotfiles status
mise bootstrap dotfiles apply --yes
mise bootstrap dotfiles apply --yes ~/.config/nvim
mise bootstrap dotfiles unapply --yes
mise bootstrap dotfiles unapply --yes ~/.config/nvim
```

Unapply a target before deleting or renaming its source. Mise refuses to overwrite a real file with a symlink unless you pass `--force`.

To inspect old dangling links:

```bash
find ~/.config -type l ! -exec test -e {} \; -print
find ~ -maxdepth 1 -type l ! -exec test -e {} \; -print
```

Those commands only print candidates. Check each target before removing it.

## Shell and prompt

`home/.zshenv` establishes the XDG paths, finds the repository through the `~/.zshenv` symlink, and exports `EDITOR=nvim` and `GIT_EDITOR=nvim`. `config/zsh/.zshrc` handles the interactive shell.

The shell config:

- activates Mise for per-directory tool versions
- initializes completion, fzf, and zoxide
- adds the repository's `bin/`, `~/bin`, `~/.local/bin`, Bun, Cargo, pnpm, GNU grep, and `/usr/local/sbin` paths
- sets `CODE_DIR` to `~/code` when it exists, otherwise `~/Developer`
- installs the local zsh plugins with the `zfetch` function
- loads `~/.zshenv.local`, `~/.localrc`, and `~/.zshrc.local` when present

The configured plugins are zsh-async, zsh-syntax-highlighting, zsh-autosuggestions, zsh-npm-scripts-autocomplete, and fzf-tab. `mise run update:plugins` pulls their Git checkouts.

Starship renders a two-line prompt. The left side shows the full directory and a Node version when the directory contains `package.json` or `node_modules`. The right side shows Git state, the branch, and suspended jobs. The prompt symbol is cyan after success and red after failure.

## Terminal and macOS desktop

Ghostty is the terminal this tmux config targets. Its config uses Tokyo Night light and dark themes, Monaspace, a translucent blurred background, CSI-u modified keys, and `cmd+s` as a prefix for native splits and tabs.

The bootstrap installs WezTerm too, and a Kitty config remains in the tree.

OmniWM tiles windows and routes apps to named workspaces. The bootstrap doesn't install it. Its keys and workspace layout are in [`config/omniwm/README.md`](config/omniwm/README.md). The old AeroSpace and Borders configs remain in the tree. SketchyBar shows the workspaces with app icons, the focused window title, the current layout, Fleet state, GitHub review requests, agent spend, Claude usage, and now-playing information.

## Themes

`theme` switches the whole desktop at once, on Linux and macOS:

```bash
theme                 # pick a theme and wallpaper with fzf
theme nord 2          # switch; 2 = second wallpaper
theme next            # cycle (SUPER+0 under Hyprland)
theme bg next         # only the wallpaper (SUPER+CTRL+0)
theme picker          # the carousel overlay; "Theme" and "Wallpaper" in wofi open it
theme list            # every pack with its swatches and tagline
```

The overlay is `config/quickshell/ThemePicker.qml`: the chosen wallpaper expanded in the middle, the rest as skewed slices, type to filter, Enter to apply. `bin/theme` feeds it rows over `qs ipc` and caches thumbnails under `~/.cache/theme/thumbs`.

A pack is `themes/<name>/colors.toml` plus `backgrounds/`; a theme repo laid out that way drops in unchanged. On a switch, `bin/theme` renders `themes/templates/*.tpl` from the palette into `~/.local/state/theme/current/theme/` and every app reads from there: ghostty, kitty, wezterm, tmux, nvim (aether), btop, LazyGit, Delta, fzf, Starship, Pi, and Claude Code on both platforms; Hyprland borders, hyprlock, wofi, the Quickshell bar, and GTK dark/light on Linux; the system appearance, SketchyBar, Borders, and Slack on macOS. A pack may ship a file under a template's name to hand-tune that one app. `bin/theme-color` resolves a `colors.toml` into the full palette (`--all`, `--json`) and is the renderer. Run `theme <name>` once on a fresh machine: hyprlock and hyprpaper read the state dir and have nothing until then.

## tmux

The prefix is `control-a`. I remap Caps Lock to Control, so this is less awkward than the default `control-b`.

| Key after the prefix | Action |
| --- | --- |
| `h`, `j`, `k`, `l` | Move between panes |
| `H`, `J`, `K`, `L` | Resize a pane by ten cells |
| `|` | Split to the right |
| `-` | Split below |
| `g` | Open lazygit in a popup |
| `e` | Open yazi in the pane's directory |
| `s` | Open the `tm` session picker |
| `y` | Open Fleet in a popup |
| `n` | Jump to the next waiting agent pane |
| `f` | Toggle the Fleet sidebar |
| `T` | Toggle the status bar |

The status bar sits at the top. It shows the session on the left, then Fleet state and Git status on the right. The theme follows the macOS light or dark appearance and uses Nerd Font separators.

`tm` is installed as a compiled Mise tool. `bin/tm` is the fallback implementation and uses fzf to switch, create, refresh, and delete sessions.

Set `TMUX_MINIMAL=1` in a local shell file to hide the status bar while a session has one window:

```bash
export TMUX_MINIMAL=1
```

The tmux config also forwards truecolor, italics, undercurl, modified Enter keys, OSC 8 links, and terminal graphics through Ghostty. Those settings are there for Neovim and terminal agents, not decoration.

## Neovim

`config/nvim/init.lua` calls the local `nisi` module. That module bootstraps lazy.nvim, loads the plugin specs under `config/nvim/lua/nisi/plugins/`, and enables the Copilot, Python, and fzf extras.

The active setup uses a transparent background and chooses the Tokyo Night colorscheme after checking the macOS appearance. The first launch needs network access because it clones lazy.nvim and the plugin set.

Useful commands:

```bash
nvim          # Open the editor
vimu          # Run Lazy sync without opening the UI
```

Open `:Lazy` inside Neovim to inspect or update individual plugins.

## Git and worktrees

The tracked Git config lives at `config/git/config`. It sets `main` as the default branch, uses delta for paging, rebases pulls, enables rerere, auto-stashes rebases, and includes the untracked `~/.gitconfig-local` identity file.

### Fork remotes

Use `origin` for this fork and `upstream` for the original repository:

```bash
# A fresh clone already has origin pointing at milesibastos/dotfiles.
git remote add upstream https://github.com/nicknisi/dotfiles.git
git fetch origin
git fetch upstream
git branch --set-upstream-to=origin/main main
git config --local remote.pushDefault origin
```

If `upstream` already exists, use `git remote set-url upstream https://github.com/nicknisi/dotfiles.git` instead of adding it again. Check `git remote -v` before pushing. These settings are local to each checkout and are not stored in a commit.

```bash
git push origin main          # publish to the fork explicitly
git log --oneline main..upstream/main  # review incoming upstream commits
```

The `main` branch tracks `origin/main`, not `upstream/main`, so ordinary pulls and pushes target the fork. `update:dotfiles` follows that tracking configuration. Fetch upstream changes separately and review them before merging or rebasing; do not force-push just to resolve divergence.

### Worktrees

The worktree tooling is available through Git's external-command convention:

```bash
git wt create my-feature
git wt create --pr 123
git wt status
git wt go
git wt prune
```

`git wt create` resolves local branches, remote branches, and GitHub pull requests before creating a new branch. New branches default to the prefix from `git config github.user`. `git wt status` shows dirty, merged, closed, and prunable worktrees.

## Pi, Claude Code, and Fleet

Both agent configurations are tracked, but their runtime data is not.

### Pi

`home/.pi/agent/settings.json` is the Pi configuration. It points at packages from `~/Developer/pi-extensions`, the Claude plugin repository, Ideation, Fleet, and several npm or Git packages. Most extension source code lives outside this repository. A fresh clone will only have the extension repositories declared in Mise; some local package paths still require their own checkouts.

Because `~/.pi` is a directory symlink into this repository, `.gitignore` excludes auth, sessions, memory databases, relay state, subagent runs, package installs, and other runtime files. A Git clean filter strips `lastChangelogVersion` and `deviceId` from `settings.json` before Git compares or stages it, preserving both in the local file.

### Claude Code

`home/.claude/settings.json` and `home/.claude/CLAUDE.md` are the only tracked Claude files. The settings configure the status line, SessionEnd cleanup, permissions, plugin marketplaces, and enabled plugins. Sessions, caches, downloaded plugins, and credentials remain untracked.

Three small scripts connect the agent tools to the terminal environment:

- `claude-statusline` renders the Claude status and pushes usage updates to SketchyBar
- `claude-tmux-cleanup` resets pane state when a Claude session ends
- `claude-notify` sends attention notifications through tmux

MCP servers are user-scoped in `~/.claude.json` and are not part of bootstrap. `bin/setup-mcp-servers` is a one-shot mutating script for the GPT-5, Playwright, and Context7 servers. It requires `OPENAI_API_KEY` and `CONTEXT7_API_KEY`, and it runs immediately when invoked.

### Fleet

[Fleet](https://github.com/nicknisi/fleet) is installed by Mise and lives in its own repository. tmux uses it for agent status, the next-waiting-agent jump, the popup, the sidebar, and window titles. SketchyBar consumes the same state through `sketchybar-fleet-watch`.

## Commands in `bin/`

`bin/` is on `PATH`. The table calls out the larger standalone commands; many of the remaining files support tmux, SketchyBar, Git aliases, or agent status.

| Command | What it does |
| --- | --- |
| `battery` | Print the current macOS battery percentage |
| `brew-why` | Show installed Homebrew formulae and their installed dependents |
| `digest` | Build a bounded text digest of a Git repository for model input |
| `npm-trust-setup` | Bootstrap npm packages and GitHub Actions trusted publishing |
| `wifi-password` | Read a Wi-Fi password from the macOS keychain |
| `thisisfine` | Print the "This is fine" scene in terminal color |

Read a script before running it. Some are one-off commands and do not implement `--help` or a dry run.

## Updating

Run every update in sequence with:

```bash
mise run update:all
```

Run one area with `mise run update:system`, `mise run update:tools`, `mise run update:plugins`, or `mise run update:dotfiles`. The wrapper stops when a task fails.

On a shared machine, `update:system` skips Homebrew when the current account cannot write to its prefix or Cellar, allowing the other update tasks to continue. Run `brew update && brew upgrade` from the Homebrew owner's account instead; the task does not change ownership or request elevated privileges.

Pi uses `bin/pi-npm` (on the dotfiles PATH) to canonicalize symlinked npm prefixes and apply `home/.pi/agent/npm-policy.json` before managed npm operations. The policy upgrades the MCP SDK used by `pi-web-access@0.37.0` to the patched `1.31.0` release and approves only `pi-computer-use@0.5.1` installation scripts. Managed installs use npm's strict script policy, so an unreviewed installation script stops the update instead of merely warning and running. Review a new version before adding another approval; do not approve all versions or use `npm audit fix --force`. The generated npm manifest and lockfile remain ignored.

`fleet` and `skills` source repositories are included in bootstrap so the local Pi references exist on a new machine. Riker is not enabled until its repository and access are configured. `pi-doctor` still fails for genuinely missing configured paths.

Mise's minimum-release-age warnings are intentional safety checks. A GitHub release endpoint error with a successful fallback, and Git's detached-HEAD advice during a Lazy plugin checkout, do not mean the update failed.

## Linux devcontainer

The devcontainer is a disposable Ubuntu 24.04 environment that runs the real bootstrap. Docker bind-mounts this checkout at `/home/vscode/Developer/dotfiles`, so source edits persist on the Mac. Installed tools, cloned companion repositories, and editor plugins live in the container and disappear when it is replaced.

### What the files do

| File or service | Purpose |
| --- | --- |
| `.devcontainer/devcontainer.json` | Tells a Dev Container launcher which image, mount, environment, and lifecycle commands to use |
| `mcr.microsoft.com/devcontainers/base:ubuntu24.04` | Supplies the Ubuntu image, Git, zsh, and the non-root `vscode` user |
| `config/mise/config.devcontainer.toml` | Overrides the macOS login-shell path with `/usr/bin/zsh` |
| `.devcontainer/github_known_hosts` | Pins GitHub's published SSH host key |
| `.devcontainer/smoke-test.sh` | Checks packages, tools, repositories, links, SSH, zsh, Git, Neovim, and tmux |

There is no custom Dockerfile. The official base image already has the prerequisites that `install.sh` needs, and Mise owns the rest.

### Start and enter it

Install the reference CLI once and start OrbStack or Docker Desktop:

```bash
brew install devcontainer
devcontainer up --workspace-folder .
```

The first `up` creates the container, forwards the macOS SSH agent without copying key files, runs `install.sh`, and runs the smoke test. Unlock 1Password if it asks to approve an SSH operation. Enter the resulting zsh login shell with:

```bash
devcontainer exec --workspace-folder . zsh -l
```

Inside that shell, use `nvim`, `tmux`, Git, and the other installed tools normally. Changes under `~/Developer/dotfiles` are changes to the host checkout.

### Check, rerun, and rebuild

Run the smoke test again:

```bash
devcontainer exec --workspace-folder . .devcontainer/smoke-test.sh
```

Rerun bootstrap after changing the Mise manifest or installer:

```bash
devcontainer exec --workspace-folder . zsh -lc 'NO_COLOR=1 bash install.sh'
```

Replace the container and prove setup works from an empty home directory:

```bash
devcontainer up --workspace-folder . --remove-existing-container
```

Docker is the verified container engine. OrbStack and Docker Desktop both expose the SSH agent at the mounted `/run/host-services/ssh-auth.sock` path. DevPod can read the same `devcontainer.json` with its Docker provider, but adds no value for this local workflow. Podman is not verified because it does not provide this Docker-specific SSH bridge.

## Local changes and forks

Machine-only shell changes belong in one of these ignored files:

- `~/.zshenv.local`
- `~/.localrc`
- `~/.zshrc.local`

This fork retains upstream assumptions in the Mise manifest, Claude marketplaces, agent package paths, Git aliases, and application rules. Search for `nicknisi`, `/Users/nicknisi`, and `~/Developer` before adapting it to another machine. Do not blindly replace `nicknisi`: many references are dependencies owned by the original author, not links to this fork.

For the original author's hardware and software context, see [Nick Nisi's uses page](https://nicknisi.com/uses).

## License and questions

The repository retains its upstream MIT license and attribution. Report fork-specific issues in [milesibastos/dotfiles](https://github.com/milesibastos/dotfiles/issues); consult the [upstream discussions](https://github.com/nicknisi/dotfiles/discussions) for questions about the original setup.
