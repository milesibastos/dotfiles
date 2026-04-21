# tea Cheat Sheet

[`tea`](https://gitea.com/gitea/tea) — the official CLI for Gitea.
Mirrors most of `gh`'s workflow (issues, PRs, repos, releases, notifications)
but talks to any Gitea instance.

## Install

```bash
brew install tea
```

(also added to the Brewfile in this repo).

## 1. Create a token on your Gitea instance

Web UI → avatar menu → **Settings** → **Applications** → **Generate New Token**.

Scopes needed for full CLI use:
- `read:user`
- `write:repository`
- `write:issue`
- `write:notification` (optional)

Copy the token **immediately** — Gitea only shows it once.

## 2. Log in

```bash
tea login add \
  --name work \
  --url https://git.example.com \
  --token gto_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`--name` is a short local alias (e.g. `work`, `home`). You can register
multiple Gitea instances and switch between them.

Verify:

```bash
tea login list
tea login default work      # make `work` the default for future calls
```

Config lives at `~/.config/tea/config.yml` (plaintext, with token — keep
perms at `600`).

## 3. Clone + per-repo login detection

When you `cd` into a repo whose `origin` matches a logged-in Gitea URL,
`tea` auto-selects that login. Otherwise pass `--login <name>` explicitly.

```bash
tea clone owner/repo                    # clones from default login
tea clone --login work owner/repo       # force a specific login
```

## Day-to-day commands

```bash
# Repos
tea repos list                          # repos you have access to
tea repo create my-new-repo --private
tea repo search "keyword"

# Issues
tea issues                              # list open issues in current repo
tea issues --state closed
tea issue create --title "Bug" --body "Repro steps..."
tea issue 42                            # show issue #42
tea issue 42 --comment "LGTM"

# PRs
tea pulls                               # open PRs in current repo
tea pull create --head feature --base main --title "Add X"
tea pull 17 checkout                    # check out PR #17 locally
tea pull 17 merge

# Releases
tea releases
tea release create v1.0.0 --note "First release"

# Notifications (unified inbox across all logged-in instances)
tea notifications
tea notifications --all
```

## Output formatting

Every list command takes `--output` for scripting:

```bash
tea issues --output json | jq '.[] | .title'
tea issues --output csv
tea issues --output yaml
```

## Multi-instance workflow

```bash
tea login add --name home --url https://gitea.home.lan --token gto_...
tea login list                          # see both
tea --login home issues                 # explicit target
tea login default home                  # change default
```

## Gotchas

- **Token scope mismatch** → 403s on specific commands. Regenerate the
  token with the scopes above.
- **Self-signed TLS** → add `--insecure` to `tea login add`, or better,
  trust the CA system-wide.
- **Config plaintext** → `~/.config/tea/config.yml` holds bare tokens.
  `chmod 600` and don't sync it to a public repo. If you need secrets
  hygiene, keep tokens in `pass` and inject at login time:
  ```bash
  tea login add --name work --url https://git.example.com \
    --token "$(pass show work/gitea-token)"
  ```
- **SSH vs HTTPS clones** — `tea clone` respects your Gitea instance's
  default clone URL. Override with `--ssh`.
- Auto-login detection matches by URL host; if your repo's `origin` uses
  a different hostname than the login URL (e.g. `git.example.com` vs
  `gitea.example.com`), `tea` won't pair them.

## Related

- `gh` — GitHub CLI (this repo uses it, not a replacement)
- `lazygit` — TUI git, works against any remote regardless of host
