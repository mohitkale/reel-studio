/** Tiny typed fetch helpers. Throw Error(message) using the server's error text. */

async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      (json.error as string) || `Request failed (HTTP ${res.status})`,
    );
  }
  return json as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  return parse<T>(await fetch(url));
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  return parse<T>(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function apiDelete<T>(url: string): Promise<T> {
  return parse<T>(await fetch(url, { method: "DELETE" }));
}
