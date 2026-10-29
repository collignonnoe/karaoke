# 🎤 Chante-la — karaoké web

Fais écouter une musique au téléphone : l'app la reconnaît, récupère les paroles et les fait défiler **synchronisées, au bon moment du morceau**, même si la chanson a déjà commencé.

**Démo : https://collignonnoe.github.io/karaoke/**

## Fonctionnalités

- **Reconnaissance musicale par micro** : extrait de 8 s enregistré dans le navigateur, identifié par l'API AudD.
- **Synchro automatique** : la position de l'extrait dans le morceau sert à caler les paroles sur la musique en cours.
- **Paroles synchronisées** : récupérées sur LRCLIB (format LRC), avec la ligne en cours surlignée et un défilement auto.
- **Recalage manuel** : toucher une ligne recale tout le chrono dessus, et des boutons ±0,5 s permettent un réglage fin.
- **Recherche par titre** en secours, sans micro.
- **Pensé pour le téléphone** : installable sur l'écran d'accueil, écran maintenu allumé pendant la lecture.
- **Robustesse** : relances automatiques si l'API est surchargée (HTTP 503), messages d'erreur clairs (micro refusé, morceau inconnu…).

## Architecture

```
Navigateur (GitHub Pages)                       Cloudflare Worker                AudD
  MediaRecorder ── extrait audio ──────────────▶  vérifie l'origine (CORS)  ───▶  reconnaissance
                                                  quota/jour (KV, global + IP)    (clé API secrète)
                ◀──────── titre, artiste, position ──────────────────────────────
  LRCLIB ◀── recherche des paroles synchronisées
  parsing LRC → chrono → affichage
```

- **Front** : un seul fichier `index.html` (HTML/CSS/JS vanilla, sans dépendance).
- **Back** : `server/worker.js`, un proxy serverless qui garde la clé AudD côté serveur. Il n'accepte que les requêtes venant du site et limite les reconnaissances par jour (quota global + quota par IP, stockés dans Workers KV).

## Stack

JavaScript · Web Audio / MediaRecorder · Fetch API · Cloudflare Workers · Workers KV · GitHub Pages · APIs REST (AudD, LRCLIB)

## Lancer en local

Ouvrir `index.html` dans un navigateur suffit pour la recherche par titre. Le micro nécessite HTTPS (ou `localhost`).

## Déployer le serveur

1. Créer un Worker Cloudflare et y coller `server/worker.js`.
2. Lier un namespace KV sous le nom `RL`.
3. Ajouter le secret `AUDD_TOKEN` (clé AudD).
4. Mettre l'URL du Worker dans `WORKER_URL` (`index.html`).
