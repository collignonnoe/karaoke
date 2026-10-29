// Mini-serveur Cloudflare Worker pour l'app Karaoké
// - garde la clé AudD secrète (variable AUDD_TOKEN, jamais envoyée au navigateur)
// - n'accepte que les requêtes venant du site GitHub Pages
// - limite à DAILY_TOTAL reconnaissances par jour, tous visiteurs confondus
//
// GET  /  -> { remaining, limit }   (combien d'écoutes il reste aujourd'hui)
// POST /  -> réponse AudD + remaining   (corps : FormData avec "file")

const ALLOWED_ORIGIN = "https://collignonnoe.github.io";
const DAILY_TOTAL = 5;
const MAX_BYTES = 2_000_000;

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
      return fail(`Les ${DAILY_TOTAL} écoutes du jour sont parties. Reviens demain, ou cherche le titre à la main.`, 429, { remaining: 0 });
    }

    let file;
    try { file = (await req.formData()).get("file"); } catch (e) {}
    if (!file || typeof file === "string") return fail("Aucun extrait audio reçu.", 400);
    if (file.size > MAX_BYTES) return fail("Extrait audio trop lourd.", 413);

    const fd = new FormData();
    fd.append("api_token", env.AUDD_TOKEN);
    fd.append("file", file, file.name || "clip.webm");

    let data;
    try {
      data = await (await fetch("https://api.audd.io/", { method: "POST", body: fd })).json();
    } catch (e) {
      return fail("Le service de reconnaissance ne répond pas. Réessaie.", 502);
    }

    await env.RL.put(key, String(used + 1), { expirationTtl: 172800 });
    return json({ ...data, remaining: left - 1, limit: DAILY_TOTAL });
  },
};
