export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** TEMPORARY until sign-in lands: sent as the x-user-id header. */
  userId?: string;
  signal?: AbortSignal;
};

/** Calls the API and returns parsed JSON, or throws an ApiError with the server's message. */
export async function apiFetch<T>(path: string, { method = "GET", body, userId, signal }: Options = {}): Promise<T> {
  let res: Response;
  try {
    const multipart = typeof FormData !== "undefined" && body instanceof FormData;
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined && !multipart ? { "Content-Type": "application/json" } : {}),
        ...(userId ? { "x-user-id": userId } : {}),
      },
      body: multipart ? body as FormData : body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError("Can't reach the server. Check that the backend is running.", 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status);
  }
  return data as T;
}
