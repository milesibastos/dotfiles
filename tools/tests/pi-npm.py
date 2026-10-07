#!/usr/bin/env python3
"""Check prefix canonicalization and scoped npm policy without installing packages."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
NODE = shutil.which("node")
assert NODE, "node is required"
with tempfile.TemporaryDirectory(prefix="pi-npm-test-") as temporary:
    repo = Path(temporary).resolve()
    bin_dir = repo / "bin"
    bin_dir.mkdir()
    wrapper = bin_dir / "pi-npm"
    shutil.copyfile(ROOT / "bin/pi-npm", wrapper)
    agent = repo / "home/.pi/agent"
    managed = agent / "npm"
    managed.mkdir(parents=True)
    shutil.copyfile(ROOT / "home/.pi/agent/npm-policy.json", agent / "npm-policy.json")
    manifest = managed / "package.json"
    original = {"dependencies": {"example": "1.0.0"}, "overrides": {"other": "2.0.0"},
                "allowScripts": {"untrusted@1.0.0": False, "@injaneity/pi-computer-use": True}}
    manifest.write_text(json.dumps(original))
    link = repo / "symlinked-npm"
    link.symlink_to(managed, target_is_directory=True)
    foreign = repo / "project-npm"
    foreign.mkdir()
    (foreign / "package.json").write_text(json.dumps(original))
    npm = bin_dir / "npm"
    npm.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$TEST_LOG"\nexit "${TEST_STATUS:-0}"\n')
    npm.chmod(0o700)
    log = repo / "args"
    env = dict(os.environ, PATH=str(bin_dir), TEST_LOG=str(log))

    def run(args, status=0):
        result = subprocess.run([NODE, str(wrapper), "npm", *args],
                                env=dict(env, TEST_STATUS=str(status)), capture_output=True,
                                text=True, timeout=5)
        assert result.returncode == status, (result.returncode, result.stderr)
        return log.read_text().splitlines()

    assert run(["install", "example", "--prefix", str(link), "--legacy-peer-deps"]) == [
        "install", "example", "--prefix", str(managed), "--legacy-peer-deps", "--strict-allow-scripts"]
    updated = json.loads(manifest.read_text())
    assert updated["dependencies"] == original["dependencies"]
    assert updated["overrides"]["other"] == "2.0.0"
    assert updated["overrides"]["pi-web-access@0.37.0"]["."] == "$pi-web-access"
    assert updated["overrides"]["pi-web-access@0.37.0"]["@modelcontextprotocol/sdk"] == "1.31.0"
    assert updated["allowScripts"]["@injaneity/pi-computer-use@0.5.1"] is True
    assert "@injaneity/pi-computer-use" not in updated["allowScripts"]
    assert updated["allowScripts"]["untrusted@1.0.0"] is False
    print("PASS: symlinked prefix and version-scoped security policy")
    assert run(["install", f"--prefix={link}"]) == ["install", f"--prefix={managed}", "--strict-allow-scripts"]
    print("PASS: --prefix=value")
    assert run(["install", "--prefix", str(foreign)])[-1] == str(foreign)
    assert json.loads((foreign / "package.json").read_text()) == original
    print("PASS: other project manifests are untouched")
    assert run(["view", "example", "version"]) == ["view", "example", "version"]
    print("PASS: registry lookups are passed through")
    run(["--version"], status=7)
    print("PASS: npm failure is propagated")

    # Real npm, offline, with a harmless local package: an unreviewed script must not run.
    local = repo / "unreviewed"
    local.mkdir()
    marker = repo / "script-ran"
    (local / "package.json").write_text(json.dumps({
        "name": "unreviewed", "version": "1.0.0", "scripts": {
            "postinstall": "node -e \"require('fs').writeFileSync(process.env.TEST_MARKER,'executed')\""}}))
    manifest.write_text(json.dumps({"private": True, "dependencies": {"unreviewed": f"file:{local}"}}))
    real_env = dict(os.environ, TEST_MARKER=str(marker), npm_config_cache=str(repo / "cache"))
    result = subprocess.run([NODE, str(wrapper), "npm", "install", "--prefix", str(link),
                             "--legacy-peer-deps", "--offline", "--no-audit", "--no-fund"],
                            env=real_env, capture_output=True, text=True, timeout=30)
    assert result.returncode != 0 and "ESTRICTALLOWSCRIPTS" in result.stderr, result.stdout + result.stderr
    assert not marker.exists(), "unreviewed script executed"
    print("PASS: real npm refuses an unreviewed script before execution (offline)")
