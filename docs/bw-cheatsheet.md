# bw Cheat Sheet

[`bw`](https://bitwarden.com/help/cli/) — the official Bitwarden CLI.
Two layers of auth: **login** (identity, persistent) and **unlock**
(vault encryption key, per-session). Most commands need the vault
unlocked via a `BW_SESSION` token.

## Install

```bash
brew install bitwarden-cli
```

(already in the repo Brewfile).

## 1. Point at a server (self-hosted / EU cloud only)

Skip this step if you use Bitwarden's US cloud (default).

```bash
bw config server https://bitwarden.example.com       # self-hosted
bw config server https://vault.bitwarden.eu           # EU cloud
```

## 2. Log in (identity)

Pick one. All persist until `bw logout`.

### Email + master password

```bash
bw login you@example.com
# prompts for password (and 2FA if enabled)
```

### API key (no 2FA prompt, good for CI/scripts)

Vault web UI → account menu → **Security** → **Keys** → View API Key.

```bash
export BW_CLIENTID=user.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export BW_CLIENTSECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
bw login --apikey
```

After `--apikey` login, you still must `unlock` with the master password
to get a session.

### SSO

```bash
bw login --sso
# opens a browser for the IdP flow
```

## 3. Unlock → `BW_SESSION`

Login establishes identity; unlock produces the symmetric key that
decrypts items. The CLI returns it as a session token — **every other
command needs it**.

```bash
export BW_SESSION=$(bw unlock --raw)       # prompts for master password
```

Or, in fish:

```fish
set -gx BW_SESSION (bw unlock --raw)
```

Check state any time:

```bash
bw status
# { "serverUrl": "...", "status": "unlocked", "userEmail": "...", ... }
```

`status` values: `unauthenticated` → `locked` → `unlocked`.

`bw lock` clears the key (leaves login intact). `bw logout` drops both.

### Session-helper pattern (recommended for shells)

Put this in `~/.config/fish/functions/bwu.fish` (or a zsh function):

```fish
function bwu --description 'unlock Bitwarden and export session'
    set -gx BW_SESSION (bw unlock --raw)
    bw sync >/dev/null
end
```

Then `bwu` unlocks once per session.

### Pulling the master password from `pass`

Skip the prompt entirely — store the master password in `pass` (see
[pass-cheatsheet.md](./pass-cheatsheet.md)) and feed it through
`--passwordfile`. This keeps the secret off `ps`, shell history, and
env-var scans.

Seed once:

```bash
pass insert bitwarden/master
```

Then unlock:

```fish
# fish — `psub` turns the piped value into a temp FIFO
function bwu --description 'unlock Bitwarden via pass'
    set -gx BW_SESSION (bw unlock --raw --passwordfile (pass show bitwarden/master | psub))
    bw sync >/dev/null
end
```

```bash
# bash / zsh — process substitution does the same
bwu() {
  export BW_SESSION=$(bw unlock --raw --passwordfile <(pass show bitwarden/master))
  bw sync >/dev/null
}
```

Why `--passwordfile` and not positional-arg?

- `bw unlock "$pw"` → password visible in `ps aux` until the call returns.
- `bw unlock --passwordenv VAR` → fine, but needs `set -gx VAR` + `set -e VAR` dance in fish.
- `bw unlock --passwordfile <(...)` → FIFO lives for one read, no shell gymnastics.

Chicken-and-egg: this moves the attack surface from your master password
to your GPG passphrase. Worth it if the GPG key is hardware-backed
(YubiKey) or the passphrase is long and memorable.

## 4. Sync

The CLI caches the vault locally (encrypted). Pull updates:

```bash
bw sync
bw sync --last        # show last-sync timestamp
```

Changes made via `bw create`/`edit` sync up automatically.

## Reading items

```bash
bw list items                                         # all decrypted
bw list items --search github                         # filter
bw list items --folderid <uuid>
bw list folders
bw list collections
bw list organizations

bw get item github                                    # single item, full JSON
bw get password github                                # just the password
bw get username github
bw get uri github
bw get totp github                                    # current TOTP code
bw get notes "My Secure Note"
bw get attachment file.pdf --itemid <uuid> --output ./file.pdf
```

`bw get item <name>` fails if the name is ambiguous — use an ID or
`--search` + `bw list items` to disambiguate.

Pipe to `jq` for scripting:

```bash
bw list items --search aws | jq '.[] | {name, username: .login.username}'
```

## Creating items

Everything is JSON-based. The canonical workflow is template → edit → encode → create:

```bash
bw get template item | jq '
  .name = "New login" |
  .login = {
    username: "me@example.com",
    password: "hunter2",
    uris: [{ match: null, uri: "https://example.com" }]
  }' | bw encode | bw create item
```

Other types work the same — `bw get template item.login`, `item.card`,
`item.identity`, `item.securenote`.

For folders / collections / attachments:

```bash
echo '{"name":"Work"}' | bw encode | bw create folder
bw create attachment --file ./photo.png --itemid <uuid>
```

## Editing items

```bash
bw get item github \
  | jq '.login.password = "new-pass"' \
  | bw encode \
  | bw edit item <uuid>
```

## Deleting

```bash
bw delete item <uuid>               # sends to trash
bw delete item <uuid> --permanent   # hard delete
bw restore item <uuid>              # from trash
```

## TOTP

```bash
bw get totp github                  # raw 6-digit code to stdout
bw get totp github | pbcopy          # copy on macOS
watch -n 1 bw get totp github        # live code
```

## Locally-served API (biggest productivity win)

`bw serve` exposes the unlocked vault over HTTP on localhost — no need
to juggle `BW_SESSION` across subshells:

```bash
bw serve --port 8087 &                # background
curl http://localhost:8087/status
curl 'http://localhost:8087/list/object/items?search=github' | jq
```

Kill with `kill %1` or `pkill -f 'bw serve'`. Serves only while the
parent shell's session is unlocked.

## Common scripting patterns

### One-liner: extract password for another tool

```bash
export AWS_SECRET_ACCESS_KEY=$(bw get password aws-prod)
```

### git credential helper via Bitwarden

`~/.local/bin/git-credential-bw`:

```bash
#!/usr/bin/env bash
[[ "$1" != "get" ]] && exit 0
declare -A req; while IFS='=' read -r k v; do req[$k]=$v; done
item=$(bw list items --url "${req[protocol]}://${req[host]}" | jq '.[0]')
printf 'username=%s\n' "$(jq -r '.login.username' <<<"$item")"
printf 'password=%s\n' "$(jq -r '.login.password' <<<"$item")"
```

```bash
git config --global credential.helper bw
```

### Export for backup (encrypted)

```bash
bw export --format encrypted_json --password "$backup_pw" --output ./vault.json
```

Plain CSV/JSON exports also work (`--format csv`, `--format json`) but
store secrets in cleartext — handle accordingly.

## Multi-device

`BW_SESSION` is tied to the local vault cache on one machine. Nothing
to transfer — just `bw login` + `bw unlock` on each machine. That's the
point.

## Gotchas

- **`bw get item X` is fuzzy but strict.** Ambiguous names error out.
  Use the UUID (`.id` from `bw list`) for anything scripted.
- **`BW_SESSION` expires when you `bw lock` or the shell exits.** Keep
  it in a function/var, not in `.bashrc`. `bw serve` sidesteps this.
- **JSON schema matters.** Missing required fields on `create item`
  return vague errors. Always start from `bw get template`.
- **CLI version drift.** Self-hosted servers can run older API versions
  than the CLI; check `bw config server` status and pin versions if it
  misbehaves.
- **Rate limits** apply to `bw login` attempts on cloud; unlock is local
  and free.
- **2FA at login, not unlock.** If you have 2FA on, either use `--code
  <totp>` or let it prompt. API-key login skips this.
- **`bw export` is plaintext by default** — always pass
  `--format encrypted_json --password ...` unless you specifically want
  raw.

## Related

- `pass` — local, GPG-backed, git-versioned. Different model, in this
  repo's `pass-cheatsheet.md`.
- `security` — macOS Keychain CLI. System-level secrets, no sync to
  Linux/Windows.
