# Creating and Using Separate macOS User Accounts as Developer Workspaces

A field guide for a developer on macOS Sonoma/Sequoia/2026 who wants isolated "workspaces" for different clients or projects — weighing the heavy approach (a real second user account) against the lightweight ones most people actually reach for.

---

## 1. Creating a user from the terminal

### 1a. `sysadminctl` — the modern, canonical path

Since 10.13 High Sierra, `sysadminctl` has been Apple's preferred CLI for user management. It provisions the home directory, interacts correctly with Open Directory on APFS, and is the only CLI that knows about **Secure Token**. It still ships without a man page — use `sysadminctl -h` to discover flags.

Minimal standard user:

```bash
sudo sysadminctl -addUser nicknisi -fullName "nicknisi workspace" -password -
```

Admin user with explicit UID/GID/shell/home, created by a Secure-Token admin (recommended on Apple silicon):

```bash
sudo sysadminctl \
  -adminUser existingAdmin -adminPassword - \
  -addUser nicknisi \
  -fullName "Acme Client Workspace" \
  -UID 600 -GID 20 \
  -shell /bin/zsh \
  -home /Users/nicknisi \
  -password - \
  -admin
```

Key flags: `-addUser`, `-fullName`, `-UID`, `-GID`, `-shell`, `-home`, `-password`, `-hint`, `-admin`, `-roleAccount` (names starting with `_`, UID 200–400), `-adminUser/-adminPassword` (to pass Secure Token credentials). Pass a literal `-` instead of a password string to be prompted interactively — never put a password on the command line in shell history.

**UID selection.** macOS uses UID 501+ for normal interactive users, 500 for Guest, <500 for system accounts, 200–400 reserved for role accounts. Pick something ≥501 and unused (`dscl . -list /Users UniqueID | sort -nk2`). Hidden users (UID <500 + `IsHidden=1`) won't appear in Fast User Switching.

**Home directory.** `sysadminctl -addUser` provisions `/Users/<name>` from `/System/Library/User Template/` automatically. If you scripted with `dscl`, run `sudo createhomedir -c -u <name>`.

**Admin vs standard.** `-admin` just adds to the local `admin` group (GID 80). Without it you get a Standard user — safer for a per-project workspace.

### 1b. Secure Token / FileVault / volume ownership

This is the non-obvious part, and it bites every developer who scripts user creation.

- A **Secure Token** is a wrapped KEK protected by the user's password. It lets a user unlock a FileVault APFS volume and, on Apple silicon, makes the user a **volume owner** (governs OS updates, startup security, Erase-All-Content).
- Users created in System Settings inherit Secure Token. **Users created via `dscl`, or via `sysadminctl` without passing an existing Secure-Token admin, do NOT get it** — a long-standing gotcha.
- To guarantee a Secure Token: invoke `sysadminctl -addUser … -adminUser <tokenAdmin> -adminPassword -`, or grant after the fact:

  ```bash
  sudo sysadminctl -adminUser existingAdmin -adminPassword - \
    -secureTokenOn nicknisi -password -
  sudo sysadminctl -secureTokenStatus nicknisi
  ```
- On Apple silicon, a user without Secure Token **cannot** authorize OS updates or modify startup security. For a disposable workspace you may not care — but you *do* need it if FileVault is on and that user should log in after reboot. Check `sudo diskutil apfs listUsers /`.
- On **MDM-managed Macs**, a bootstrap token is escrowed to MDM on first Secure-Token login; MDM can then grant Secure Token silently. If IT auto-creates the enrollment admin, bootstrap-token escrow may never fire — talk to IT before adding local workspace users.
- **SIP** doesn't block user creation but protects `/System/Library/User Template/`. To pre-seed dotfiles, use `/Library/User Template/` or copy post-create.

### 1c. `dscl` — the old approach

Skip unless you need to tweak an attribute `sysadminctl` doesn't expose. `dscl` does **not** grant Secure Token, which is the main reason Apple moved to `sysadminctl`.

```bash
sudo dscl . -create /Users/nicknisi
sudo dscl . -create /Users/nicknisi UserShell /bin/zsh
sudo dscl . -create /Users/nicknisi RealName "Acme"
sudo dscl . -create /Users/nicknisi UniqueID 600
sudo dscl . -create /Users/nicknisi PrimaryGroupID 20
sudo dscl . -create /Users/nicknisi NFSHomeDirectory /Users/nicknisi
sudo dscl . -passwd  /Users/nicknisi 'tempPass'
sudo dscl . -append  /Groups/admin GroupMembership nicknisi   # admin only
sudo createhomedir -c -u nicknisi
# then grant Secure Token as shown above
```

---

## 2. Switching into the new user from a terminal

Four options, in increasing fidelity:

| Method | Auth | Login shell? | Env | launchd session | Keychain/GUI |
|---|---|---|---|---|---|
| `sudo -u nicknisi zsh` | your pw | no | inherits yours | yours (bootstrap = caller) | no |
| `sudo -iu nicknisi` | your pw | yes (simulated) | target user's default | yours | no |
| `su - nicknisi` | **target's** pw | yes | target's default | yours | no |
| `sudo login -fp nicknisi` | bypassed (root) | yes, real `login(1)` | fresh, preserved with `-p` | inherits caller's bootstrap | no |

- **`sudo -iu user`** is the default verb: invokes the target's shell as a login shell and loads *their* dotfiles — closest to a "fresh workspace shell" from the CLI.
- **`su - user`** does the same but requires the target's password; sudo logs show the target user as initiator.
- **`login -fp user`** is what Terminal runs when you open a window. `-f` skips auth (must be root), `-p` preserves env. Feels most "real".
- **None** unlocks the user's login keychain, binds a Mach bootstrap to that user's loginwindow session, or grants GUI access. For that, you need a real loginwindow session (§3). To run something *in* an existing GUI session: `launchctl asuser <UID> command`.

---

## 3. Fast User Switching vs terminal-only

Use **terminal-only (`sudo -iu`)** when you want isolated shell, PATH, env, history, dotfiles, `~/.ssh/`, gpg keyring, `git config`, language-manager state (`~/.rbenv`, `~/.nvm`, `~/.cargo`), build caches, Docker socket — and don't need the user's login-keychain secrets, Safari cookies, iCloud, Xcode codesigning identity, App Store, or any `.app`'s sandbox container under `~/Library/Containers`.

Use **Fast User Switching** for the full login session — notarization/signing with a dev identity in that user's keychain, Xcode + App Store sign-in, Safari with a client's cookies, iCloud Keychain, Notification Center, Mail, the Dock. Apps storing state under `~/Library/Containers/<bundle-id>` are *per user*.

Enable FUS from the CLI:

```bash
sudo defaults write /Library/Preferences/.GlobalPreferences MultipleSessionEnabled -bool YES
defaults -currentHost write .GlobalPreferences userMenuExtraStyle -int 2
```

Behavior changed over recent releases; verify via System Settings → Control Center → Fast User Switching. Restart may be needed.

---

## 4. Workspace-isolation workflows people actually use

Before creating a second account, try lighter approaches. Most developers never need more than the top three.

### Lightweight, in-process

- **`git includeIf`** per-directory identity. Canonical solution for the "wrong email on the wrong repo" problem: `[includeIf "gitdir:~/work/acme/"] path = ~/.gitconfig-acme` (trailing `/` required).
- **`direnv` + `.envrc`** per project: load secrets, `AWS_PROFILE`, `KUBECONFIG`, `OP_ACCOUNT`, per-project `GIT_SSH_COMMAND`, `GNUPGHOME`.
- **`mise`** (formerly `rtx`): tool-version management *and* env vars via `mise.toml`. Cleaner `.zshrc` than asdf+direnv.
- **`HOME=` / `ZDOTDIR=` override.** Cheapest "separate workspace": `ZDOTDIR=~/work/acme/zsh zsh -l` loads isolated dotfiles without touching your real ones. Combine with `HOME=~/work/acme zsh -l` for isolated `~/.ssh`, `~/.config`, history. Fragile (anything calling `getpwuid()` ignores `$HOME`) but excellent for testing.
- **Per-project SSH config.** `~/.ssh/config` with `Host github-acme` / `IdentityFile ~/.ssh/id_ed25519_acme` / `IdentitiesOnly yes`, clone as `git@github-acme:acme/repo.git`.
- **1Password CLI (`op`).** Multiple accounts with `eval $(op signin <account>)` or `OP_ACCOUNT=<id>` per shell. Note: the browser extension has had cross-Chrome-profile leakage complaints.
- **Per-project browser profile.** Chrome/Arc/Firefox isolate cookies, extensions, passwords. Arc has first-class "Spaces". Biggest bang-for-buck after git identity. Not a security boundary — same process tree.

### Medium-weight

- **Dotfile managers with per-machine templating**: `chezmoi` (Go, templated, age/gpg-encrypted secrets), `yadm`, `dotbot`, GNU `stow`. No first-class "per-project profile" — simulate via containers and one repo.
- **Nix devshells + nix-direnv.** `flake.nix` per repo, `echo "use flake" > .envrc`; combine with **nix-darwin** + **home-manager** for reproducible global setup. Best-in-class reproducibility; steep learning curve.

### Heavy-weight (strongest isolation)

- **Docker / Dev Containers via Orbstack, Colima, or Docker Desktop.** Shared-kernel sandbox. Orbstack is fastest and most Mac-native (~2 s boot, near-native FS); Colima is open source and good enough.
- **Lima / Tart micro-VMs.** Full VM isolation, slower, but a real security boundary. Tart is used by CI providers for per-job macOS VMs.
- **DevPod.** "Vagrant with containers" — spins a devcontainer anywhere (local, SSH host, cloud) with the same config.
- **Distrobox / Toolbx.** Linux-only; both assume a host Linux with Podman. **Don't run on macOS.** And they share `$HOME` with the host by design, so even on Linux they're explicitly **not** isolation tools.
- **Full separate macOS user account.** Complete separation of `~/Library`, keychains, containerized app state, Safari cookies, iCloud, Mail, Xcode codesigning identities.

### Tradeoffs of the full-separate-user approach

- **Disk:** Homebrew (`/opt/homebrew`) and `/Applications` are shared; language toolchains and caches duplicate. Budget 10–50 GB per workspace.
- **App Store / licenses:** App Store apps are licensed to an Apple ID. Reuse across users or use a distinct Apple ID per workspace. Swapping Apple IDs mid-life causes "update requires different Apple ID" prompts.
- **iCloud Drive / Desktop & Documents** can't be shared across macOS users on one machine.
- **Time Machine** backs up every user; restores are still per-user. Works fine, just larger.
- **Notifications / Focus:** only the foreground user sees notifications live; background queue until switch-in.
- **Keychain bleed-through:** none by default — the whole point.
- **iMessage / FaceTime / AirDrop:** each account signs in separately.
- **Switch cost:** 1–3 s via FUS, but you lose Cmd-Tab muscle memory — every account is a parallel universe.

---

## 5. Tooling aimed specifically at "multiple Mac workspaces"

Being honest: **there is no widely adopted, actively maintained macOS-native "workspace manager" that sets up ephemeral UIDs and isolated homes for you.** The ecosystem splits into three camps:

1. **Dotfile-per-host managers** — `chezmoi`, `yadm`, `dotbot`, `stow`. Not per-project out of the box.
2. **Env/tool-version managers** — `direnv`, `mise`, `asdf`, `devbox`, `flox`. Per-directory env + tool pinning.
3. **Container/VM dev environments** — Dev Containers spec, DevPod, Orbstack, Colima, Lima. Real OS boundary.

Specific projects searched:

- [`afjlambert/workon`](https://github.com/afjlambert/workon): small shell helper that `cd`s into a project and runs a hook. Low activity — essentially a named-`.envrc`.
- [`orf/git-workspace`](https://github.com/orf/git-workspace): syncs many repos into one tree; doesn't do env isolation.
- [`Thabanengobe/Git-Profile-Switcher`](https://github.com/Thabanengobe/Git-Profile-Switcher): toggles git identity + SSH key. Replaceable by `includeIf`.
- `devpod`, `toolbx`, `distrobox`: first is cross-platform and useful on macOS; last two are Linux-host-only.

Periodic HN threads propose a "per-directory user namespace for macOS" but no such project exists because **macOS has no user-namespace primitive**. That's why distrobox/toolbx exist on Linux; on macOS you get containers (shared kernel, per-workload) or a real second UID (per-account).

---

## 6. What I would actually do

**Default (95% of developers, cheap, reversible):**

1. `git includeIf` per `~/work/<client>/` tree.
2. Separate SSH key per client, aliased via `~/.ssh/config`.
3. `mise` (or `direnv` + `asdf`) in each repo with a `mise.toml`.
4. Separate **browser profile** per client (Chrome or Arc Space).
5. `op` / 1Password vault per client, signed in per terminal session.
6. Dotfiles managed by `chezmoi` or your existing setup; one repo, one laptop user.

Bolt on in an afternoon, reverses cleanly.

**When to escalate to Dev Containers / Orbstack (medium isolation):**

- Project needs specific system deps you don't want globally.
- You run untrusted code (dependency trees, AI coding agents, fresh clones from the internet).
- You want reproducibility across laptops and CI.

**When a full separate macOS user account is actually worth it:**

- **Compliance / contractual boundary.** SOW says "data must not commingle with other clients' data on endpoint devices." A distinct OS user is the easiest artifact to point to.
- **iCloud, Messages, Safari, Mail, Xcode signing identity** belong to different identities per client and you use those apps for work.
- **You want a hard kill switch.** End of engagement: `sudo sysadminctl -deleteUser nicknisi -secure` and the entire footprint goes. No "did I remove that npm token?" worry.
- **MDM is only on one of them.** Some clients require MDM enrollment; a dedicated user (or better, a separate VM/device) keeps your personal data outside the blast radius.

**What I would *not* do:** create a separate macOS user to solve "I keep using the wrong git email." Use `includeIf`. The second-user tax (Apple ID juggling, duplicated `~/Library`, FUS switching, Secure Token/volume-owner management) is meaningful, and most daily friction is fixed with directory-scoped config, not a new UID.

---

## 7. Applied in this repo

This repo supports the "full separate macOS user" approach. The
practical recipe — clone the dotfiles under the new user, symlink,
install per-user tools (Claude Code, Neovim plugins, Ghostty
terminfo, etc.), and handle the shared-Homebrew / non-admin
constraints — lives in [`../setup.md`](../setup.md).

Key points for an isolated-workspace setup:

- Clone via HTTPS — no SSH key needed (dotfiles' zsh plugin manager
  also clones over HTTPS so first-run works without credentials).
- `bin/dot bootstrap` pre-creates `~/.local/bin`, fixes compaudit
  perms, and installs Ghostty terminfo.
- `bin/dot update all` gracefully skips Homebrew on non-admin users
  (Cellar ownership is admin-only) and installs Claude Code via
  Anthropic's native installer per-user under `~/.local/bin/claude`.
- End of engagement: `sudo sysadminctl -deleteUser <name> -secure`.

---

## Sources

- [ss64 — `sysadminctl`](https://ss64.com/mac/sysadminctl.html)
- [ss64 — `dscl`](https://ss64.com/mac/dscl.html)
- [ss64 — `createhomedir`](https://ss64.com/mac/createhomedir.html)
- [ss64 — `login`](https://ss64.com/mac/login.html)
- [LOOBins — sysadminctl](https://www.loobins.io/binaries/sysadminctl/)
- [Apple Platform Deployment — Secure and bootstrap tokens](https://support.apple.com/guide/deployment/use-secure-and-bootstrap-tokens-dep24dbdcf9e/web)
- [Apple Platform Deployment — Manage FileVault with MDM](https://support.apple.com/guide/deployment/manage-filevault-with-device-management-dep0a2cb7686/web)
- [Der Flounder — Granting Volume Owner on Apple silicon](https://derflounder.wordpress.com/2023/03/10/granting-volume-owner-status-on-apple-silicon-macs/)
- [Alan Siu — Add a secure token via CLI](https://www.alansiu.net/2021/05/12/command-to-add-a-secure-token-to-a-macos-user-account/)
- [OpenRadar #34874069 — CLI-created users lack SecureToken](https://github.com/lionheart/openradar-mirror/issues/18598)
- [scriptingosx — Demystifying `sudo`](https://scriptingosx.com/2018/04/demystifying-root-on-macos-part-2-the-sudo-command/)
- [breardon — `sudo -u` vs `launchctl asuser`](https://breardon.home.blog/2019/09/18/sudo-u-vs-launchctl-asuser/)
- [Apple Developer — Root and Login Sessions](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPMultipleUsers/Concepts/SystemContexts.html)
- [Kevin M. Cox — Fast User Switching on Monterey](https://www.kevinmcox.com/2022/04/adventures-in-fast-user-switching-on-macos-monterey/)
- [git-scm — git-config (includeIf)](https://git-scm.com/docs/git-config)
- [Kothar Labs — Directory-targeted git config](https://kothar.net/blog/2025/directory-targeted-git-config)
- [direnv](https://direnv.net/) · [mise via dev.to](https://dev.to/masutaka/migrating-from-asdf-and-direnv-to-mise-3nhi)
- [zsh manual — Startup Files](https://zsh.sourceforge.io/Doc/Release/Files.html)
- [chezmoi](https://www.chezmoi.io/) · [twpayne/chezmoi](https://github.com/twpayne/chezmoi)
- [Home Manager](https://nix-community.github.io/home-manager/) · [Jeff Kreeftmeijer — Nix devshells](https://jeffkreeftmeijer.com/nix-devshells/)
- [OrbStack vs Colima](https://docs.orbstack.dev/compare/colima) · [distrobox](https://github.com/89luca89/distrobox)
- [1Password CLI](https://developer.1password.com/docs/cli/get-started/) · [1Password + Chrome profiles](https://1password.community/discussion/136848/browser-plugin-struggles-with-multiple-chrome-profiles)
- [Macworld — App Store & multiple Apple IDs](https://www.macworld.com/article/231185/mac-app-store-apple-id.html)
- [Apple Discussions — separate iCloud per user](https://discussions.apple.com/thread/253735057)
- [afjlambert/workon](https://github.com/afjlambert/workon) · [orf/git-workspace](https://github.com/orf/git-workspace)
