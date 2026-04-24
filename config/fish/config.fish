# fish entry point — loaded for every interactive session.
# Keep parity with config/zsh/.zshrc; see home/.zshenv for zsh-side env.

# ── Environment ─────────────────────────────────────────────────
set -gx XDG_CONFIG_HOME "$HOME/.config"

# Derive DOTFILES from this file's real path. `path resolve` chases symlinks
# on any parent segment (our setup symlinks ~/.config/fish, not config.fish).
set -l _self (path resolve (status filename))
set -gx DOTFILES (path dirname (path dirname (path dirname $_self)))

set -gx CACHEDIR "$HOME/.local/share"
set -gx VIM_TMP "$HOME/.vim-tmp"
set -gx RIPGREP_CONFIG_PATH "$HOME/.config/ripgrep/config"
set -gx EDITOR nvim
set -gx GIT_EDITOR nvim

test -d $CACHEDIR; or mkdir -p $CACHEDIR
test -d $VIM_TMP; or mkdir -p $VIM_TMP

if test -d ~/code
    set -gx CODE_DIR ~/code
else if test -d ~/Developer
    set -gx CODE_DIR ~/Developer
end

# ── Homebrew (must run before tools installed under brew prefix) ─
if test -x /opt/homebrew/bin/brew
    /opt/homebrew/bin/brew shellenv fish | source
else if test -x /usr/local/bin/brew
    /usr/local/bin/brew shellenv fish | source
else if test -d /home/linuxbrew/.linuxbrew
    /home/linuxbrew/.linuxbrew/bin/brew shellenv fish | source
end

# ── PATH ────────────────────────────────────────────────────────
for dir in $HOME/.bun/bin $HOME/.cargo/bin $HOME/.local/bin $HOME/.opencode/bin /usr/local/opt/grep/libexec/gnubin /usr/local/sbin $DOTFILES/bin $HOME/bin
    test -d $dir; and fish_add_path -pP $dir
end

# ── Interactive-only setup ──────────────────────────────────────
if not status is-interactive
    exit 0
end

# tool activations
command -q fnm; and fnm env --use-on-cd --shell fish | source
command -q zoxide; and zoxide init fish --hook pwd | source
command -q fzf; and fzf --fish | source
command -q pyenv; and pyenv init - fish | source
command -q rbenv; and rbenv init - --no-rehash fish | source
test -x "$HOME/.local/bin/mise"; and $HOME/.local/bin/mise activate fish | source

# fzf defaults
if command -q fzf
    set -gx FZF_DEFAULT_COMMAND 'fd --type f'
    set -gx FZF_CTRL_T_COMMAND $FZF_DEFAULT_COMMAND
    set -gx FZF_DEFAULT_OPTS "--color bg:-1,bg+:-1,fg:-1,fg+:#feffff,hl:#993f84,hl+:#d256b5,info:#676767,prompt:#676767,pointer:#676767"
end

# terminfo
test -e ~/.terminfo; and set -gx TERMINFO_DIRS ~/.terminfo /usr/share/terminfo

# pnpm
if command -q pnpm
    set -gx PNPM_HOME "$HOME/Library/pnpm"
    fish_add_path -pP $PNPM_HOME
end

# ── Aliases ─────────────────────────────────────────────────────
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'

alias grep='grep --color=auto'
alias df='df -h'
alias du='du -h -c'
alias lpath='echo $PATH | tr " " "\n"'

alias ios='open -a /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app'
alias hidedesktop="defaults write com.apple.finder CreateDesktop -bool false; and killall Finder"
alias showdesktop="defaults write com.apple.finder CreateDesktop -bool true; and killall Finder"
alias cleanup="find . -name '*.DS_Store' -type f -ls -delete"
alias clsym="find -L . -name . -o -type d -prune -o -type l -exec rm {} +"

if command -q eza
    alias ll="eza --icons --git --long"
    alias l="eza --icons --git --all --long"
else
    alias l="ls -lah -G"
    alias ll="ls -lFh -G"
end
alias la="ls -AF -G"
alias lld="ls -l | grep ^d"
alias rmf="rm -rf"

alias gs='git s'
alias glog='git l'

alias ta='tmux attach'
alias tls='tmux ls'
alias tat='tmux attach -t'
alias tns='tmux new-session -s'

if command -q nvim
    alias vim='nvim'
    alias vimu='nvim --headless "+Lazy! sync" +qa'
    alias vimg='nvim +Ge:'
end

alias cc='claude'
# fish disallows `!` in function names; expose the --dangerously-skip-permissions
# forms as abbreviations instead. Expands at the command line.
abbr -a 'claude!' claude --dangerously-skip-permissions
abbr -a 'cc!' claude --dangerously-skip-permissions

# ── Prompt ──────────────────────────────────────────────────────
set -gx STARSHIP_CONFIG $XDG_CONFIG_HOME/starship/starship.toml
command -q starship; and starship init fish | source

# ── Local overrides ─────────────────────────────────────────────
test -f $HOME/.config/fish/config.local.fish; and source $HOME/.config/fish/config.local.fish
