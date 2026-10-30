/* Live Gold — REAL spot price from gold-api.com (no key, CORS open).
   This is NOT demo data: every point is fetched live from the API.
   Limitation, stated honestly: this free API gives only the CURRENT spot
   price, not past OHLC history. So the line chart starts when you open
   the tab and builds point by point as prices arrive. Swing / BOS / CHOCH
   / TJL-QML levels need past candles, which this API does not provide —
   those levels live on the real TradingView chart in the Live Chart tab. */
(function () {
  var timer = null, series = null, chart = null, last = null;
  function ist(d) { return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }); }
  async function tick() {
    var el = document.getElementById('liveGoldPrice');
    try {
      var r = await fetch('https://api.gold-api.com/price/XAU');
      var j = await r.json();
      var price = Number(j.price);
      var box = document.getElementById('liveGoldBox');
      if (box) box.dataset.loaded = '1';
      if (el) el.innerHTML = 'XAU / USD (spot): <b>$' + price.toFixed(2) + '</b> • Updated: ' + ist(new Date(j.updatedAt || Date.now())) + ' IST • Source: api.gold-api.com (free, no key)';
      if (series) {
        var t = Math.floor(Date.now() / 1000);
        if (t !== last) { series.update({ time: t, value: price }); last = t; }
      }
    } catch (e) { if (el) el.innerHTML = 'Live price load nahi hua, internet check karo aur Refresh dabao.'; }
  }
  window.loadLiveGold = function () {
    var el = document.getElementById('liveGoldChartBox');
    if (el && typeof LightweightCharts !== 'undefined' && !chart) {
      chart = LightweightCharts.createChart(el, { width: el.clientWidth || 800, height: 300, layout: { background: { color: '#0f172a' }, textColor: '#e2e8f0' }, grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } }, timeScale: { timeVisible: true } });
      series = chart.addLineSeries({ color: '#f5b301', lineWidth: 2, title: 'XAU Spot (live)' });
    }
    tick();
    if (!timer) timer = setInterval(tick, 30000);
  };
})();
