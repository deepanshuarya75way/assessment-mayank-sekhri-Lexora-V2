from __future__ import annotations

import logging
from pathlib import Path

import psycopg

from app.config import get_settings
from app.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


def _workspace_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _apply_sql_file(db_url: str, sql_file: Path) -> None:
    sql_text = sql_file.read_text(encoding="utf-8")
    if not sql_text.strip():
        logger.info("Skipping empty SQL file: %s", sql_file)
        return

    # Robustly parse connection string to handle special characters like '@' in password
    conn_str = db_url
    if "://" in db_url:
        try:
            url_str = db_url.split("://", 1)[1]
            url_str, dbname = url_str.rsplit("/", 1)
            creds, host_port = url_str.rsplit("@", 1)
            if ":" in host_port:
                host, port = host_port.split(":", 1)
            else:
                host, port = host_port, "5432"
            if ":" in creds:
                user, password = creds.split(":", 1)
            else:
                user, password = creds, ""
            conn_str = f"host={host} port={port} user={user} password={password} dbname={dbname}"
        except Exception as e:
            logger.warning("Failed to robustly parse db_url, falling back to raw: %s", e)

    with psycopg.connect(conn_str, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(sql_text)

    logger.info("Applied SQL bootstrap file: %s", sql_file)


def _ensure_storage_bucket(bucket_name: str) -> None:
    client = get_supabase_client()

    # list_buckets can return an empty list when no buckets exist yet.
    buckets = client.storage.list_buckets() or []
    if any(getattr(bucket, "name", None) == bucket_name for bucket in buckets):
        logger.info("Storage bucket '%s' already exists", bucket_name)
        return

    client.storage.create_bucket(bucket_name, options={"public": False})
    logger.info("Created storage bucket '%s'", bucket_name)


def run_startup_bootstrap() -> None:
    settings = get_settings()

    if not settings.auto_bootstrap_on_startup:
        logger.info("Startup bootstrap disabled via AUTO_BOOTSTRAP_ON_STARTUP")
        return

    try:
        _ensure_storage_bucket(settings.bootstrap_bucket_name)

        if not settings.auto_apply_sql_bootstrap_on_startup:
            logger.info("SQL bootstrap disabled via AUTO_APPLY_SQL_BOOTSTRAP_ON_STARTUP")
            return

        if not settings.supabase_db_url:
            logger.warning(
                "SUPABASE_DB_URL is not set; skipping automatic SQL bootstrap for tables/policies. "
                "Bucket initialization still executed."
            )
            return

        sql_dir = _workspace_root() / "supabase"
        sql_files = [sql_dir / "schema.sql", sql_dir / "storage.sql"]
        for sql_file in sql_files:
            if not sql_file.exists():
                logger.warning("Bootstrap SQL file not found: %s", sql_file)
                continue
            _apply_sql_file(settings.supabase_db_url, sql_file)

        logger.info("Startup bootstrap completed successfully")
    except Exception as exc:
        logger.warning("Startup bootstrap failed: %s", exc)
        if settings.bootstrap_fail_fast:
            raise
