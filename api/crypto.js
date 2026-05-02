// api/crypto.js
// Proxy CoinGecko — prix + variation 24h + chart historique
// Usage : /api/crypto?ids=bitcoin,ethereum&action=prices
//         /api/crypto?id=bitcoin&days=365&action=chart

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }

  const { action = 'prices', ids, id, days = '365' } = req.query;

  // Clé CoinGecko Pro optionnelle (plan gratuit fonctionne sans)
  const CG_KEY = process.env.COINGECKO_API_KEY || '';
  const headers = {
    'Accept': 'application/json',
    ...(CG_KEY ? { 'x-cg-pro-api-key': CG_KEY } : {}),
  };
  const base = CG_KEY ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';

  try {
    let url, upstream, data;

    if (action === 'prices') {
      // Prix + variation 24h pour plusieurs coins en batch
      if (!ids) return res.status(400).json({ error: 'ids requis' });
      url = `${base}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
      upstream = await fetch(url, { headers });
      data = await upstream.json();
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');

    } else if (action === 'chart') {
      // Historique OHLC pour un coin
      if (!id) return res.status(400).json({ error: 'id requis' });
      url = `${base}/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
      upstream = await fetch(url, { headers });
      data = await upstream.json();
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');

    } else {
      return res.status(400).json({ error: 'action invalide (prices | chart)' });
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `CoinGecko ${upstream.status}` });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);

  } catch (err) {
    console.error('[crypto proxy]', err.message);
    return res.status(502).json({ error: 'Proxy CoinGecko indisponible', detail: err.message });
  }
}
