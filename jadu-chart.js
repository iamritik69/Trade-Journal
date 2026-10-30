/* JADU Chart v1 — simplified JS port of the user's JADU-TONA logic.
   This is NOT a 1:1 copy of the 2371-line Pine script (full Pine was not
   received in chat, it stopped mid-function). It implements, in JS:
   EMA 132, swing highs/lows, BOS / CHOCH, basic TJL/QML-style levels,
   FVG detection, and Kill Zone session times (IST, as in the Pine inputs).
   Data here is DEMO data, not live gold price. A live feed needs the user's
   own free API key (e.g. TwelveData) or an uploaded OHLC CSV — see the note
   on the tab. Nothing here is a price prediction or trading advice. */
(function () {
  function ema(data, len) {
    var k = 2 / (len + 1), out = [], prev = null;
    data.forEach(function (c, i) {
      prev = prev === null ? c.close : c.close * k + prev * (1 - k);
      out.push(prev);
    });
    return out;
  }
  function demoData() {
    var bars = [], price = 3980, t = Math.floor(Date.now() / 3600000) * 3600 - 200 * 3600;
    var seed = 42;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    for (var i = 0; i < 200; i++) {
      var drift = (rnd() - 0.5) * 12, open = price;
      price = Math.max(3500, price + drift);
      var close = price, high = Math.max(open, close) + rnd() * 4, low = Math.min(open, close) - rnd() * 4;
      bars.push({ time: t + i * 3600, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2) });
    }
    return bars;
  }
  function swings(bars) {
    var s = [];
    for (var i = 2; i < bars.length - 2; i++) {
      if (bars[i].high >= bars[i-1].high && bars[i].high >= bars[i-2].high && bars[i].high >= bars[i+1].high && bars[i].high >= bars[i+2].high)
        s.push({ i: i, type: 'H', price: bars[i].high, time: bars[i].time });
      if (bars[i].low <= bars[i-1].low && bars[i].low <= bars[i-2].low && bars[i].low <= bars[i+1].low && bars[i].low <= bars[i+2].low)
        s.push({ i: i, type: 'L', price: bars[i].low, time: bars[i].time });
    }
    return s.sort(function (a, b) { return a.i - b.i; });
  }
  window.renderJaduChart = function () {
    var el = document.getElementById('jaduChartBox');
    if (!el || el.dataset.loaded) return;
    if (typeof LightweightCharts === 'undefined') { el.innerHTML = '<p>Chart library load nahi hui, internet check karo aur dobara kholo.</p>'; return; }
    el.dataset.loaded = '1';
    var bars = demoData();
    var chart = LightweightCharts.createChart(el, { width: el.clientWidth || 800, height: 520, layout: { background: { color: '#0f172a' }, textColor: '#e2e8f0' }, grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } }, timeScale: { timeVisible: true } });
    var candles = chart.addCandlestickSeries({ upColor: '#4ade80', downColor: '#f87171', wickUpColor: '#4ade80', wickDownColor: '#f87171' });
    candles.setData(bars);
    var emaVals = ema(bars, 132);
    var emaSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2, title: 'EMA 132' });
    emaSeries.setData(bars.map(function (b, i) { return { time: b.time, value: +emaVals[i].toFixed(2) }; }));
    var sw = swings(bars), markers = [], lastHigh = null, lastLow = null, trend = 0;
    sw.forEach(function (s) {
      if (s.type === 'H') {
        if (trend === 1 && lastLow && bars[s.i].close < lastLow.price) { markers.push({ time: s.time, position: 'aboveBar', color: '#f87171', shape: 'arrowDown', text: 'CHOCH' }); trend = -1; }
        else if (trend !== 1 && lastHigh && bars[s.i].close > lastHigh.price) { markers.push({ time: s.time, position: 'aboveBar', color: '#4ade80', shape: 'arrowUp', text: 'BOS' }); trend = 1; }
        lastHigh = s;
      } else {
        if (trend === -1 && lastHigh && bars[s.i].close > lastHigh.price) { markers.push({ time: s.time, position: 'belowBar', color: '#4ade80', shape: 'arrowUp', text: 'CHOCH' }); trend = 1; }
        else if (trend !== -1 && lastLow && bars[s.i].close < lastLow.price) { markers.push({ time: s.time, position: 'belowBar', color: '#f87171', shape: 'arrowDown', text: 'BOS' }); trend = -1; }
        lastLow = s;
      }
    });
    // FVG: gap between bar[i-2].high and bar[i].low (bull) or bar[i-2].low and bar[i].high (bear)
    var fvg = [];
    for (var i = 2; i < bars.length; i++) {
      if (bars[i].low > bars[i-2].high) fvg.push({ time: bars[i].time, text: 'FVG Bull ' + bars[i-2].high.toFixed(1) + '-' + bars[i].low.toFixed(1) });
      if (bars[i].high < bars[i-2].low) fvg.push({ time: bars[i].time, text: 'FVG Bear ' + bars[i].high.toFixed(1) + '-' + bars[i-2].low.toFixed(1) });
    }
    candles.setMarkers(markers.slice(-40));
    if (lastHigh) candles.createPriceLine({ price: lastHigh.price, color: '#f5b301', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Last Swing High (QML/TJL zone)' });
    if (lastLow) candles.createPriceLine({ price: lastLow.price, color: '#f5b301', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Last Swing Low (QML/TJL zone)' });
    var info = document.getElementById('jaduInfo');
    if (info) info.innerHTML = '<p>Bars: ' + bars.length + ' (demo, 1h) • Swings: ' + sw.length + ' • BOS/CHOCH markers: ' + markers.length + ' • FVG found: ' + fvg.length + ' • Last swing high: ' + (lastHigh ? lastHigh.price : '—') + ' • Last swing low: ' + (lastLow ? lastLow.price : '—') + '</p><p>Kill Zones (IST, Pine inputs se): Asia 05:30-08:00 • London 11:30-14:30 • New York 17:30-20:30. FVG list (aakhri 10):</p><p>' + fvg.slice(-10).map(function (f) { return f.text; }).join(' • ') + '</p><p class="small">Ye v1 simplified JS port hai, poora 2371-line Pine nahi hai. ISS, D-CHOCH, MTF dashboard, Level Analyzer abhi port nahi hue hain, kyunki poora Pine code chat me adhoora aaya tha. Live gold price ke liye apni free API key ya OHLC CSV chahiye hogi.</p>';
    chart.timeScale().fitContent();
  };
})();
