// functions/api/waitlist.js
//
// Endpoint da lista de espera do Agenfy, rodando como Cloudflare Pages Function.
// POST /api/waitlist   -> cadastra um e-mail (chamado pelo formulário do site)
// GET  /api/waitlist    -> lista os e-mails cadastrados (protegido por token)
//
// Requer um KV Namespace vinculado ao projeto com o nome "WAITLIST_KV"
// e, opcionalmente, uma variável de ambiente "ADMIN_TOKEN" para proteger a leitura.
// Veja o README.md para o passo a passo de configuração.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_REGEX.test(value);
}

// Cadastro de um novo e-mail na lista de espera
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.WAITLIST_KV) {
    return jsonResponse(
      { error: "KV namespace não configurado. Veja o README.md." },
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
  }

  // honeypot anti-spam: campo escondido no formulário que um humano nunca preenche
  if (body.company) {
    return jsonResponse({ ok: true });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return jsonResponse({ error: "E-mail inválido." }, 400);
  }

  const key = `waitlist:${email}`;
  const already = await env.WAITLIST_KV.get(key);
  if (already) {
    return jsonResponse({ ok: true, already_registered: true });
  }

  const entry = {
    email,
    created_at: new Date().toISOString(),
    source: typeof body.source === "string" ? body.source.slice(0, 80) : "landing",
    user_agent: request.headers.get("user-agent") || "",
    country: request.cf ? request.cf.country : null,
  };

  await env.WAITLIST_KV.put(key, JSON.stringify(entry));

  return jsonResponse({ ok: true });
}

// Listagem dos e-mails cadastrados (uso interno, protegido por token)
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.WAITLIST_KV) {
    return jsonResponse(
      { error: "KV namespace não configurado. Veja o README.md." },
      500
    );
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return jsonResponse({ error: "Não autorizado." }, 401);
  }

  const format = url.searchParams.get("format");
  const entries = [];
  let cursor;

  do {
    const list = await env.WAITLIST_KV.list({ prefix: "waitlist:", cursor });
    for (const key of list.keys) {
      const value = await env.WAITLIST_KV.get(key.name);
      if (value) {
        try {
          entries.push(JSON.parse(value));
        } catch (e) {
          // ignora entradas corrompidas/
        }
      }
    }
    cursor = list.cursor;
    if (list.list_complete) break;
  } while (cursor);

  entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (format === "csv") {
    const header = "email,created_at,source,country\n";
    const rows = entries
      .map((e) => [e.email, e.created_at, e.source, e.country || ""].join(","))
      .join("\n");
    return new Response(header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="agenfy-waitlist.csv"',
      },
    });
  }

  return jsonResponse({ count: entries.length, entries });
}

// Bloqueia outros métodos explicitamente
export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
