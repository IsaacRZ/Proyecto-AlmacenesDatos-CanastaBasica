// ======================================================
// map.js
// Mapa interactivo simple por región — 2025
// Usa DashboardStore.data.porcentajeHistorico
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {
  const mapContainer = document.getElementById("mapRegion");
  if (!mapContainer) return;

  await AppUtils.ensureLeaflet();
  await AppUtils.ensureDashboardData();

  initRegionMap2025();

  setTimeout(() => {
    DashboardStore.map?.invalidateSize?.();
  }, 250);

  window.addEventListener("dashboard:regionSelected", () => {
    refreshRegionMap2025();
  });
});

function initRegionMap2025() {
  const mapContainer = document.getElementById("mapRegion");
  if (!mapContainer || DashboardStore.map) return;

  const map = L.map(mapContainer, {
    zoomControl: true,
    minZoom: 6.5,
    maxZoom: 10,
  }).setView([9.85, -84.15], 7.2);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  }).addTo(map);

  DashboardStore.map = map;
  DashboardStore.mapMarkers = [];

  refreshRegionMap2025();
}

function refreshRegionMap2025() {
  const map = DashboardStore.map;
  if (!map) return;

  DashboardStore.mapMarkers.forEach((marker) => map.removeLayer(marker));
  DashboardStore.mapMarkers = [];

  const rows = DashboardStore.data.porcentajeHistorico || [];
  const coords = AppUtils.getRegionCoords();
  const selectedRegion = DashboardStore.filters?.region || "todas";
  const fixedYear = 2025;

  if (!rows.length) return;

  const cleanRows = rows
    .map((row) => ({
      anio: AppUtils.getYearValue(row, "anio"),
      region: row.region,
      zona: row.zona,
      porcentaje: AppUtils.toNumber(row.porcentaje_ingreso_en_cba),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.anio) &&
        row.anio === fixedYear &&
        row.region !== undefined &&
        row.region !== null &&
        row.region !== "" &&
        Number.isFinite(row.porcentaje)
    );

  if (!cleanRows.length) return;

  // Promedio por región (rural + urbana)
  const resumen = Object.values(
    cleanRows.reduce((acc, row) => {
      const rawRegion = String(row.region).trim();
      const key = rawRegion
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (!acc[key]) {
        acc[key] = {
          region: rawRegion,
          total: 0,
          count: 0,
          zonas: [],
        };
      }

      acc[key].total += row.porcentaje;
      acc[key].count += 1;
      acc[key].zonas.push({
        zona: row.zona,
        porcentaje: row.porcentaje,
      });

      return acc;
    }, {})
  )
    .map((item) => ({
      region: item.region,
      porcentaje: Number((item.total / item.count).toFixed(2)),
      zonas: item.zonas,
    }))
    .sort((a, b) => b.porcentaje - a.porcentaje)
    .map((item, index) => ({
      ...item,
      ranking: index + 1,
    }));

  const top3 = resumen.slice(0, 3).map((item, index) => ({
    ...item,
    ranking: index + 1,
  }));

  renderTopRegionsCards(top3, fixedYear);

  const minValue = Math.min(...resumen.map((r) => r.porcentaje));
  const maxValue = Math.max(...resumen.map((r) => r.porcentaje));

  const normalizeRegionName = (value) =>
    String(value || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  resumen.forEach((item) => {
    const coordEntry = Object.entries(coords).find(([regionName]) =>
      normalizeRegionName(regionName) === normalizeRegionName(item.region)
    );

    if (!coordEntry) return;

    const [regionName, [lat, lon]] = coordEntry;
    const isActive =
      selectedRegion !== "todas" && AppUtils.matchRegion(selectedRegion, regionName);

    const color = getRegionColor(item.ranking, item.porcentaje, minValue, maxValue);
    const radius = getRegionRadius(item.porcentaje, minValue, maxValue);

    const marker = L.circleMarker([lat, lon], {
      radius: isActive ? radius + 4 : radius,
      color,
      weight: isActive ? 3 : 2,
      fillColor: color,
      fillOpacity: isActive ? 0.95 : 0.82,
      opacity: 1,
    }).addTo(map);

    const zonasHtml = item.zonas
      .sort((a, b) => String(a.zona).localeCompare(String(b.zona)))
      .map(
        (z) =>
          `<div style="display:flex;justify-content:space-between;gap:12px;">
            <span>${capitalize(z.zona)}</span>
            <strong>${AppUtils.formatPercent(z.porcentaje, 2)}</strong>
          </div>`
      )
      .join("");

    marker.bindPopup(`
      <div class="region-popup" style="min-width:220px;">
        <h4 style="margin:0 0 8px 0;">${AppUtils.prettifyRegion(item.region)}</h4>
        <p style="margin:0 0 6px 0;"><strong>Año:</strong> ${fixedYear}</p>
        <p style="margin:0 0 6px 0;"><strong>Ranking:</strong> #${item.ranking}</p>
        <p style="margin:0 0 10px 0;"><strong>Promedio regional:</strong> ${AppUtils.formatPercent(item.porcentaje, 2)}</p>
        <div style="border-top:1px solid rgba(255,255,255,0.12); padding-top:8px;">
          ${zonasHtml}
        </div>
      </div>
    `);

    marker.on("mouseover", () => marker.openPopup());

    marker.on("click", () => {
      DashboardStore.selectedRegion = regionName;

      window.dispatchEvent(
        new CustomEvent("dashboard:regionSelected", {
          detail: { region: regionName },
        })
      );
    });

    DashboardStore.mapMarkers.push(marker);
  });

  if (selectedRegion !== "todas") {
    const activeCoords = Object.entries(coords).find(([regionName]) =>
      AppUtils.matchRegion(regionName, selectedRegion)
    );

    if (activeCoords) {
      map.flyTo(activeCoords[1], 8.2, { duration: 0.6 });
    }
  } else {
    map.setView([9.85, -84.15], 7.2);
  }

  setTimeout(() => map.invalidateSize(), 80);
}

function renderTopRegionsCards(topRegions, year) {
  const container = document.getElementById("mapTopRegions");
  if (!container) return;

  if (!topRegions.length) {
    container.innerHTML = `<div class="map-empty-state">No hay datos para ${year}</div>`;
    return;
  }

  container.innerHTML = topRegions
    .map((item) => {
      const medal =
        item.ranking === 1 ? "🥇" : item.ranking === 2 ? "🥈" : "🥉";

      return `
        <button
          class="map-top-card"
          data-region="${item.region}"
          style="
            background: rgba(10,20,34,0.92);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 18px;
            padding: 14px 16px;
            color: #f4f8ff;
            min-width: 180px;
            cursor: pointer;
          "
        >
          <div style="font-size: 20px; margin-bottom: 6px;">${medal}</div>
          <div style="font-size: 13px; opacity: 0.75;">Top ${item.ranking}</div>
          <div style="font-size: 16px; font-weight: 700; margin: 4px 0 8px 0;">
            ${AppUtils.prettifyRegion(item.region)}
          </div>
          <div style="font-size: 20px; font-weight: 800;">
            ${AppUtils.formatPercent(item.porcentaje, 2)}
          </div>
        </button>
      `;
    })
    .join("");

  container.querySelectorAll(".map-top-card").forEach((card) => {
    card.addEventListener("click", () => {
      const region = card.dataset.region;

      window.dispatchEvent(
        new CustomEvent("dashboard:regionSelected", {
          detail: { region },
        })
      );

      refreshRegionMap2025();
    });
  });
}

function getRegionColor(ranking, value, minValue, maxValue) {
  if (ranking === 1) return "#ef4444"; // rojo
  if (ranking === 2) return "#f59e0b"; // naranja
  if (ranking === 3) return "#eab308"; // amarillo

  const range = maxValue - minValue || 1;
  const normalized = (value - minValue) / range;

  if (normalized > 0.66) return "#ec4899";
  if (normalized > 0.33) return "#8b5cf6";
  return "#64748b";
}

function getRegionRadius(value, minValue, maxValue) {
  const range = maxValue - minValue || 1;
  const normalized = (value - minValue) / range;
  return 10 + normalized * 12;
}

function capitalize(value) {
  const text = String(value || "").trim();
  if (!text) return "N/D";
  return text.charAt(0).toUpperCase() + text.slice(1);
}