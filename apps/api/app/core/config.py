from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


API_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "SynthFlow API"
    app_version: str = "1.0.0"
    database_url: str = f"sqlite+aiosqlite:///{(API_ROOT / 'synthflow.db').as_posix()}"
    fernet_secret_key: str = ""
    openai_base_url: str = ""
    openai_api_key: str = ""
    openai_default_model: str = "gpt-4o-mini"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080"
    demo_stream_delay_ms: int = 28

    model_config = SettingsConfigDict(
        env_file=str(API_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
