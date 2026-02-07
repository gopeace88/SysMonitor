from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    jwt_secret: str = "dev-secret-change-me"
    admin_username: str = "admin"
    admin_password: str = "admin"
    jwt_expiry_hours: int = 24

    nas_host: str = "192.192.192.145"
    nas_ssh_user: str = "jhkim"
    nas_ssh_key_path: str = "~/.ssh/sysmonitor_nas"
    nas_prometheus_port: int = 9090

    cf_api_email: str = ""
    cf_api_key: str = ""
    cf_account_id: str = ""
    cf_zone_purions: str = ""
    cf_zone_rtk: str = ""

    collect_interval: int = 60

    data_dir: Path = Path("data")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
