// script.js - copie exactement et remplace TON_SCRIPT_ID par ton ID
const API_URL = 'https://script.google.com/macros/s/AKfycbx51MtG45xGTmW0ICdw8HD0vZqgQjxYk1RsZs7SiZEUSl7wySI7J7KDf3M2Ld3tvOEK/exec'; // <-- remplace TON_SCRIPT_ID

/* ===== helpers ===== */
function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return ${y}-${m}-${day};
}
function parseYMD(s) {
  if (!s) return null;
  const p = s.split('-');
  if (p.length !== 3) return null;
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function daysBetween(start, end) {
  const res = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d.setDate(d.getDate() + 1)) {
    res.push(formatYMD(new Date(d)));
  }
  return res;
}
function normalizeApiArray(data) {
  return data.map(item => {
    const date = item.date || item.Date || item.label || item.day || '';
    const amount = (item.sales ?? item.montant ?? item.total ?? item.value ?? item.amount);
    const n = Number(amount) || 0;
    return { date: String(date), value: n };
  });
}

/* ===== process and draw ===== */
function processDataAndDraw(data, start, end) {
  console.log('[processDataAndDraw] raw', data);
  // find candidate arrays
  let rawArray = [];
  if (Array.isArray(data.daily) && data.daily.length >= 0) rawArray = normalizeApiArray(data.daily);
  else if (Array.isArray(data.ventes) && data.ventes.length >= 0) rawArray = normalizeApiArray(data.ventes);
  else if (Array.isArray(data.salesHistory) && data.salesHistory.length >= 0) rawArray = normalizeApiArray(data.salesHistory);
  else if (Array.isArray(data.historiqueVentes) && data.historiqueVentes.length >= 0) rawArray = normalizeApiArray(data.historiqueVentes);
  else if (Array.isArray(data.ventesArray) && data.ventesArray.length >= 0) rawArray = normalizeApiArray(data.ventesArray);
  else rawArray = [];

  // build final labels & values between start and end
  const sDate = parseYMD(start);
  const eDate = parseYMD(end);
  const days = daysBetween(sDate, eDate);
  const map = {};
  rawArray.forEach(p => {
    const dstr = (p.date && p.date.toString().length >= 8) ? p.date.toString() : formatYMD(new Date(p.date));
    map[dstr] = (map[dstr] || 0) + Number(p.value || 0);
  });

  const labels = days;
  const values = days.map(d => Number(map[d] || 0));

  // update KPIs (try multiple field names)
  const totalOrders = data.totalOrders ?? data.totalCommandes ?? data.total_commandes ?? data.totalOrdersCount ?? null;
  const totalSales = data.totalSales ?? data.totalMontant ?? data.total_sales ?? data.totalAmount ?? null;

  const totalOrdersEl = document.getElementById('totalOrders');
  const totalSalesEl = document.getElementById('totalSales');
  if (totalOrdersEl) totalOrdersEl.innerText = (totalOrders !== null) ? totalOrders : (data.totalCommandes ?? 0);
  if (totalSalesEl) totalSalesEl.innerText = ((totalSales !== null) ? totalSales : (data.totalMontant ?? data.totalSales ?? 0)).toLocaleString('fr-FR') + ' FCFA';

  // draw or update chart
  const ctx = document.getElementById('salesChart').getContext('2d');
  if (window.salesChart && typeof window.salesChart.destroy === 'function') window.salesChart.destroy();

  window.salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ventes journalières (FCFA)',
        data: values,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13,110,253,0.12)',
        fill: true,
        tension: 0.2,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display: true, text: 'Date' }, ticks: { maxRotation: 45 } },
        y: {
          title: { display: true, text: 'Montant (FCFA)' },
          min: 0,
          max: 10000000, // 10M
          ticks: {
            callback: function(v) { return Number(v).toLocaleString('fr-FR') + ' FCFA'; }
          }
        }
      }
    }
  });
}

/* ===== JSONP fallback helper ===== */
function jsonpFetch(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const cbName = '_jsonp_cb' + Date.now();
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, timeout);

    function cleanup() {
      clearTimeout(timer);
      script.remove();
      try { delete window[cbName]; } catch(e) { window[cbName] = undefined; }
    }

    window[cbName] = function(data) {
      cleanup();
      resolve(data);
    };

    const sep = url.indexOf('?') === -1 ? '?' : '&';
    script.src = ${url}${sep}callback=${cbName};
    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP load error'));
    };
    document.body.appendChild(script);
  });
}

/* ===== main loader ===== */
async function loadData() {
  try {
    document.getElementById('message').innerText = '';
    const start = document.getElementById('start').value || formatYMD(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const end = document.getElementById('end').value || formatYMD(new Date());
    const url = ${API_URL}?start=${start}&end=${end};
    console.log('[loadData] url=', url);

    // try fetch first
    let data = null;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
      console.log('[loadData] fetched JSON', data);
    } catch (err) {
      console.warn('[loadData] fetch failed, trying JSONP fallback:', err);
      // JSONP fallback (Apps Script supports callback)
      try {
        data = await jsonpFetch(url, 10000);
        console.log('[loadData] JSONP data', data);
      } catch (e) {
        console.error('[loadData] JSONP also failed', e);
        document.getElementById('message').innerText = 'Erreur de chargement des données (fetch & JSONP échoués). Vérifie l’URL du script ou les permissions de déploiement.';
        return;
      }
    }

    // process and draw
    processDataAndDraw(data, start, end);
  } catch (err) {
    console.error('loadData top error', err);
    document.getElementById('message').innerText = 'Erreur inattendue (voir console).';
  }
}

/* ===== attach events & defaults ===== */
window.addEventListener('load', () => {
  // set default period = first day of month -> today
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById('start').value = formatYMD(firstDay);
  document.getElementById('end').value = formatYMD(today);

  // attach click
  const btn = document.getElementById('applyBtn');
  if (btn) btn.addEventListener('click', loadData);

  // pre-size canvas container (so chart shows)
  const canvas = document.getElementById('salesChart');
  canvas.style.width = '100%';
  canvas.style.height = '320px';

  // initial load
  loadData();
});
