export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

if (!process.env.NEXT_PUBLIC_API_URL) {
  console.warn(
    "NEXT_PUBLIC_API_URL is not set, falling back to http://localhost:8000"
  );
}

export type IngestionStep =
  | "uploading"
  | "chunking"
  | "indexing"
  | "completed"
  | "failed"
  | "cancelled";

export interface DocumentIngestPayload {
  user_id: string;
  bucket?: string;
  file_path: string;
  title: string;
  mime_type?: string;
}

export interface DocumentIngestResponse {
  document_id: string;
  chunks_indexed: number;
  page_count: number;
  status: string;
  ingestion_step: IngestionStep;
  ingestion_progress: number;
  step_message?: string | null;
}

export interface DocumentStatusResponse {
  document_id: string;
  title?: string | null;
  status: string;
  ingestion_step: IngestionStep;
  ingestion_progress: number;
  step_message?: string | null;
  chunks_indexed: number;
  page_count: number;
  is_deleting: boolean;
  error_message?: string | null;
}

export interface DocumentDeleteResponse {
  document_id: string;
  deleted: boolean;
  cancelled_in_flight: boolean;
  previous_step?: IngestionStep | null;
  status: string;
}

export const IN_FLIGHT_STEPS = new Set<IngestionStep>([
  "uploading",
  "chunking",
  "indexing",
]);

function buildAuthHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    return JSON.stringify(data);
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export async function ingestDocumentApi(
  token: string,
  payload: DocumentIngestPayload,
  signal?: AbortSignal
): Promise<DocumentIngestResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/documents/ingest`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify({
      bucket: "documents",
      mime_type: "application/pdf",
      ...payload,
    }),
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }

  return res.json();
}

export async function getDocumentStatusApi(
  token: string,
  documentId: string,
  signal?: AbortSignal
): Promise<DocumentStatusResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/documents/${encodeURIComponent(documentId)}/status`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal,
    }
  );

  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }

  return res.json();
}

export async function deleteDocumentApi(
  token: string,
  documentId: string,
  signal?: AbortSignal
): Promise<DocumentDeleteResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/documents/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal,
    }
  );

  // Treat 404 as already removed so pre-emptive deletion stays idempotent in UI
  if (res.status === 404) {
    return {
      document_id: documentId,
      deleted: true,
      cancelled_in_flight: false,
      previous_step: null,
      status: "deleted",
    };
  }

  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }

  return res.json();
}