// Mini-serveur Cloudflare Worker pour l'app Karaoké
// - cache la clé AudD (secret AUDD_TOKEN, jamais visible côté navigateur)
// - n'accepte que les requêtes venant de ton site GitHub Pages
// - limite le nombre de reconnaissances par jour (au total et par personne)

const ALLOWED_ORIGIN = "https://collignonnoe.github.io";
const DAILY_TOTAL = 10;   // reconnaissances max par jour, tous visiteurs confondus
const DAILY_PER_IP = 3;   // reconnaissances max par jour et par visiteur
const MAX_BYTES = 2_000_000;

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
    const fail = (msg, status) => json({ status: "error", error: { error_message: msg } }, status);

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return fail("Méthode non autorisée.", 405);
    if (req.headers.get("Origin") !== ALLOWED_ORIGIN) return fail("Origine non autorisée.", 403);

    // Compteurs du jour (stockés dans Workers KV, effacés automatiquement après 2 jours)
    const day = new Date().toISOString().slice(0, 10);
    const ip = req.headers.get("CF-Connecting-IP") || "inconnu";
    const kTotal = `total:${day}`, kIp = `ip:${day}:${ip}`;
    const [total, mine] = (await Promise.all([env.RL.get(kTotal), env.RL.get(kIp)])).map(v => Number(v) || 0);

    if (total >= DAILY_TOTAL) return fail("La démo a atteint sa limite du jour. Reviens demain, ou utilise la recherche par titre.", 429);
    if (mine >= DAILY_PER_IP) return fail(`Tu as utilisé tes ${DAILY_PER_IP} reconnaissances du jour. La recherche par titre reste dispo.`, 429);

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

    const ttl = { expirationTtl: 172800 };
    await Promise.all([env.RL.put(kTotal, String(total + 1), ttl), env.RL.put(kIp, String(mine + 1), ttl)]);
    return json(data);
  },
};
