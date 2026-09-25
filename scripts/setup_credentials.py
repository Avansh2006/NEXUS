"""Create local/test credentials without printing secrets; requires bcrypt==4.2.1."""
import argparse
import json
import os
from pathlib import Path
import secrets
import shlex
import tempfile

import bcrypt


def read_env(path):
    values = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            name, sep, value = line.partition("=")
            if sep:
                parts = shlex.split(value, comments=True)
                values[name.strip()] = parts[0] if parts else ""
    return values


def private_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def setup(env_file, credentials_file):
    values = read_env(env_file)
    roles = ("admin", "investigator", "viewer")
    auth_keys = ["NEXUS_JWT_SECRET"] + [f"NEXUS_{role.upper()}_PASSWORD_HASH" for role in roles]
    existing = [bool(values.get(key)) for key in auth_keys]
    if all(existing):
        print(f"Authentication already configured in {env_file}; retained existing credentials.")
        return
    if any(existing):
        raise SystemExit("Incomplete authentication configuration; complete or remove the partial auth keys before regenerating.")
    if not values.get("POSTGRES_PASSWORD") or values["POSTGRES_PASSWORD"] == "replace-with-a-local-password":
        values["POSTGRES_PASSWORD"] = secrets.token_hex(32)
    values.setdefault("POSTGRES_USER", "nexus")
    values.setdefault("POSTGRES_DB", "nexus")
    values.setdefault("FRONTEND_ORIGIN", "http://localhost:8080")
    values["NEXUS_JWT_SECRET"] = secrets.token_hex(48)
    credentials = {}
    for role in roles:
        password = secrets.token_urlsafe(24)
        values[f"NEXUS_{role.upper()}_PASSWORD"] = password
        values[f"NEXUS_{role.upper()}_PASSWORD_HASH"] = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
        credentials[role] = {"username": role, "password": password}
    private_write(credentials_file, json.dumps(credentials, indent=2) + "\n")
    private_write(env_file, "# Private local/test settings; do not commit.\n" + "\n".join(f"{key}={shlex.quote(value)}" for key, value in sorted(values.items())) + "\n")
    print(f"Created private configuration: {env_file}; sign-in credentials: {credentials_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--credentials-file", type=Path, default=Path(".tools/credentials.json"))
    args = parser.parse_args()
    setup(args.env_file, args.credentials_file)
