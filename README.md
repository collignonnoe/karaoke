# Chante-la, karaoké web

Fais écouter une musique au téléphone : l'app la reconnaît, récupère les paroles et les fait défiler **synchronisées, au bon moment du morceau**, même si la chanson a déjà commencé.

**Démo : https://collignonnoe.github.io/karaoke/**

## Fonctionnalités

- **Reconnaissance musicale par micro** : extrait de 8 s enregistré dans le navigateur, empreinte audio calculée sur le téléphone, identification via Shazam.
- **Synchro automatique** : la position de l'extrait dans le morceau sert à caler les paroles sur la musique en cours.
- **Paroles synchronisées** : récupérées sur LRCLIB (format LRC), avec la ligne en cours surlignée et un défilement auto.
- **Recalage manuel** : toucher une ligne recale tout le chrono dessus, et des boutons ±0,5 s permettent un réglage fin.
- **Recherche par titre** en secours, sans micro.
- **Pensé pour le téléphone** : installable sur l'écran d'accueil, écran maintenu allumé pendant la lecture.
- **Robustesse** : relances automatiques si une API est surchargée (HTTP 503), messages d'erreur clairs (micro refusé, morceau inconnu…).

## Architecture

```
Navigateur (GitHub Pages)                          Cloudflare Worker            Shazam
  MediaRecorder → décodage → PCM 16 kHz mono
  FFT + pics spectraux → empreinte ─────────────▶  vérifie l'origine (CORS) ─▶  identification
                                                   quota de 5 écoutes/jour (KV)
                ◀──────── titre, artiste, position dans le morceau ─────────────
  LRCLIB ◀── recherche des paroles synchronisées
  parsing LRC → chrono → affichage
```

- **Front** : `index.html` (HTML/CSS/JS vanilla) et `shazam-sig.js`, qui calcule l'empreinte audio (spectrogramme par FFT, extraction des pics par bande de fréquence) directement sur le téléphone.
- **Back** : `server/worker.js`, un proxy serverless (Cloudflare Workers) qui relaie l'empreinte, n'accepte que les requêtes venant du site et limite la démo à 5 reconnaissances par jour (compteur dans Workers KV, affiché en direct dans l'app).
- **Coût** : 0 €. Aucune clé API.

## Stack

JavaScript · Web Audio (MediaRecorder, OfflineAudioContext) · traitement du signal (FFT) · Cloudflare Workers · Workers KV · GitHub Pages · APIs REST (LRCLIB)

## Lancer en local

Ouvrir `index.html` dans un navigateur suffit pour la recherche par titre. Le micro nécessite HTTPS (ou `localhost`).

## Déployer le serveur

1. Créer un Worker Cloudflare et y coller `server/worker.js`.
2. Lier un namespace KV sous le nom `RL`.
3. Mettre l'URL du Worker dans `WORKER_URL` (`index.html`).

## Limites et crédits

- La reconnaissance utilise l'API interne de Shazam, qui n'est ni publique ni officielle : c'est un projet personnel et pédagogique, qui peut cesser de fonctionner si Shazam change son service.
- `shazam-sig.js` est compilé depuis [shazam-api](https://www.npmjs.com/package/shazam-api) (asivery, licence GPL-2.0).
- Paroles : [LRCLIB](https://lrclib.net).
