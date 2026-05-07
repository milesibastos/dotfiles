function g --description 'git shortcut: bare `g` → status, args → git <args>'
    if test (count $argv) -gt 0
        git $argv
    else
        git s
    end
end
