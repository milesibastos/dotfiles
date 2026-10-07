#!/usr/bin/env python3
"""Check the real update:system task with a fake Homebrew; never update packages."""
import os
from pathlib import Path
import subprocess
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[2]
with (ROOT / "config/mise/config.toml").open("rb") as config:
    task = tomllib.load(config)["tasks"]["update:system"]["run"]

with tempfile.TemporaryDirectory(prefix="update-system-test-") as directory:
    root = Path(directory)
    bin_dir = root / "bin"
    bin_dir.mkdir()
    prefix = root / "homebrew"
    cellar = prefix / "Cellar"
    cellar.mkdir(parents=True)
    log = root / "calls"
    brew = bin_dir / "brew"
    stub = """#!/bin/sh
printf '%s\\n' "$*" >> "$TEST_LOG"
case "$1" in
  --prefix)
    [ "${TEST_PREFIX_STATUS:-0}" = 0 ] || exit "$TEST_PREFIX_STATUS"
    printf '%s\\n' "$TEST_PREFIX" ;;
  --cellar)
    [ "${TEST_CELLAR_STATUS:-0}" = 0 ] || exit "$TEST_CELLAR_STATUS"
    printf '%s\\n' "$TEST_CELLAR" ;;
  update) exit "$TEST_UPDATE_STATUS" ;;
  upgrade) exit "$TEST_UPGRADE_STATUS" ;;
  *) exit 99 ;;
esac
"""
    identity = bin_dir / "id"
    identity.write_text("#!/bin/sh\nprintf '%s\\n' test-user\n")
    identity.chmod(0o700)
    cases = [
        # name, brew present, prefix mode, cellar mode, update rc, upgrade rc, expected rc
        ("no Homebrew", False, 0o700, 0o700, 0, 0, 0),
        ("read-only prefix", True, 0o500, 0o700, 0, 0, 0),
        ("read-only Cellar", True, 0o700, 0o500, 0, 0, 0),
        ("writable installation", True, 0o700, 0o700, 0, 0, 0),
        ("update failure", True, 0o700, 0o700, 7, 0, 7),
        ("upgrade failure", True, 0o700, 0o700, 0, 8, 8),
    ]
    try:
        for name, present, prefix_mode, cellar_mode, update_rc, upgrade_rc, expected_rc in cases:
            prefix.chmod(prefix_mode)
            cellar.chmod(cellar_mode)
            if present:
                brew.write_text(stub)
                brew.chmod(0o700)
            else:
                brew.unlink(missing_ok=True)
            log.unlink(missing_ok=True)
            env = dict(os.environ, PATH=str(bin_dir), TEST_LOG=str(log),
                       TEST_PREFIX=str(prefix), TEST_CELLAR=str(cellar),
                       TEST_UPDATE_STATUS=str(update_rc), TEST_UPGRADE_STATUS=str(upgrade_rc),
                       TEST_PREFIX_STATUS="0", TEST_CELLAR_STATUS="0")
            writable = os.access(prefix, os.W_OK) and os.access(cellar, os.W_OK)
            assert writable == (prefix_mode == cellar_mode == 0o700), "Run this check as a non-root user"
            result = subprocess.run(["/bin/sh", "-eu", "-c", task], env=env,
                                    capture_output=True, text=True, timeout=5)
            calls = log.read_text().splitlines() if log.exists() else []
            expected = [] if not present else ["--prefix", "--cellar"]
            if present and writable:
                expected += ["update"] + ([] if update_rc else ["upgrade"])
            assert result.returncode == expected_rc, (name, result.returncode, result.stderr)
            assert calls == expected, (name, calls)
            if not present or not writable:
                assert "skipping" in result.stdout, (name, result.stdout)
            print(f"PASS: {name}")
        for name, prefix_rc, cellar_rc, expected in [
            ("prefix lookup failure", 9, 0, ["--prefix"]),
            ("Cellar lookup failure", 0, 10, ["--prefix", "--cellar"]),
        ]:
            log.unlink(missing_ok=True)
            env.update(TEST_PREFIX_STATUS=str(prefix_rc), TEST_CELLAR_STATUS=str(cellar_rc))
            # Explicit guards must preserve errors even without shell errexit.
            result = subprocess.run(["/bin/sh", "-c", task], env=env,
                                    capture_output=True, text=True, timeout=5)
            assert result.returncode == (prefix_rc or cellar_rc), (name, result.stderr)
            assert log.read_text().splitlines() == expected, name
            assert "skipping" not in result.stdout, name
            print(f"PASS: {name}")
    finally:
        prefix.chmod(0o700)
        cellar.chmod(0o700)
