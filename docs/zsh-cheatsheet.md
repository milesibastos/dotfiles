# zsh Cheat Sheet

Quick reference for the zsh config. Entry point is `home/.zshenv` → sets
`ZDOTDIR=$XDG_CONFIG_HOME/zsh`, so all other files live in `config/zsh/`.

## File layout

| File | Purpose |
|------|---------|
| `home/.zshenv` → `~/.zshenv` | Always sourced. Sets `XDG_CONFIG_HOME`, `ZDOTDIR`, `DOTFILES`, `HISTFILE`, `EDITOR=nvim`, `fpath`, `RIPGREP_CONFIG_PATH` |
| `config/zsh/.zprofile` | Login shells only. Initializes Homebrew (`/opt/homebrew`, `/usr/local`, linuxbrew) and `rbenv` |
| `config/zsh/.zshrc` | Interactive shells. Sources functions, aliases, prompt, plugins |
| `config/zsh/.zsh_functions` | Functions + directory-completion helpers |
| `config/zsh/.zsh_aliases` | Alias definitions |
| `config/zsh/.zsh_prompt` | Async vcs_info prompt (left + right) |
| `~/.localrc` | Local overrides, sourced after functions |
| `~/.zshrc.local` | Local overrides, sourced before prompt/aliases |
| `~/.zshenv.local` | Local env overrides, sourced from `.zshenv` |

## Env

- `EDITOR=nvim`, `GIT_EDITOR=nvim`
- `HISTSIZE=SAVEHIST=10000`, `HISTFILE=~/.zsh_history`
- `CACHEDIR=~/.local/share`, `VIM_TMP=~/.vim-tmp`
- `DOTFILES` — auto-derived from the repo path
- `CODE_DIR` — `~/code` (or `~/Developer` fallback)
- `REPORTTIME=10` — print timing for any command > 10 s
- `KEYTIMEOUT=1` — 10 ms escape key delay

### PATH (prepended, in order)

```
$HOME/.bun/bin
$HOME/.cargo/bin
$HOME/.local/bin
/usr/local/opt/grep/libexec/gnubin
/usr/local/sbin
$DOTFILES/bin
$HOME/bin
```

Plus pnpm (`$HOME/Library/pnpm`), pyenv (`$PYENV_ROOT/bin`), mise shims, and
Vite+ when detected. `typeset -aU path` in `.zshenv` dedupes.

## Shell options

- History: `EXTENDED_HISTORY`, `SHARE_HISTORY`, `HIST_IGNORE_ALL_DUPS`, `HIST_REDUCE_BLANKS`
- `NO_BG_NICE`, `NO_HUP` (keep bg jobs alive on exit), `NO_LIST_BEEP`
- `LOCAL_OPTIONS`, `LOCAL_TRAPS`, `PROMPT_SUBST`, `COMPLETE_ALIASES`

## Keybindings

| Key | Action |
|-----|--------|
| `Ctrl-Left` / `Ctrl-Right` | Backward / forward one word |
| `Alt-Left` / `Alt-Right` | Beginning / end of line |
| `Ctrl-A` | vi beginning-of-line |
| `Ctrl-F` (viins) | vi forward-word |
| `Ctrl-E` (viins) | vi add-eol |
| `Ctrl-J` / `Ctrl-K` | History search forward / backward (prefix-match) |
| `Backspace` | `backward-delete-char` |
| `Delete` | `delete-char` (via terminfo) |

## Aliases

### Navigation / files

| Alias | Command |
|-------|---------|
| `..` `...` `....` `.....` | `cd ..` … up 4 levels |
| `l` | `eza --icons --git --all --long` (or `ls -lah`) |
| `ll` | `eza --icons --git --long` (or `ls -lFh`) |
| `la` | `ls -AF` |
| `lld` | List directories only |
| `rmf` | `rm -rf` |
| `lpath` | `echo $PATH` newline-separated |
| `cleanup` | Recursively delete `.DS_Store` |
| `clsym` | Remove broken symlinks |

### Helpers

| Alias | Command |
|-------|---------|
| `grep` | `grep --color=auto` |
| `df` | `df -h` |
| `du` | `du -h -c` |
| `reload!` | Re-source `.zshrc` with `RELOAD=1` |
| `hidedesktop` / `showdesktop` | Toggle Finder desktop icons |
| `ios` | Open Xcode Simulator |

### tmux / git / editor

| Alias | Command |
|-------|---------|
| `ta` / `tls` / `tat` / `tns` | `tmux attach` / `ls` / `attach -t` / `new-session -s` |
| `gs` | `git s` (custom git alias) |
| `glog` | `git l` |
| `vim` | `nvim` |
| `vimu` | `nvim --headless "+Lazy! sync" +qa` |
| `vimg` | `nvim +Ge:` (fugitive status) |
| `cc` / `claude!` / `cc!` | `claude` / `claude --dangerously-skip-permissions` |

## Functions

| Name | Use |
|------|-----|
| `c <dir>` | `cd $CODE_DIR/<dir>` — completes against `$CODE_DIR` |
| `h <dir>` | `cd $HOME/<dir>` — completes against `$HOME` |
| `md <dir>` | `mkdir -p` then `cd` |
| `g [args]` | `git` if args given, else `git s` |
| `lw <ws>` | `aerospace list-windows --workspace` |
| `last_modified <dir>` | Date of most recent file |
| `prepend_path <dir>` | Add `<dir>` to front of `$path` (skips if missing) |
| `zfetch <user/repo> [plugin.zsh] [dest]` | Clone + source a plugin |
| `zfetch update` / `zfetch ls` | Update all / list tracked plugins |

## Plugins (via `zfetch`, stored in `~/.local/share/zsh/plugins`)

- `mafredri/zsh-async` — async job runner (used by the prompt)
- `zsh-users/zsh-syntax-highlighting`
- `zsh-users/zsh-autosuggestions`
- `grigorii-zander/zsh-npm-scripts-autocomplete`
- `Aloxaf/fzf-tab` — fzf-driven tab completion

Update with `zfetch update`. List with `zfetch ls`.

## Integrations

Conditionally loaded only if the tool is on `$PATH`:

- **fnm** — `fnm env --use-on-cd` (auto node switching)
- **fzf** — `fzf --zsh`; defaults: `fd --type f` for find/Ctrl-T, custom colors
- **zoxide** — `zoxide init zsh --hook pwd` (fallback to `z.sh` from brew)
- **pyenv** — adds `$PYENV_ROOT/bin`, runs `pyenv init -`
- **pnpm** — prepends `$PNPM_HOME` to PATH
- **mise** — `mise activate zsh` (interactive only; use shims in cron)
- **Vite+** — sources `~/.vite-plus/env`
- **rbenv** — `rbenv init` in `.zprofile`
- **Homebrew** — `brew shellenv` in `.zprofile` (arm64 / intel / linuxbrew)

Colored man pages via `LESS_TERMCAP_*` + `MANROFFOPT=-c`.

## Completion

- `compinit -u` — `-u` trusts `fpath` even when `compaudit` complains (Homebrew ownership on personal macs)
- Case-insensitive lowercase-to-uppercase matching
- Completers: `_expand _complete _files _correct _approximate`
- Extra `fpath`: `$DOTFILES/config/zsh/functions`, `/usr/local/share/zsh/site-functions`
- `fzf-tab` replaces the completion UI with fzf

## Prompt

Async two-line prompt:

```
<cwd>  <node icon+version if package.json or node_modules>
<PROMPT_SYMBOL = ''>
```

- Left: green `` (or red on non-zero exit)
- Right: git status icons + branch (computed async via `zsh-async`), plus `✱` for backgrounded jobs
- Git icons: added `+`, modified `●`, untracked `?`, renamed `→`, deleted, stashed, unmerged, ahead `↑`, behind `↓`, diverged, clean `✓`

## Local overrides

Any of these are sourced if present, and not tracked in git:

- `~/.zshenv.local`
- `~/.localrc`
- `~/.zshrc.local`

Use them for host-specific PATH entries, API tokens, or machine-specific
aliases without touching the repo.
