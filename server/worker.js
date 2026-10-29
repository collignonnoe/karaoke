// Mini-serveur Cloudflare Worker pour l'app Karaoké
// - reçoit l'empreinte audio calculée dans le navigateur (shazam-sig.js)
// - l'envoie au service de reconnaissance de Shazam (non officiel, aucune clé)
// - n'accepte que les requêtes venant du site GitHub Pages
// - limite à DAILY_TOTAL reconnaissances par jour, tous visiteurs confondus
//
// GET  /  -> { remaining, limit }
// POST /  -> { status, result: { title, artist, timecode }, remaining, limit }
//            corps JSON : { uri, samplems }

const ALLOWED_ORIGIN = "https://collignonnoe.github.io";
const DAILY_TOTAL = 5;

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
