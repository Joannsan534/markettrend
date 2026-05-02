// api/quote.js
// Proxy Yahoo Finance quote temps réel
// Usage : /api/quote?symbol=AAPL
// Retourne : price, previousClose, dayHigh, dayLow, volume, marketCap, pe, etc.

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }

  const { symbol = 'AAPL' } = req.query;

  if (!/^[\w\.\^\-]{1,12}$/.test(symbol)) {
    return res.status(400).json({ error: 'Symbole invalide' });
  }

  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price,summaryDetail,defaultKeyStatistics`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketTrend/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Yahoo a répondu ${upstream.status}` });
    }

    const data = await upstream.json();

    // Extraire les champs utiles pour simplifier côté frontend
    const price = data?.quoteSummary?.result?.[0]?.price;
    const summary = data?.quoteSummary?.result?.[0]?.summaryDetail;
    const stats = data?.quoteSummary?.result?.[0]?.defaultKeyStatistics;

    if (!price) {
      return res.status(404).json({ error: 'Données indisponibles pour ce symbole' });
    }

    const simplified = {
      symbol: price.symbol,
      name: price.longName || price.shortName,
      price: price.regularMarketPrice?.raw,
      previousClose: price.regularMarketPreviousClose?.raw,
      open: price.regularMarketOpen?.raw,
      dayHigh: price.regularMarketDayHigh?.raw,
      dayLow: price.regularMarketDayLow?.raw,
      volume: price.regularMarketVolume?.raw,
      marketCap: price.marketCap?.raw,
      currency: price.currency,
      exchange: price.exchangeName,
      change: price.regularMarketChange?.raw,
      changePct: price.regularMarketChangePercent?.raw,
      // Fundamentaux
      pe: summary?.trailingPE?.raw,
      forwardPE: summary?.forwardPE?.raw,
      dividendYield: summary?.dividendYield?.raw,
      beta: summary?.beta?.raw,
      // Ratios
      eps: stats?.trailingEps?.raw,
      pbRatio: stats?.priceToBook?.raw,
    };

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(simplified);

  } catch (err) {
    console.error('[quote proxy]', err.message);
    return res.status(502).json({ error: 'Proxy indisponible', detail: err.message });
  }
}
