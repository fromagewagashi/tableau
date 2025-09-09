async function loadData() {
  const start = document.getElementById("start").value || "2025-09-01";
  const end = document.getElementById("end").value || "2025-09-30";

  // 🔗 Mets ton URL Google Apps Script déployé
  const url = `https://script.google.com/macros/s/AKfycby2kNimrkxan5P_X6kUfF93sPewxO4YwvAVqLn0bNVmgZOQJM2naS6dfS9Y_y_ZEvjQ/exec`;

  const response = await fetch(url);
  const data = await response.json();

  // ✅ Mettre à jour les cartes
  document.getElementById("totalOrders").innerText = data.totalOrders;
  document.getElementById("totalSales").innerText = data.totalSales.toLocaleString("fr-FR") + " FCFA";

  // ✅ Mettre à jour le graphique
  const ctx = document.getElementById("salesChart").getContext("2d");
  if (window.salesChart) {
    window.salesChart.destroy();
  }
  window.salesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.daily.map(item => item.date),
      datasets: [{
        label: "Ventes journalières",
        data: data.daily.map(item => item.sales),
        borderColor: "#0d6efd",
        backgroundColor: "rgba(13,110,253,0.2)",
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { 
          min: 0,
          max: 10000000, // 👈 10 millions
          ticks: {
            callback: function(value) {
              return value.toLocaleString("fr-FR") + " FCFA";
            }
          }
        }
      }
    }
  });
}

// Charger automatiquement au démarrage
window.onload = () => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  document.getElementById("start").value = firstDay.toISOString().split("T")[0];
  document.getElementById("end").value = today.toISOString().split("T")[0];

  loadData();

};
