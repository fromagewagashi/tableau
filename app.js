// script.js (version robuste)
// Assure-toi d'avoir <input id="start"> et <input id="end"> et <canvas id="salesChart">

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYMD(s) {
  if (!s) return null;
  const p = s.split('-');
  if (p.length !== 3) return null;
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function daysBetween(start, end) {
  const res = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
       d <= end;
       d.setDate(d.getDate() + 1)) {
    res.push(formatYMD(new Date(d)));
  }
  return res;
}

function normalizeApiArray(data) {
  // data: array of objects with date and some sales field
  return data.map(item => {
    const date = item.date || item.Date || item.label || item.day || '';
    // possible keys for amount
    const amount = (item.sales ?? item.montant ?? item.salesAmount ?? item.value ?? item.total ?? item.amount);
    const n = Number(amount) || 0;
    return { date: String(date), value: n };
  });
}

async function loadData() {
  try {
    const startInput = document.getElementById('start');
    const endInput = document.getElementById('end');
    const start = startInput && startInput.value ? startInput.value : formatYMD(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const end = endInput && endInput.value ? endInput.value : formatYMD(new Date());

    // mets ton URL Apps Script ici
    const API_URL = 'https://script.google.com/macros/s/AKfycbx51MtG45xGTmW0ICdw8HD0vZqgQjxYk1RsZs7SiZEUSl7wySI7J7KDf3M2Ld3tvOEK/exec';
    const url = `${API_URL}?start=${start}&end=${end}`;

    console.log('[loadData] fetch url=', url);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Erreur réseau: ' + res.status + ' ' + res.statusText);
    const data = await res.json();
    console.log('[loadData] api response:', data);

    // Trouver le tableau contenant les jours
    let rawArray = null;
    if (Array.isArray(data.daily) && data.daily.length >= 0) rawArray = normalizeApiArray(data.daily);
    else if (Array.isArray(data.ventes) && data.ventes.length >= 0) rawArray = normalizeApiArray(data.ventes);
    else if (Array.isArray(data.salesHistory) && data.salesHistory.length >= 0) rawArray = normalizeApiArray(data.salesHistory);
    else if (Array.isArray(data.historiqueVentes) && data.historiqueVentes.length >= 0) rawArray = normalizeApiArray(data.historiqueVentes);
    else if (Array.isArray(data.ventesArray) && data.ventesArray.length >= 0) rawArray = normalizeApiArray(data.ventesArray);
    else rawArray = [];

    // Si API ne fournit pas les jours (ou array vide), on génère la plage start->end
    let labels = [];
    let values = [];

    if (rawArray.length === 0) {
      // génère jours entre start et end
      const sDate = parseYMD(start);
      const eDate = parseYMD(end);
      const days = daysBetween(sDate, eDate);
      labels = days;
      values = days.map(_ => 0);
      console.log('[loadData] tableau vide -> génération jours', days.length);
    } else {
      // Normaliser : s'assurer qu'on a un point pour chaque jour entre start et end
      // Construire map date->value
      const map = {};
      rawArray.forEach(p => {
        // normaliser date string au format YYYY-MM-DD si possible
        const dstr = (p.date && p.date.toString().length >= 8) ? p.date.toString() : formatYMD(new Date(p.date));
        map[dstr] = (map[dstr] || 0) + Number(p.value || 0);
      });

      // Build full day list from start->end then pull values (0 si absent)
      const sDate = parseYMD(start);
      const eDate = parseYMD(end);
      const days = daysBetween(sDate, eDate);
      labels = days;
      values = days.map(d => Number(map[d] || 0));
      console.log('[loadData] labels/values length', labels.length, values.length);
    }

    // mettre à jour les KPI (avec plusieurs noms acceptés)
    const totalOrders = data.totalOrders ?? data.totalCommandes ?? data.total_commandes ?? null;
    const totalSales = data.totalSales ?? data.totalMontant ?? data.total_sales ?? data.totalAmount ?? null;

    const totalOrdersEl = document.getElementById('totalOrders');
    const totalSalesEl = document.getElementById('totalSales');

    if (totalOrdersEl) totalOrdersEl.innerText = (totalOrders !== null) ? totalOrders : (data.totalCommandes ?? 0);
    if (totalSalesEl) totalSalesEl.innerText = ((totalSales !== null) ? totalSales : (data.totalMontant ?? data.totalSales ?? 0)).toLocaleString('fr-FR') + ' FCFA';

    // Dessiner / mettre à jour Chart.js
    const ctx = document.getElementById('salesChart').getContext('2d');
    if (window.salesChart && typeof window.salesChart.destroy === 'function') {
      window.salesChart.destroy();
    }

    window.salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ventes journalières (FCFA)',
          data: values,
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13,110,253,0.15)',
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
          x: {
            title: { display: true, text: 'Date' },
            ticks: { maxRotation: 45, minRotation: 0 }
          },
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

  } catch (err) {
    console.error('loadData error:', err);
    // Affiche message simple si tu veux
    const ct = document.getElementById('chart-container') || document.body;
    // optionnel: afficher un message d'erreur visible à l'écran
    let errEl = document.getElementById('fetch-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = 'fetch-error';
      errEl.style.color = 'red';
      errEl.style.textAlign = 'center';
      errEl.style.marginTop = '10px';
      ct.appendChild(errEl);
    }
    errEl.innerText = 'Erreur chargement données (voir console).';
  }
}

// Charger par défaut au onload
window.onload = function() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById('start').value = formatYMD(first);
  document.getElementById('end').value = formatYMD(today);

  // Assure que canvas a une hauteur pour que Chart.js affiche (ex: 300px)
  const canvas = document.getElementById('salesChart');
  canvas.style.width = '100%';
  canvas.style.height = '320px';

  loadData();
};
