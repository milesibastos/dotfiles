#!/bin/sh

if test ! $(which brew); then
    echo "Installing homebrew"
    ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
fi

echo -e "\n\nInstalling homebrew packages..."
echo "=============================="

# cli tools
brew install ack
brew install tree
brew install wget

# development server setup
brew install nginx
brew install dnsmasq

# development tools
brew install git
brew install hub
brew install fzf
brew install macvim --override-system-vim
brew install reattach-to-user-namespace
brew install tmux
brew install zsh
brew install highlight
brew install nvm
brew install z
brew install markdown
brew install diff-so-fancy
brew install zsh-syntax-highlighting
brew install zsh-autosuggestions

# install neovim
brew install neovim/neovim/neovim

# install typeface designed for source code
brew cask install caskroom/fonts/font-hack
brew cask install caskroom/fonts/font-droid-sans-mono-for-powerline
# cd ~/Library/Fonts && curl -fLo "Droid Sans Mono for Powerline Nerd Font Complete.otf" https://raw.githubusercontent.com/ryanoasis/nerd-fonts/master/patched-fonts/DroidSansMono/complete/Droid%20Sans%20Mono%20for%20Powerline%20Nerd%20Font%20Complete.otf
# exit 0
