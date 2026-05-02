// api/news.js
// Proxy Finnhub — actualités + sentiment marché
// Usage : /api/news?symbol=AAPL&category=company
//         /api/news?category=general  (news macro)
//
// Clé Finnhub gratuite sur https://finnhub.io (60 req/min)
// Variable d'env : FINNHUB_API_KEY

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }

  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

  if (!FINNHUB_KEY) {
    // Pas de clé → retourne données vides proprement (le frontend tombera en mock)
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ articles: [], source: 'no-key' });
  }

  const { symbol, category = 'general' } = req.query;

  // Dates : 7 derniers jours
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  try {
    let url;
    if (symbol) {
      // News spécifique à une action
      if (!/^[A-Z\.\^]{1,10}$/.test(symbol)) {
        return res.status(400).json({ error: 'Symbole invalide' });
      }
      url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${today}&token=${FINNHUB_KEY}`;
    } else {
      // News marché général
      url = `https://finnhub.io/api/v1/news?category=${category}&token=${FINNHUB_KEY}`;
    }

    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Finnhub ${upstream.status}` });
    }

    const raw = await upstream.json();
    const articles = Array.isArray(raw) ? raw : [];

    // Normaliser et limiter à 8 articles
    const normalized = articles.slice(0, 8).map(a => ({
      source: a.source || 'Finnhub',
      headline: a.headline,
      summary: a.summary,
      url: a.url,
      datetime: a.datetime * 1000, // Unix → ms
      // Sentiment approximatif basé sur mots-clés dans le titre
      sentiment: inferSentiment(a.headline + ' ' + (a.summary || '')),
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ articles: normalized, source: 'finnhub' });

  } catch (err) {
    console.error('[news proxy]', err.message);
    return res.status(502).json({ error: 'Proxy news indisponible', detail: err.message });
  }
}

/* Analyse de sentiment simple par mots-clés */
function inferSentiment(text) {
  const t = text.toLowerCase();
  const bullWords = ['surge', 'rally', 'beat', 'record', 'growth', 'profit', 'gain', 'rise', 'bull', 'upgrade', 'buy', 'strong', 'exceeds', 'above'];
  const bearWords = ['crash', 'fall', 'drop', 'loss', 'miss', 'decline', 'bear', 'downgrade', 'sell', 'weak', 'below', 'cut', 'concern', 'risk', 'fear'];
  const bulls = bullWords.filter(w => t.includes(w)).length;
  const bears = bearWords.filter(w => t.includes(w)).length;
  if (bulls > bears) return 'positive';
  if (bears > bulls) return 'negative';
  return 'neutral';
}
