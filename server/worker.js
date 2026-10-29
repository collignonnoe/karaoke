// Mini-serveur Cloudflare Worker pour l'app Karaoké
// - reçoit l'empreinte audio calculée dans le navigateur (shazam-sig.js)
// - l'envoie au service de reconnaissance de Shazam (non officiel, aucune clé)
// - n'accepte que les requêtes venant du site GitHub Pages
// - limite à DAILY_TOTAL reconnaissances par jour, tous visiteurs confondus
//
// GET  /health -> { ok, shazam, checkedAt }  (contrôle de santé, sans quota, résultat mis en cache 1 h)
// GET  /  -> { remaining, limit }
// POST /  -> { status, result: { title, artist, timecode }, remaining, limit }
//            corps JSON : { uri, samplems }

const ALLOWED_ORIGIN = "https://collignonnoe.github.io";
const DAILY_TOTAL = 5;

// Empreinte de test (son synthétique) pour vérifier que l'API Shazam répond toujours
const HEALTH_SIG = { uri: "data:audio/vnd.shazam.sig;base64,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", samplems: 5000 };

const uuid = () => crypto.randomUUID().toUpperCase();

async function shazam(uri, samplems) {
  const url = `https://amp.shazam.com/discovery/v5/fr/FR/android/-/tag/${uuid()}/${uuid()}` +
    "?sync=true&webv3=true&sampling=true&connected=&shazamapiversion=v3&sharehub=true&video=v3";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "*/*",
      "Accept-Language": "fr",
      "X-Shazam-Platform": "IPHONE",
      "X-Shazam-AppVersion": "14.1.0",
      "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 13; Pixel 7 Build/TQ3A.230805.001)",
    },
    body: JSON.stringify({
      timezone: "Europe/Paris",
      signature: { uri, samplems },
      timestamp: Date.now(),
      context: {},
      geolocation: {},
    }),
  });
  if (!res.ok) throw new Error("shazam " + res.status);
  return res.json();
}

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
    const fail = (msg, status, extra = {}) =>
      json({ status: "error", error: { error_message: msg }, ...extra }, status);

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    // Contrôle de santé, ouvert à tous mais limité à un vrai appel par heure
    if (new URL(req.url).pathname === "/health") {
      const cached = await env.RL.get("health");
      if (cached) return json(JSON.parse(cached));
      let report;
      try {
        const d = await shazam(HEALTH_SIG.uri, HEALTH_SIG.samplems);
        const ok = Array.isArray(d.matches);
        report = { ok, shazam: ok ? "répond normalement" : "réponse inattendue", checkedAt: new Date().toISOString() };
      } catch (e) {
        report = { ok: false, shazam: "erreur : " + e.message, checkedAt: new Date().toISOString() };
      }
      await env.RL.put("health", JSON.stringify(report), { expirationTtl: 3600 });
      return json(report, report.ok ? 200 : 503);
    }
    if (req.headers.get("Origin") !== ALLOWED_ORIGIN) return fail("Origine non autorisée.", 403);

    // Compteur du jour (Workers KV, effacé automatiquement après 2 jours)
    const key = "total:" + new Date().toISOString().slice(0, 10);
    const used = Number(await env.RL.get(key)) || 0;
    const left = Math.max(0, DAILY_TOTAL - used);

    if (req.method === "GET") return json({ remaining: left, limit: DAILY_TOTAL });
    if (req.method !== "POST") return fail("Méthode non autorisée.", 405);
    if (left === 0) {
      return fail(`Les ${DAILY_TOTAL} écoutes du jour sont parties. Reviens demain, ou cherche le titre à la main.`, 429, { remaining: 0, limit: DAILY_TOTAL });
    }

    let body;
    try { body = await req.json(); } catch (e) {}
    if (!body || typeof body.uri !== "string" || !body.uri.startsWith("data:audio/vnd.shazam.sig;base64,") ||
        body.uri.length > 200_000 || !Number.isFinite(body.samplems)) {
      return fail("Empreinte audio invalide.", 400);
    }

    let data;
    try { data = await shazam(body.uri, Math.round(body.samplems)); }
    catch (e) { return fail("Le service de reconnaissance ne répond pas. Réessaie dans un moment.", 502); }

    await env.RL.put(key, String(used + 1), { expirationTtl: 172800 });
    const meta = { remaining: left - 1, limit: DAILY_TOTAL };

    const match = data.matches && data.matches[0];
    if (!match || !data.track) return json({ status: "success", result: null, ...meta });
    return json({
      status: "success",
      result: { title: data.track.title, artist: data.track.subtitle, timecode: match.offset || 0 },
      ...meta,
    });
  },
};
