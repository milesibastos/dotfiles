# tea Cheat Sheet

[`tea`](https://gitea.com/gitea/tea) — the official CLI for Gitea.
Mirrors much of `gh`'s workflow (issues, PRs, repos, releases,
notifications) but talks to any Gitea instance.

> **Scope:** `tea` is an **API client only**. It does **not** configure
> git's credentials — `git fetch/push` over HTTPS still needs its own
> credential helper (`osxkeychain`, a custom helper, or SSH). See
> [Separate from git auth](#separate-from-git-auth) below.

## Install

```bash
brew install tea
```

(also added to the Brewfile in this repo).

## 1. Get a token

You have three paths. Recommendation: **path B** — you control name +
scopes and get the token back exactly once.

### A. Web UI

Avatar menu → **Settings** → **Applications** → **Generate New Token**.
Copy it immediately. Gitea only shows it once.

### B. Gitea API via curl (scripted, explicit scopes)

```bash
curl -u milesibastos -X POST \
  https://gitea.dransay.ai/api/v1/users/milesibastos/tokens \
  -H 'Content-Type: application/json' \
  -d '{
        "name": "laptop-2026-04",
        "scopes": ["write:repository", "read:user", "write:issue"]
      }' \
  | jq -r .sha1
```

The `sha1` field is the token (`gto_…`). Stash in pass:

```bash
printf 'gto_xxxx\n' | pass insert -e gitea/dransay-token
```

### C. Side-effect of `tea login add --user --password`

When you log in with basic-auth credentials, `tea` calls the token API
itself and stores the result. Simplest if you're already setting up
a login, but no control over name or scopes.

```bash
tea login add \
  --name dransay \
  --url https://gitea.dransay.ai \
  --user milesibastos \
  --password "$(pass show gitea/dransay)"
```

The token tea just minted is now in `~/.config/tea/config.yml`.

**Scopes reference (Gitea 1.19+):** `read:admin`, `write:admin`,
`read:organization`, `write:organization`, `read:repository`,
`write:repository`, `read:user`, `write:user`, `read:issue`,
`write:issue`, `read:notification`, `write:notification`, `read:misc`,
`write:misc`, `read:package`, `write:package`, `read:activitypub`,
`write:activitypub`.

For a general-purpose dev token: `write:repository`, `read:user`,
`write:issue`, `write:notification`.

## 2. Log in with a token (preferred)

```bash
tea login add \
  --name dransay \
  --url https://gitea.dransay.ai \
  --token "$(pass show gitea/dransay-token)"
```

`--name` is a short local alias. You can register multiple Gitea
instances and switch between them.

### Common `tea login add` errors

| Error | Cause |
|---|---|
| `Error: no password set` | Passed `--user` without `--password`. `tea` doesn't prompt — either add `--password "$(pass show …)"` or switch to `--token`. |
| `401 Unauthorized` | Token invalid/revoked/scoped too narrowly. |
| `x509: certificate signed by unknown authority` | Self-signed TLS. Add `--insecure` or trust the CA system-wide. |
| `SSH host: (empty)` warning | Gitea didn't advertise an SSH endpoint. See [SSH setup](#ssh-vs-https). |

### Verify

```bash
tea login list        # columns: NAME, URL, SSH HOST, USER, DEFAULT
tea login default dransay
```

Config lives at `~/.config/tea/config.yml` (**plaintext**, token
included). `chmod 600 ~/.config/tea/config.yml`.

## 3. Cloning

```bash
tea repo clone owner/repo                # HTTPS clone from default login
tea repo clone owner/repo target-dir
tea repo clone --login dransay owner/repo
tea repo clone --ssh owner/repo          # SSH URL instead
tea repo clone --depth 1 owner/repo      # shallow
```

`tea clone …` is accepted as a shorter alias.

### SSH vs HTTPS

`tea` displays whichever URL the Gitea instance is configured to
advertise. `--ssh` forces SSH, but only works if:

1. The server actually exposes SSH (port 22 or equivalent).
2. You've added a key at `https://<instance>/user/settings/keys`.
3. `ssh -T git@<instance>` succeeds.

K8s-hosted Gitea often ships with HTTP ingress only — SSH needs its
own `Service` of type `LoadBalancer` / `NodePort`. If `ssh -T` gets
`Connection refused`, that's why. Fix on the server side, or stick
with HTTPS + credential helper.

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

# Tokens (manage via API, not tea itself)
curl -u milesibastos https://gitea.dransay.ai/api/v1/users/milesibastos/tokens \
  | jq '.[] | {id, name, scopes}'
curl -u milesibastos -X DELETE \
  https://gitea.dransay.ai/api/v1/users/milesibastos/tokens/<id-or-name>
```

## Output formatting

Every list command takes `--output` for scripting:

```bash
tea issues --output json | jq '.[] | .title'
tea issues --output csv
tea issues --output yaml
tea repos list --output simple | fzf | xargs tea repo clone
```

## Multi-instance workflow

```bash
tea login add --name home --url https://gitea.home.lan \
  --token "$(pass show gitea/home-token)"
tea login list                          # see both
tea --login home issues                 # explicit target
tea login default home                  # change default
```

Auto-selection: inside a repo whose `origin` host matches a login URL,
`tea` picks that login.

## Separate from git auth

`tea` logging in does **not** authenticate `git fetch/push`. They use
independent credential stacks:

| Need | Used by |
|---|---|
| `~/.config/tea/config.yml` (token) | `tea` REST calls only |
| `git-credential-osxkeychain` / `credential.helper` | `git push/fetch` over HTTPS |
| `~/.ssh/id_*` + ssh-agent | `git push/fetch` over SSH |

Pair `tea` with **one** of:

- **SSH** (cleanest): add key to Gitea → `git remote set-url origin git@host:owner/repo.git`.
- **macOS Keychain for HTTPS**: `git config --global credential.helper osxkeychain`; fetch once with username + PAT as password.
- **DIY helper that pulls from `pass`**:
  ```bash
  cat > ~/.local/bin/git-credential-gitea <<'EOF'
  #!/usr/bin/env bash
  [[ "$1" != "get" ]] && exit 0
  echo "username=milesibastos"
  echo "password=$(pass show gitea/dransay-token)"
  EOF
  chmod +x ~/.local/bin/git-credential-gitea
  git config --global credential.https://gitea.dransay.ai.helper gitea
  ```

## Gotchas

- **Token leaks via `ps`.** `tea login add --token $TOK` exposes `$TOK`
  in the process table. Prefer `--token "$(pass show …)"` — the
  expansion is evaluated in-shell before `tea` spawns.
- **Token scope mismatch** → 403s on specific commands. Regenerate with
  the scopes above.
- **Self-signed TLS** → `--insecure` on login, or trust the CA.
- **Config plaintext** → `~/.config/tea/config.yml` holds raw tokens.
  `chmod 600` and don't sync it publicly.
- **Hostname mismatch for auto-login** — if `origin` is
  `git.example.com` but your login is `gitea.example.com`, add both as
  separate logins or edit the login URL.
- **No `tea tokens` subcommand** — token lifecycle lives at the API
  layer. Use curl or the web UI.

## Related

- [pass-cheatsheet.md](./pass-cheatsheet.md) — where to keep tokens
- [bw-cheatsheet.md](./bw-cheatsheet.md) — alternative secrets store
- `gh` — GitHub CLI (this repo uses it, not a replacement for `tea`)
- `lazygit` — TUI git, host-agnostic
