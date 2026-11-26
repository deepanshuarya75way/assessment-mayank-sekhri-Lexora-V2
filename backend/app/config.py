from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    cors_origins: str = "http://localhost:3000"
    pinecone_api_key: str = ""
    pinecone_index_name: str = ""
    google_api_key: str = ""
    embedding_model: str = "models/text-embedding-004"
    gemini_chat_model: str = "gemini-1.5-flash"
    embedding_batch_size: int = 50
    embedding_batch_sleep_seconds: float = 1.0
    auto_bootstrap_on_startup: bool = True
    auto_apply_sql_bootstrap_on_startup: bool = True
    bootstrap_fail_fast: bool = False
    supabase_db_url: str = ""
    bootstrap_bucket_name: str = "documents"


@lru_cache
def get_settings() -> Settings:
    return Settings()
