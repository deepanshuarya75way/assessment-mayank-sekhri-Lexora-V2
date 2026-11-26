import io
from typing import Any, Callable

import docx
import fitz
import pandas as pd
import pytesseract
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pdf2image import convert_from_bytes


class FileProcessingCancelledError(Exception):
    """Raised when file extraction or chunking is cancelled mid-flight."""


def _check_cancelled(should_cancel: Callable[[], bool] | None, stage: str = "") -> None:
    if should_cancel and should_cancel():
        detail = f" during {stage}" if stage else ""
        raise FileProcessingCancelledError(f"File processing cancelled{detail}")


def _split_and_collect(
    splitter: RecursiveCharacterTextSplitter,
    text: str,
    page_number: int,
    chunk_records: list[dict[str, Any]],
    *,
    on_progress: Callable[[int, int], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> None:
    raw_chunks = splitter.split_text(text)
    total = max(1, len(raw_chunks))

    for idx, chunk_text in enumerate(raw_chunks, start=1):
        _check_cancelled(should_cancel, "text chunking")
        cleaned = chunk_text.strip()
        if cleaned:
            chunk_records.append({"text": cleaned, "page_number": page_number})
        if on_progress:
            on_progress(idx, total)


def extract_text_chunks(
    file_bytes: bytes,
    mime_type: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    *,
    on_progress: Callable[[int, int], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    _check_cancelled(should_cancel, "initialization")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )
    chunk_records: list[dict[str, Any]] = []
    page_count = 1

    if mime_type == "application/pdf":
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        try:
            page_count = doc.page_count
            total_pages = max(1, page_count)

            for page_index, page in enumerate(doc, start=1):
                _check_cancelled(should_cancel, f"PDF page {page_index}/{total_pages}")
                page_text = page.get_text("text").strip()

                # OCR fallback for empty/scanned pages
                if len(page_text) < 50:
                    _check_cancelled(should_cancel, f"OCR on page {page_index}/{total_pages}")
                    images = convert_from_bytes(
                        file_bytes,
                        first_page=page_index,
                        last_page=page_index,
                    )
                    _check_cancelled(should_cancel, f"OCR render on page {page_index}/{total_pages}")
                    if images:
                        page_text = pytesseract.image_to_string(images[0]).strip()

                if page_text:
                    for chunk_text in splitter.split_text(page_text):
                        _check_cancelled(should_cancel, f"splitting page {page_index}")
                        cleaned = chunk_text.strip()
                        if cleaned:
                            chunk_records.append(
                                {"text": cleaned, "page_number": page_index}
                            )

                if on_progress:
                    on_progress(page_index, total_pages)
        finally:
            doc.close()

    elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        doc = docx.Document(io.BytesIO(file_bytes))
        _check_cancelled(should_cancel, "DOCX parse")
        full_text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
        _split_and_collect(
            splitter,
            full_text,
            1,
            chunk_records,
            on_progress=on_progress,
            should_cancel=should_cancel,
        )

    elif mime_type == "text/csv":
        df = pd.read_csv(io.BytesIO(file_bytes))
        _check_cancelled(should_cancel, "CSV parse")
        full_text = df.to_string()
        _split_and_collect(
            splitter,
            full_text,
            1,
            chunk_records,
            on_progress=on_progress,
            should_cancel=should_cancel,
        )

    elif mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        df = pd.read_excel(io.BytesIO(file_bytes))
        _check_cancelled(should_cancel, "XLSX parse")
        full_text = df.to_string()
        _split_and_collect(
            splitter,
            full_text,
            1,
            chunk_records,
            on_progress=on_progress,
            should_cancel=should_cancel,
        )

    else:
        # Fallback text decoding
        _check_cancelled(should_cancel, "text decode")
        full_text = file_bytes.decode("utf-8", errors="ignore")
        _split_and_collect(
            splitter,
            full_text,
            1,
            chunk_records,
            on_progress=on_progress,
            should_cancel=should_cancel,
        )

    return chunk_records, page_count