# Override broken vendor completion shipped with tea 0.14.0
# (urfave/cli template strings were not substituted upstream).

function __tea_perform_completion
    set -l args (commandline -opc)
    set -l lastArg (commandline -ct)
    set -l results ($args[1] $args[2..-1] $lastArg --generate-shell-completion 2>/dev/null)

    for line in $results
        set -l parts (string split -m 1 ":" -- "$line")
        if test (count $parts) -eq 2
            printf "%s\t%s\n" $parts[1] $parts[2]
        else
            printf "%s\n" $line
        end
    end
end

complete -c tea -e
complete -c tea -f -a '(__tea_perform_completion)'
