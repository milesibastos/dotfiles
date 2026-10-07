#!/usr/bin/env python3
"""Check bootstrap dependency commands with stubs; never run package scripts."""
import os
from pathlib import Path
import subprocess
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[2]
with (ROOT / "config/mise/config.toml").open("rb") as config:
    task = tomllib.load(config)["tasks"]["bootstrap"]["run"]

for name, present, pnpm_rc, npm_rc in [
    ("no extension checkouts", False, 0, 0),
    ("both extension checkouts", True, 0, 0),
    ("pnpm install failure", True, 7, 0),
    ("npm ci failure", True, 0, 8),
]:
    with tempfile.TemporaryDirectory(prefix="bootstrap-test-") as temporary:
        root = Path(temporary).resolve()
        home = root / "home with spaces"
        home.mkdir()
        repo = root / "dotfiles"
        repo.mkdir()
        ext = home / "Developer/pi-extensions"
        ideation = home / "Developer/ideation"
        if present:
            ext.mkdir(parents=True)
            ideation.mkdir()
        bin_dir = root / "bin"
        bin_dir.mkdir()
        log = root / "calls"
        for command in ["git", "pnpm", "npm"]:
            stub = bin_dir / command
            stub.write_text('''#!/bin/sh
name="${0##*/}"
printf '%s|%s|%s\\n' "$name" "$PWD" "$*" >> "$TEST_LOG"
case "$name" in
  pnpm) exit "$TEST_PNPM_STATUS" ;;
  npm) exit "$TEST_NPM_STATUS" ;;
esac
''')
            stub.chmod(0o700)
        env = dict(os.environ, HOME=str(home), DOTFILES_DIR=str(repo), PATH=str(bin_dir),
                   TEST_LOG=str(log), TEST_PNPM_STATUS=str(pnpm_rc), TEST_NPM_STATUS=str(npm_rc))
        result = subprocess.run(["/bin/sh", "-eu", "-c", task], cwd=repo, env=env,
                                capture_output=True, text=True, timeout=5)
        assert result.returncode == (1 if pnpm_rc or npm_rc else 0), (name, result.returncode, result.stderr)
        calls = log.read_text().splitlines()
        assert len([call for call in calls if call.startswith("git|")]) == 2, calls
        assert "jq 'del(.lastChangelogVersion, .deviceId)'" in calls[0], calls
        expected = []
        if present:
            expected.append(f"pnpm|{ext}|install --frozen-lockfile")
            if not pnpm_rc:
                expected.append(f"npm|{ideation}|ci")
        assert [call for call in calls if not call.startswith("git|")] == expected, (name, calls)
        print(f"PASS: {name}")
