from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    jwt_secret: str = "dev-secret-change-me"
    admin_username: str = "admin"
    admin_password: str = "admin"
    jwt_expiry_hours: int = 24

    cf_api_email: str = ""
    cf_api_key: str = ""
    cf_account_id: str = ""
    cf_zone_purions: str = ""
    cf_zone_rtk: str = ""

    claude_data_dir: Path = Path.home() / ".claude"
    projects_dir: Path = Path("/home/nvme1/jhkim/00.Projects")
    host_etc_dir: Path = Path("/etc")

    collect_interval: int = 300  # 5 minutes for Cloudflare caching

    data_dir: Path = Path("data")
    openclaw_sessions_path: Path = Path.home() / ".openclaw" / "agents" / "main" / "sessions" / "sessions.json"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
