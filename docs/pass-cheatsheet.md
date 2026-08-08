# pass Cheat Sheet

Setup and day-to-day reference for [`pass`](https://www.passwordstore.org/) —
the standard UNIX password manager. GPG-encrypted files under
`~/.password-store/`, optionally version-controlled with git.

## Install

```bash
brew install pass gnupg pinentry-mac
```

Wire up pinentry so GPG prompts use a native macOS dialog:

```bash
mkdir -p ~/.gnupg
echo 'pinentry-program /opt/homebrew/bin/pinentry-mac' >> ~/.gnupg/gpg-agent.conf
chmod 700 ~/.gnupg
gpgconf --kill gpg-agent   # reload agent with new config
```

## 1. Create a GPG key (once per machine/identity)

`pass` encrypts every entry to a GPG public key. You need one first.

```bash
gpg --list-secret-keys --keyid-format=long    # check for existing keys
gpg --full-generate-key                       # create a new one
```

At the prompts:

| Prompt | Pick |
|---|---|
| Key kind | `9` — ECC (sign + encrypt), the default. Modern, fast, small. |
| Curve | `1` — Curve 25519 (default). |
| Expiry | `0` for never, or e.g. `2y`. |
| Name / Email | Your real identity. The email is your `gpg-id`. |
| Passphrase | Strong. Protects the entire store. |

Avoid sign-only types (`3`, `4`, `10`) — they cannot encrypt, so `pass init` will fail.

## 2. Initialize the store

```bash
pass init your-email@example.com
# creates ~/.password-store/ and writes .gpg-id
```

### Version-control it (recommended)

```bash
pass git init
pass git remote add origin git@github.com:you/password-store.git   # private repo
pass git push -u origin main
```

Every `insert` / `edit` / `rm` / `mv` auto-commits. On a second machine:

```bash
git clone git@github.com:you/password-store.git ~/.password-store
# and import your secret key — see "Multi-device" below
```

## 3. Day-to-day usage

```bash
pass insert personal/github          # prompts; stores personal/github.gpg
pass insert -m work/aws              # multiline — append username, URL, notes
pass generate work/stripe 32         # 32-char random password
pass generate -n work/db 20          # no symbols
pass show personal/github            # print to terminal
pass -c personal/github              # copy to clipboard, auto-clears in 45 s
pass edit personal/github            # opens in $EDITOR (nvim)
pass find github                     # search names
pass grep TOTP                       # search decrypted contents
pass ls                              # tree view
pass mv old/path new/path
pass rm personal/github
```

### Multiline entry convention

Line 1 is the password (so `-c` works). Subsequent lines are free-form
`key: value` metadata:

```
hunter2
login: nick@example.com
url: https://example.com/login
otp: otpauth://totp/...
notes: recovery email is ...
```

### Git operations

Any git command works through `pass git`:

```bash
pass git status
pass git log
pass git push
pass git pull
```

## Multi-device

A clone of `~/.password-store` is useless without the GPG key. On the
first machine:

```bash
gpg --export-secret-keys --armor your-email@example.com > secret.asc
gpg --export --armor your-email@example.com > public.asc
```

On the second:

```bash
gpg --import secret.asc
gpg --import public.asc
echo -e "trust\n5\ny\n" | gpg --command-fd 0 --edit-key your-email@example.com
```

Delete `secret.asc` when done. **Lose every copy of the secret key and
every `.gpg` in the store is unrecoverable** — no rescue, no reset.

## Shell integration

```bash
pass ls                                         # zsh/fish tab-completes names
pass -c personal/$(pass ls personal | fzf)      # fuzzy-pick + clip
```

Browser fill: [`passff`](https://github.com/passff/passff) (Firefox) or
[`browserpass`](https://github.com/browserpass/browserpass-extension)
(Chrome/Firefox/Safari) bridge to the store.

## Headless / non-interactive use

Agents and detached scripts have no tty. gpg passes the caller's terminal to
pinentry, so with none it sends `OPTION ttyname=not a tty`, pinentry has
nowhere to draw, and the prompt is cancelled before you see it — `pass show`
just fails with exit 2. Two mechanisms cover this, set up by `dot pass setup`:

```bash
dot pass setup                 # create the agent key, init agent/
dot pass setup --cache-ttl 28800   # ...and widen the passphrase cache to 8h
dot pass status                # gpg-id map, cache state, tmux availability
```

### `agent/` — a passphrase-less subtree

`pass` honours a `.gpg-id` per subfolder. `dot pass setup` generates a second
GPG key with **no passphrase** and points `agent/` at it, listing the agent key
first and your main key second:

```
~/.password-store/.gpg-id          you@example.com
~/.password-store/agent/.gpg-id    <agent-key-fingerprint>
                                   you@example.com
```

gpg walks recipients in order, so a headless decrypt hits the passphrase-less
key and never reaches the main one. Your main key is still a recipient, so you
can read and edit those entries interactively and they are not orphaned if the
agent key is lost.

```bash
pass insert agent/some-token   # decrypts later with zero interaction
```

The agent key's secret sits unprotected in `~/.gnupg`. Entries under `agent/`
are only as safe as that directory — put low-blast-radius secrets there and
leave production credentials under the main key. `dot pass setup` never moves
anything for you.

### `pass-unlock` — tmux popup for the main key

For everything outside `agent/`, `pass-unlock` opens a tmux popup on the
attached client. A popup gets a real pty, so pinentry can prompt there; the
passphrase lands in gpg-agent's cache and the headless caller's own `pass show`
then works with no tty of its own.

```bash
pass-unlock work/api-token     # prompt in a popup, prime the cache
secret-get work/api-token | some-tool --token-stdin
```

This needs a terminal pinentry — set `pinentry-program` to `pinentry-tty` or
`pinentry-curses` in `~/.gnupg/gpg-agent.conf`. `pinentry-mac` cannot draw in a
popup without a GUI session, which is exactly the case this section is about.

`secret-get` is `pass-unlock` + `pass show` in one, a drop-in for `pass show`.
Both need an attached tmux client and fail with a clear message without one.
`pass-unlock` blocks while the popup is open (default 90s, `--timeout` to
change), and no secret ever crosses back — the popup discards its own
decryption and returns only an exit status.

## Gotchas

- First decrypt per session prompts for the passphrase; gpg-agent caches
  it (default 10 min idle, 2 h max). Tune in `~/.gnupg/gpg-agent.conf`:
  ```
  default-cache-ttl 3600
  max-cache-ttl 28800
  ```
- `pass init` with a different `gpg-id` **re-encrypts every entry** — slow
  on large stores.
- Subfolders can have their own `.gpg-id` (run `pass init -p subdir id`)
  for per-folder recipients — handy for shared work stores.
- Clipboard clear timer is 45 s; set `PASSWORD_STORE_CLIP_TIME` to change.
- Store location override: `PASSWORD_STORE_DIR=/path/to/other/store`.
