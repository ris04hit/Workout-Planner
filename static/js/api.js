// =========================
// API
// =========================

export async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed`);
  const text = await res.text();
    return JSON.parse(text);
}

export async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await res.json();
  if (!res.ok) {
    const error = new Error(payload.error || `POST ${url} failed`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}