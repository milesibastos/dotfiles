# vim:ft=ruby

# NOTE: homebrew/bundle tap was deprecated in 2025 — `brew bundle` is now
# built into Homebrew core, no tap required.

if OS.mac?
  brew 'noti'                              # utility to display notifications from scripts
  brew 'trash'                             # rm, but put in the trash rather than completely delete
  brew 'FelixKratz/formulae/borders'       # add borders to windows (janky-borders)

  # Applications
  cask 'ghostty'                       # a better terminal emulator
  cask 'wezterm'                       # a better terminal emulator
  cask '1password/tap/1password-cli'   # 1Password CLI
  cask 'karabiner-elements'            # keyboard customizer
  cask 'nikitabobko/tap/aerospace'     # a tiling window manager
  # claude-code: managed by Anthropic's native installer, not Homebrew
  # (cask version lags upstream by many releases). Install with:
  #   curl -fsSL https://claude.ai/install.sh | bash
  # `claude update` handles future updates.

  # Fonts
  cask 'font-symbols-only-nerd-font'   # nerd-only symbols font
  cask 'font-monaspace'                # Preferred monospace font
elsif OS.linux?
  brew 'xclip'                         # access to clipboard (similar to pbcopy/pbpaste)
end

# Latest versions of some core utilities
brew 'git'                             # Git version control
brew 'vim'                             # Vim editor
brew 'bash'                            # bash shell
brew 'zsh'                             # zsh shell
brew 'grep'                            # grep

# packages
brew 'bat'                             # better cat
brew 'cmake'                           # needed to build telescope-fzf-native.nvim
brew 'cloc'                            # lines of code counter
brew 'entr'                            # file watcher / command runner
brew 'eza'                             # ls alternative
brew 'fd'                              # find alternative
brew 'fnm'                             # Fast Node version manager
brew 'gum'                             # fancy UI utilities
brew 'rbenv'                           # Ruby version manager
brew 'fzf'                             # Fuzzy file searcher, used in scripts and in vim
brew 'gh'                              # GitHub CLI
brew 'git-delta'                       # a better git diff
brew 'glow'                            # markdown viewer
brew 'gnupg'                           # GPG
brew 'highlight'                       # code syntax highlighting
brew 'btop'                            # a top alternative
brew 'jq'                              # work with JSON files in shell scripts
brew 'lazygit'                         # a better git UI
brew 'neovim'                          # A better vim
brew 'python'                          # python (latest)
brew 'ripgrep'                         # very fast file searcher
brew 'rust'                            # Rust toolchain (cargo) — needed to build sniprun
brew 'shellcheck'                      # diagnostics for shell sripts
brew 'stylua'                          # lua code formatter
brew 'tmux'                            # terminal multiplexer
brew 'tree'                            # pretty-print directory contents
brew 'wdiff'                           # word differences in text files
brew 'wget'                            # internet file retriever
brew 'zoxide'                          # switch between most used directories
brew 'sesh' # terminal session manager
