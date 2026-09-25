import importlib.util
from pathlib import Path

import bcrypt

spec = importlib.util.spec_from_file_location("setup_credentials", Path(__file__).with_name("setup_credentials.py"))
credentials = importlib.util.module_from_spec(spec)
spec.loader.exec_module(credentials)


def test_generation_preserves_database_and_is_idempotent(tmp_path):
    env_file = tmp_path / "test.env"
    login_file = tmp_path / "credentials.json"
    env_file.write_text("POSTGRES_PASSWORD=already-configured-database-password\n")
    credentials.setup(env_file, login_file)
    values = credentials.read_env(env_file)
    assert values["POSTGRES_PASSWORD"] == "already-configured-database-password"
    assert len(values["NEXUS_JWT_SECRET"]) >= 64
    for role in ("ADMIN", "INVESTIGATOR", "VIEWER"):
        assert bcrypt.checkpw(values[f"NEXUS_{role}_PASSWORD"].encode(), values[f"NEXUS_{role}_PASSWORD_HASH"].encode())
    before = env_file.read_bytes(), login_file.read_bytes()
    credentials.setup(env_file, login_file)
    assert before == (env_file.read_bytes(), login_file.read_bytes())


def test_partial_auth_configuration_is_not_silently_replaced(tmp_path):
    import pytest
    env_file = tmp_path / "test.env"
    env_file.write_text("NEXUS_JWT_SECRET=existing\n")
    with pytest.raises(SystemExit, match="Incomplete authentication"):
        credentials.setup(env_file, tmp_path / "credentials.json")
    assert env_file.read_text() == "NEXUS_JWT_SECRET=existing\n"
