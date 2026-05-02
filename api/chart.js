// api/chart.js
// Proxy Yahoo Finance chart data (1 an de clôtures journalières)
// Usage : /api/chart?symbol=AAPL&range=1y&interval=1d

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    return res.status(200).end();
  }

  const { symbol = 'AAPL', range = '1y', interval = '1d' } = req.query;

  // Validation basique — évite les injections dans l'URL
  if (!/^[\w\.\^\-]{1,12}$/.test(symbol)) {
    return res.status(400).json({ error: 'Symbole invalide' });
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}&includePrePost=false`;

  try {
    const upstream = await fetch(url, {
      headers: {
        // Yahoo exige un User-Agent navigateur pour répondre
        'User-Agent': 'Mozilla/5.0 (compatible; MarketTrend/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Yahoo a répondu ${upstream.status}` });
    }

    const data = await upstream.json();

    // Cache 5 minutes côté CDN Vercel
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);

  } catch (err) {
    console.error('[chart proxy]', err.message);
    return res.status(502).json({ error: 'Proxy Yahoo Finance indisponible', detail: err.message });
  }
}
