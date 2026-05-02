// api/chart.js
// Historique cours actions/indices — Stooq (primaire) + Alpha Vantage (fallback)
// Stooq : gratuit, pas de clé, fonctionne côté serveur sans CORS
// Alpha Vantage : 25 req/jour gratuit, clé ALPHA_VANTAGE_KEY en env var
// Usage : /api/chart?symbol=AAPL

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }

  const { symbol = 'AAPL' } = req.query;

  if (!/^[\w\.\^\-]{1,12}$/.test(symbol)) {
    return res.status(400).json({ error: 'Symbole invalide' });
  }

  // Mapping vers symboles Stooq
  const STOOQ_MAP = {
    'AAPL':'^AAPL', 'MSFT':'^MSFT', 'NVDA':'^NVDA', 'GOOGL':'^GOOGL',
    'META':'^META', 'TSLA':'^TSLA', 'AMZN':'^AMZN', 'JPM':'^JPM',
    '^GSPC':'^SPX', '^NDX':'^NDX', '^FCHI':'^FCHI', '^FTSE':'^UKX',
  };
  // Stooq utilise le symbole en minuscule avec .us pour les actions US
  const stooqSym = symbol.startsWith('^')
    ? symbol.toLowerCase().replace('^gspc','^spx').replace('^ftse','^ukx')
    : symbol.toLowerCase() + '.us';

  /* ── Tentative 1 : Stooq CSV (côté serveur, pas de CORS) ── */
  try {
    const url = `https://stooq.com/q/d/l/?s=${stooqSym}&i=d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketTrend/1.0)' },
    });

    if (r.ok) {
      const txt = await r.text();
      if (txt.includes('Date,Open') && txt.length > 100) {
        const lines = txt.trim().split('\n').slice(1);
        const data = [];
        for (const line of lines) {
          const [d, o, h, l, c, v] = line.split(',');
          const close = parseFloat(c);
          if (!close || isNaN(close)) continue;
          data.push({
            date: d,
            open: parseFloat(o) || close,
            high: parseFloat(h) || close,
            low: parseFloat(l) || close,
            close,
            volume: parseInt(v) || 0,
          });
        }
        if (data.length >= 30) {
          res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.status(200).json({ source: 'stooq', symbol, data });
        }
      }
    }
  } catch (e) {
    console.warn('[chart] Stooq failed:', e.message);
  }

  /* ── Tentative 2 : Alpha Vantage (clé optionnelle) ── */
  const AV_KEY = process.env.ALPHA_VANTAGE_KEY;
  if (AV_KEY) {
    try {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${AV_KEY}`;
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        const series = j['Time Series (Daily)'];
        if (series) {
          const data = Object.entries(series)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({
              date,
              open:   parseFloat(v['1. open']),
              high:   parseFloat(v['2. high']),
              low:    parseFloat(v['3. low']),
              close:  parseFloat(v['5. adjusted close']),
              volume: parseInt(v['6. volume']),
            }));
          if (data.length >= 30) {
            res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).json({ source: 'alphavantage', symbol, data });
          }
        }
      }
    } catch (e) {
      console.warn('[chart] Alpha Vantage failed:', e.message);
    }
  }

  /* ── Aucune source disponible ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(503).json({
    error: 'Données indisponibles',
    hint: AV_KEY ? 'Stooq et Alpha Vantage ont échoué' : 'Ajoute ALPHA_VANTAGE_KEY en variable Vercel pour un fallback fiable',
  });
}

