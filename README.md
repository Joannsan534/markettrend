# MarketTrend — Agrégateur de tendances marchés & crypto

Plateforme d'analyse de tendances pour actions, crypto-monnaies et indices. Données en temps réel via proxy backend serverless (Vercel) avec fallback intelligent en mode démo.

## Architecture

```
markettrend-vercel/
├── api/                    # Functions serverless (proxy backend)
│   ├── chart.js            # Yahoo Finance — historique cours actions/indices
│   ├── quote.js            # Yahoo Finance — cotation temps réel
│   ├── crypto.js           # CoinGecko — prix + chart crypto
│   └── news.js             # Finnhub — actualités + sentiment
├── public/
│   └── index.html          # Frontend complet (HTML/CSS/JS)
├── vercel.json             # Configuration routing & headers
├── .env.example            # Variables d'environnement (clés API)
└── README.md
```

## Sources de données

| Source        | Type           | Clé requise | Plan gratuit       |
|---------------|----------------|-------------|--------------------|
| Yahoo Finance | Actions, indices | Non       | Illimité (proxy)   |
| CoinGecko     | Crypto         | Optionnelle | 50 req/min         |
| Finnhub       | News, sentiment | Oui        | 60 req/min         |

## Déploiement Vercel — Étape par étape

### 1. Créer un compte GitHub + Vercel (gratuit)
- https://github.com → créer un compte
- https://vercel.com → "Continue with GitHub"

### 2. Pousser le code sur GitHub

Depuis le dossier décompressé :

```bash
git init
git add .
git commit -m "Initial commit MarketTrend"
git branch -M main

# Créer un repo vide sur GitHub puis :
git remote add origin https://github.com/<ton-user>/markettrend.git
git push -u origin main
```

### 3. Importer sur Vercel
1. Sur https://vercel.com/new, cliquer "Import" sur le repo
2. Laisser les paramètres par défaut (Vercel détecte automatiquement les functions dans `/api`)
3. **Cliquer "Deploy"** — premier déploiement en ~30 secondes

Tu obtiens une URL : `https://markettrend-<hash>.vercel.app`

### 4. (Optionnel) Activer les news Finnhub

Sans clé Finnhub, le panneau news affiche des headlines synthétiques. Pour activer les vraies news :

1. Créer un compte gratuit sur https://finnhub.io
2. Copier la clé API dans le dashboard
3. Sur Vercel : `Settings → Environment Variables`
4. Ajouter `FINNHUB_API_KEY` = ta clé
5. Redéployer (ou attendre 60 sec, Vercel reconstruit automatiquement)

### 5. (Optionnel) CoinGecko Pro

Le plan gratuit CoinGecko (50 req/min) suffit largement. Si besoin de plus :
1. Souscrire à un plan Pro sur https://www.coingecko.com/en/api
2. Ajouter `COINGECKO_API_KEY` dans Environment Variables

## Test en local

Vercel CLI permet de tester les functions serverless localement :

```bash
npm install -g vercel
cd markettrend-vercel
vercel dev
```

Ouvre http://localhost:3000 — tout fonctionne comme en production, y compris les routes `/api/*`.

Sans Vercel CLI, tu peux toujours ouvrir `public/index.html` directement, mais tu seras en mode démo (pas d'API live disponible sans backend).

## Endpoints API

### `GET /api/chart`
Historique cours d'une action ou indice.

**Paramètres :**
- `symbol` (requis) — ex: `AAPL`, `^GSPC`, `^FCHI`
- `range` (optionnel, défaut `1y`) — `1mo`, `3mo`, `1y`, `5y`, `max`
- `interval` (optionnel, défaut `1d`) — `1d`, `1wk`, `1mo`

**Exemple :** `/api/chart?symbol=AAPL&range=2y`

### `GET /api/quote`
Cotation temps réel + fondamentaux.

**Paramètres :**
- `symbol` (requis)

**Exemple :** `/api/quote?symbol=NVDA`

Retourne : prix, variation jour, ouverture, plus-haut/plus-bas, volume, P/E, dividendes, EPS, beta.

### `GET /api/crypto`
Données crypto via CoinGecko.

**Paramètres :**
- `action` — `prices` (batch) ou `chart` (historique)
- `ids` (pour `prices`) — ex: `bitcoin,ethereum,solana`
- `id` (pour `chart`) — ex: `bitcoin`
- `days` (optionnel, défaut `365`)

**Exemples :**
- `/api/crypto?action=prices&ids=bitcoin,ethereum`
- `/api/crypto?action=chart&id=bitcoin&days=90`

### `GET /api/news`
Actualités financières avec analyse de sentiment.

**Paramètres :**
- `symbol` (optionnel) — pour news entreprise
- `category` (défaut `general`) — `general`, `crypto`, `forex`, `merger`

**Exemple :** `/api/news?symbol=TSLA`

## Limites & quotas

- **Vercel Hobby (gratuit)** : 100 GB/mois bande passante, 100 GB-h serverless, largement suffisant
- **Cache CDN** : 60 sec sur quotes, 5 min sur charts → réduit drastiquement les appels API
- **Finnhub gratuit** : 60 req/min → ~3 600 req/heure, suffisant pour usage personnel
- **CoinGecko gratuit** : 50 req/min → idem

## Sécurité

- Les clés API sont stockées en variables d'environnement Vercel, **jamais exposées au client**
- Validation regex sur tous les paramètres utilisateur (anti-injection)
- CORS strict sur `/api/*`
- Rate limiting natif Vercel par IP

## Troubleshooting

**Le panneau news reste vide**
→ Variable `FINNHUB_API_KEY` non définie. Le frontend tombe automatiquement en mode démo.

**Erreur 502 sur les actions**
→ Yahoo Finance peut avoir un downtime ponctuel. Le frontend tombe sur Stooq ou le mock.

**"Mode démo (mock)" en haut malgré le déploiement**
→ Vérifier que les routes `/api/*` répondent : `https://ton-app.vercel.app/api/quote?symbol=AAPL`

## Licence

Concept et code — Sèna Joann Marly Capo-Chichi · 2026

---

Données informatives uniquement. Ne constituent pas un conseil en investissement.
