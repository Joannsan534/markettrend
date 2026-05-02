// api/quote.js
// Cotation temps réel — Stooq (primaire) + Alpha Vantage (fallback)
// Usage : /api/quote?symbol=AAPL

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }

  const { symbol = 'AAPL' } = req.query;

  if (!/^[\w\.\^\-]{1,12}$/.test(symbol)) {
    return res.status(400).json({ error: 'Symbole invalide' });
  }

  const stooqSym = symbol.startsWith('^')
    ? symbol.toLowerCase().replace('^gspc','^spx').replace('^ftse','^ukx')
    : symbol.toLowerCase() + '.us';

  /* ── Tentative 1 : Stooq quote (last price only) ── */
  try {
    const url = `https://stooq.com/q/l/?s=${stooqSym}&f=sd2t2ohlcv&h&e=csv`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketTrend/1.0)' },
    });

    if (r.ok) {
      const txt = await r.text();
      const lines = txt.trim().split('\n');
      if (lines.length >= 2) {
        const cols = lines[1].split(',');
        // CSV format: Symbol,Date,Time,Open,High,Low,Close,Volume
        const open  = parseFloat(cols[3]);
        const high  = parseFloat(cols[4]);
        const low   = parseFloat(cols[5]);
        const close = parseFloat(cols[6]);
        const vol   = parseInt(cols[7]) || 0;

        if (!isNaN(close) && close > 0 && !isNaN(open) && open > 0) {
          const pct = ((close - open) / open) * 100;
          res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.status(200).json({
            source: 'stooq',
            symbol,
            price: close,
            open,
            dayHigh: high,
            dayLow: low,
            previousClose: open, // meilleure approximation sans historique
            volume: vol,
            change: close - open,
            changePct: pct / 100,
          });
        }
      }
    }
  } catch (e) {
    console.warn('[quote] Stooq failed:', e.message);
  }

  /* ── Tentative 2 : Alpha Vantage quote ── */
  const AV_KEY = process.env.ALPHA_VANTAGE_KEY;
  if (AV_KEY) {
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${AV_KEY}`;
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        const q = j['Global Quote'];
        if (q && q['05. price']) {
          const price = parseFloat(q['05. price']);
          const prev  = parseFloat(q['08. previous close']);
          const chg   = parseFloat(q['09. change']);
          const pct   = parseFloat(q['10. change percent'].replace('%',''));
          res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.status(200).json({
            source: 'alphavantage',
            symbol,
            price,
            open:          parseFloat(q['02. open']),
            dayHigh:       parseFloat(q['03. high']),
            dayLow:        parseFloat(q['04. low']),
            previousClose: prev,
            volume:        parseInt(q['06. volume']),
            change:        chg,
            changePct:     pct / 100,
          });
        }
      }
    } catch (e) {
      console.warn('[quote] Alpha Vantage failed:', e.message);
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(503).json({
    error: 'Cotation indisponible',
    hint: AV_KEY ? 'Toutes les sources ont échoué' : 'Ajoute ALPHA_VANTAGE_KEY en variable Vercel',
  });
}

