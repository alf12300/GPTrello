export function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data, null, 2));
}

export function requireApiKey(req) {
  const expected = process.env.PROXY_API_KEY;
  if (!expected) return { ok: false, status: 500, error: "SERVER_MISCONFIGURED", message: "Missing PROXY_API_KEY" };

  const got =
    req.headers["x-api-key"] ||
    (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");

  if (!got || got !== expected) {
    return { ok: false, status: 401, error: "UNAUTHORIZED", message: "Missing/invalid API key" };
  }
  return { ok: true };
}

export async function trello(path, { method = "GET", query = {}, body } = {}) {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    throw Object.assign(new Error("Missing Trello credentials"), { code: "SERVER_MISCONFIGURED" });
  }

  const url = new URL(`https://api.trello.com/1${path}`);
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  const resp = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await resp.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!resp.ok) {
    const err = new Error("Trello request failed");
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function startOfTodayISO(tzOffsetMinutes = 0) {
  // We’ll use UTC computations for reliability; GPT can pass explicit due ranges if needed later.
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
