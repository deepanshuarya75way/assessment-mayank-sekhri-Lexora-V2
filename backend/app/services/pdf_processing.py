from typing import Any, Callable

import fitz
from langchain_text_splitters import RecursiveCharacterTextSplitter


class ProcessingCancelledError(Exception):
    """Raised when PDF chunking is cancelled mid-flight."""


def extract_chunked_page_text(
    pdf_bytes: bytes,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    *,
    on_progress: Callable[[int, int], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    if should_cancel and should_cancel():
        raise ProcessingCancelledError("PDF chunking cancelled before start")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    chunk_records: list[dict[str, Any]] = []

    try:
        page_count = doc.page_count
        for page_index, page in enumerate(doc, start=1):
            if should_cancel and should_cancel():
                raise ProcessingCancelledError(
                    f"PDF chunking cancelled at page {page_index}/{page_count}"
                )

            page_text = page.get_text("text").strip()
            if page_text:
                for chunk_text in splitter.split_text(page_text):
                    cleaned = chunk_text.strip()
                    if cleaned:
                        chunk_records.append(
                            {"text": cleaned, "page_number": page_index}
                        )

            if on_progress:
                on_progress(page_index, max(1, page_count))

        return chunk_records, page_count
    finally:
        doc.close()