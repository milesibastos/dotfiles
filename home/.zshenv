# .zshenv is sourced on all invocations of the shell, unless the -f option is set.
# It should contain commands to set the command search path, plus other important environment variables.
# .zshenv' should not contain commands that produce output or assume the shell is attached to a tty.

export XDG_CONFIG_HOME="$HOME/.config"

export ZDOTDIR="$XDG_CONFIG_HOME/zsh"
HISTFILE="$HOME/.zsh_history"
HISTSIZE=10000
SAVEHIST=10000

export DOTFILES="$(dirname "$(dirname "$(readlink -f "${(%):-%N}")")")"

export CACHEDIR="$HOME/.local/share"
export VIM_TMP="$HOME/.vim-tmp"
# add a config file for ripgrep
export RIPGREP_CONFIG_PATH="$HOME/.config/ripgrep/config"

# Claude Code puts its cross-session messaging sockets in $CLAUDE_CODE_TMPDIR/cc-socks
# (falling back to /tmp — it ignores TMPDIR). That path is not namespaced per uid, so on a
# box with several local accounts the first user to start Claude owns /tmp/cc-socks 0700 and
# every other user's session fails to bind ("refusing to bind: EPERM chmod '/tmp/cc-socks'"),
# silently killing agent-to-agent messaging. Keep it under $HOME.
# Parity with config/fish/config.fish.
#
# It must also be a real dir OUTSIDE the dotfiles repo: Claude Code walks every component of
# the resolved path and refuses to bind if any of them is group- or world-writable without the
# sticky bit. ~/.claude symlinks into ~/code/dotfiles/home/.claude, and code/ dotfiles/ home/
# .claude/ are all 0775 group staff, so $HOME/.claude/tmp fails that check even though the
# leaf is 0700 ("a sockets-directory component is not a private-or-sticky directory owned by
# us or root"). $HOME/.cc-tmp resolves under $HOME (0750) only.
export CLAUDE_CODE_TMPDIR="$HOME/.cc-tmp"

[[ -d "$CACHEDIR" ]] || mkdir -p "$CACHEDIR"
[[ -d "$VIM_TMP" ]] || mkdir -p "$VIM_TMP"
[[ -d "$CLAUDE_CODE_TMPDIR" ]] || mkdir -p "$CLAUDE_CODE_TMPDIR"
chmod 700 "$CLAUDE_CODE_TMPDIR"

[[ -f ~/.zshenv.local ]] && source ~/.zshenv.local

fpath=(
    $DOTFILES/config/zsh/functions
    /usr/local/share/zsh/site-functions
    $fpath
)

typeset -aU path

# Keep dotfile/user scripts ahead of system tools for non-interactive shells too.
# This lets pbcopy route through tmux/OSC52 for isolated macOS users.
[[ -d $DOTFILES/bin ]] && path=($DOTFILES/bin ${path:#$DOTFILES/bin})
[[ -d $HOME/bin ]] && path=($HOME/bin ${path:#$HOME/bin})

# mise shims keep node/python on PATH in non-interactive zsh (cron,
# scripts), where `mise activate` in .zshrc never runs. Version-
# independent, unlike the raw install path mise's warning suggests.
[[ -d $HOME/.local/share/mise/shims ]] && path=($HOME/.local/share/mise/shims $path)

export EDITOR='nvim'
export GIT_EDITOR='nvim'
