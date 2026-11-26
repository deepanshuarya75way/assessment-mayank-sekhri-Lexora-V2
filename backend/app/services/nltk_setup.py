from __future__ import annotations

import threading

import nltk

_DOWNLOAD_LOCK = threading.Lock()
_IS_READY = False


def _ensure_resource(resource_path: str, package_name: str) -> None:
    try:
        nltk.data.find(resource_path)
        return
    except LookupError:
        pass

    nltk.download(package_name, quiet=True, raise_on_error=True)
    nltk.data.find(resource_path)


def ensure_nltk_resources() -> None:
    global _IS_READY

    if _IS_READY:
        return

    with _DOWNLOAD_LOCK:
        if _IS_READY:
            return

        # pinecone-text BM25 tokenizer may require punkt and punkt_tab depending on nltk version.
        _ensure_resource("tokenizers/punkt", "punkt")
        _ensure_resource("tokenizers/punkt_tab", "punkt_tab")

        _IS_READY = True
