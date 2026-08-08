# Claude Code Session IDs and the Status Line Payload

## Summary

`bin/claude-statusline` shows a truncated session id. This note records how that
id maps back to a resumable session, what `claude --resume` actually accepts, and
where the authoritative status line payload schema lives.

Verified against Claude Code `2.1.226` (2026-08-08).

## Resolving a short session id

The status line prints the first 8 characters of the session UUID
(`CLAUDE_STATUSLINE_SESSION_FULL=1` prints the whole thing). Transcripts are named
after the full UUID, so a prefix resolves with a glob:

```bash
basename "$(ls ~/.claude/projects/*/80fad58c*.jsonl | head -1)" .jsonl
# → 80fad58c-6a02-4e7e-9281-3fb52baaac3d
```

The `head -1` matters. One UUID can own several files — a copy under a worktree's
project dir, or an `.orphaned-<epoch>-<hash>.jsonl` sibling — and without it
`basename` receives multiple paths and prints garbage. More than one hit is only a
real collision if the UUIDs differ:

```bash
ls ~/.claude/projects/*/80fad58c*.jsonl | sed 's|.*/||; s|\..*||' | sort -u
```

### How unique is 8 characters?

Measured on this machine: 457 transcript files, 455 distinct UUIDs, **zero**
prefix collisions (the two duplicate prefixes were the same UUID stored twice).

8 hex characters is a 4.3e9 space, so by the birthday bound the collision
probability is roughly `N² / 2^33`: ~0.002% at 455 sessions, ~1% around 9,000.

## What `--resume` accepts

A prefix is rejected outright:

```
$ claude -r 80fad58c -p "..."
Error: --resume requires a valid session ID or session title when used with --print.
Usage: claude -p --resume <session-id|title>. Provided value "80fad58c" is not a
UUID and does not match any session title.
```

So the accepted handles are:

- the **full UUID**
- an exact **session title** — the human-readable name set with `/rename`, exposed
  to the status line as the optional `session_name` field. This is the only handle
  that is directly pasteable, which makes it worth surfacing when it is set.

Two behaviours worth knowing:

- **Resolution is global, not project-scoped.** A session belonging to
  `~/code/chatwoot` resumes fine from `/tmp`. The `~/.claude/projects/<slug>/`
  directory is storage layout, not a lookup key.
- **Not every `.jsonl` is resumable.** Some hold only metadata records (`ai-title`,
  `agent-name`) with no messages; those fail with `No conversation found with
  session ID: <uuid>` even from the owning directory. Check before concluding a
  session is missing:

  ```bash
  jq -r 'select(.type=="user" or .type=="assistant") | .type' <file>.jsonl | wc -l
  ```

## Status line payload schema

The authoritative schema is documented inside the Claude Code binary, not in the
online docs. Extract it rather than guessing field names:

```bash
strings "$(readlink -f "$(which claude)")" | grep -B5 -A80 '"session_id": "string"'
```

Field names drift between releases, so re-extract instead of trusting a snapshot.
Two fields that shaped the current `bin/claude-statusline`:

- `context_window.total_input_tokens` — real token count in the window. Using it
  removes the need to estimate tokens from a percentage (and the `bc` dependency).
  `remaining_percentage` is pre-calculated and is `null` until the first API
  response, so a `// 100` fallback is required.
- `rate_limits.five_hour` / `.seven_day` — subscription usage now arrives **in the
  payload**. The status line used to fetch this itself via an OAuth token from the
  Keychain and a `curl` to `/api/oauth/usage` with a TTL'd disk cache; all of that
  was deleted. If the 5h/7d display is ever wanted back, it is a `jq` expression
  now, with no network call and no Keychain access.

## Testing the status line

The script only reads stdin, so it is testable without Claude Code. Use `/bin/bash`
explicitly — that is macOS's bash 3.2, which the script targets; `env bash` may
resolve to Homebrew's 5.x and hide a compatibility break.

```bash
printf '%s' '{"session_id":"44ad6ec3-5913-4e63-90f9-7dfc0f23aaaa",
  "workspace":{"current_dir":"'$HOME'/code/dotfiles"},
  "model":{"display_name":"Opus 5"},"cost":{"total_cost_usd":1.23},
  "context_window":{"total_input_tokens":123456,"context_window_size":1000000,
  "remaining_percentage":87.7}}' | env -u TMUX COLUMNS=200 /bin/bash bin/claude-statusline
```

Cases worth covering: session start (`remaining_percentage: null`), a 200K window,
a narrow pane (branch collapses below 120 columns), a missing `session_id`, and
`{}` as input.
