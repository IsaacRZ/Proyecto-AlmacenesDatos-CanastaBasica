// ======================================================
// filters.js
// Filtros globales y filtros por gráfico
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {
  const anioSelect = document.getElementById("filterChartIngresoAnio");

  if (!anioSelect) return;

  await AppUtils.ensureDashboardData();
  initFilters();
});

function initFilters() {
  const {
  graficoMain,
  porcentajeHistorico,
  porcentajeIngreso,
  prediccionPorcentaje,
  prediccionCanasta,
  climaRegiones
} = DashboardStore.data;

  const yearSource = [
    ...graficoMain.map((row) => AppUtils.getYearValue(row)),
    ...porcentajeHistorico.map((row) => AppUtils.getYearValue(row)),
    ...prediccionPorcentaje.map((row) => AppUtils.getYearValue(row)),
    ...prediccionCanasta.map((row) => AppUtils.getYearValue(row)),
    ...climaRegiones.map((row) => AppUtils.getYearValue(row)),
  ].filter(Number.isFinite);

  const years = AppUtils.unique(yearSource).sort((a, b) => a - b);

  const porcentajeRegionKey = AppUtils.detectRegionKey(porcentajeHistorico);
  const climateRegionKey = AppUtils.detectRegionKey(climaRegiones);

  const regions = porcentajeHistorico.length && porcentajeRegionKey
    ? AppUtils.unique(porcentajeHistorico.map((row) => row[porcentajeRegionKey]))
    : climaRegiones.length && climateRegionKey
    ? AppUtils.unique(climaRegiones.map((row) => row[climateRegionKey]))
    : Object.keys(AppUtils.getRegionCoords());

    const nivelRows = porcentajeIngreso || [];
const nivelZoneKey = AppUtils.detectZoneKey(nivelRows);

const nivelYears = AppUtils.unique(
  nivelRows.map((row) => AppUtils.getYearValue(row))
)
  .filter(Number.isFinite)
  .sort((a, b) => a - b);

const nivelZonas = nivelRows.length && nivelZoneKey
  ? AppUtils.unique(nivelRows.map((row) => row[nivelZoneKey]))
  : ["urbana", "rural"];

  const porcentajeIngresoYears = AppUtils.unique(
    (DashboardStore.data.porcentajeIngreso || [])
      .map((row) => AppUtils.getYearValue(row))
      .filter(Number.isFinite)
  ).sort((a, b) => a - b);

 

  fillSelect("filterChartIngresoAnio", years, "Todos", false, "todos");

  fillSelect("filterChartPorcentajeRegion", regions, "Todas", true, "todas");
  setSelectValue("filterChartPorcentajeZona", DashboardStore.chartFilters.porcentajeHistorico.zona || "todas");

  fillSelect("filterChartNivelAnio", nivelYears, "Todos", false, "todos");
  fillSelect("filterChartNivelZona", nivelZonas, "Todas", false, "todas");
  setSelectValue("filterChartNivelAnio", DashboardStore.chartFilters.porNivel.anio || "todos");
  setSelectValue("filterChartNivelZona", DashboardStore.chartFilters.porNivel.zona || "todas");

  setSelectValue(
    "filterChartPrediccionPctVista",
    DashboardStore.chartFilters.prediccionPorcentaje.vista || "historico_prediccion"
  );

  fillSelect("filterChartClimaRegion", regions, "Todas", true, "todas");

 bindChartFilters();
 bindMapSync();
  emitFilterChange();
}
function bindGeneralFilters() {
  const applyBtn = document.getElementById("btnAplicarFiltros");
  const resetBtn = document.getElementById("btnLimpiarFiltros");

  const anioSelect = document.getElementById("filterAnio");
  const regionSelect = document.getElementById("filterRegion");
  const zonaSelect = document.getElementById("filterZona");

  applyBtn?.addEventListener("click", () => {
    DashboardStore.filters = {
      anio: anioSelect?.value || "todos",
      region: regionSelect?.value || "todas",
      zona: zonaSelect?.value || "todas",
    };

    DashboardStore.selectedRegion =
      DashboardStore.filters.region !== "todas" ? DashboardStore.filters.region : null;

    emitFilterChange();
  });

  resetBtn?.addEventListener("click", () => {
    DashboardStore.filters = {
      anio: "todos",
      region: "todas",
      zona: "todas",
    };

    DashboardStore.chartFilters.main = {
      anio: "todos",
      region: "todas",
      zona: "todas",
    };

    DashboardStore.chartFilters.porcentajeHistorico = {
      region: "todas",
      zona: "todas",
    };

    DashboardStore.chartFilters.porNivel = {
      anio: "todos",
      zona: "todas",
    };

    DashboardStore.chartFilters.prediccionPorcentaje = {
      vista: "historico_prediccion",
    };

    DashboardStore.chartFilters.clima = {
      region: "todas",
    };

    DashboardStore.selectedRegion = null;

    [
      ["filterAnio", "todos"],
      ["filterRegion", "todas"],
      ["filterZona", "todas"],
      ["filterChartIngresoAnio", "todos"],
      ["filterChartPorcentajeRegion", "todas"],
      ["filterChartPorcentajeZona", "todas"],
      ["filterChartNivelAnio", "todos"],
      ["filterChartNivelZona", "todas"],
      ["filterChartPrediccionPctVista", "historico_prediccion"],
      ["filterChartClimaRegion", "todas"],
    ].forEach(([id, value]) => setSelectValue(id, value));

    emitFilterChange();
  });
}

function bindChartFilters() {
  bindSelect("filterChartIngresoAnio", (value) => {
    DashboardStore.chartFilters.main.anio = value;
    emitFilterChange();
  });

  bindSelect("filterChartPorcentajeRegion", (value) => {
  DashboardStore.chartFilters.porcentajeHistorico.region = value;

  window.dispatchEvent(
    new CustomEvent("dashboard:porcentajeHistoricoFiltersChanged", {
      detail: { ...DashboardStore.chartFilters.porcentajeHistorico },
    })
  );
});

bindSelect("filterChartPorcentajeZona", (value) => {
  DashboardStore.chartFilters.porcentajeHistorico.zona = value;

  window.dispatchEvent(
    new CustomEvent("dashboard:porcentajeHistoricoFiltersChanged", {
      detail: { ...DashboardStore.chartFilters.porcentajeHistorico },
    })
  );
});

  bindSelect("filterChartNivelAnio", (value) => {
  DashboardStore.chartFilters.porNivel.anio = value;

  window.dispatchEvent(
    new CustomEvent("dashboard:porNivelFiltersChanged", {
      detail: { ...DashboardStore.chartFilters.porNivel },
    })
  );
});

bindSelect("filterChartNivelZona", (value) => {
  DashboardStore.chartFilters.porNivel.zona = value;

  window.dispatchEvent(
    new CustomEvent("dashboard:porNivelFiltersChanged", {
      detail: { ...DashboardStore.chartFilters.porNivel },
    })
  );
});

  bindSelect("filterChartPrediccionPctVista", (value) => {
    DashboardStore.chartFilters.prediccionPorcentaje.vista = value;
    emitFilterChange();
  });

  bindSelect("filterChartClimaRegion", (value) => {
    DashboardStore.chartFilters.clima.region = value;
    emitFilterChange();
  });
}

function bindMapSync() {
  window.addEventListener("dashboard:regionSelected", (event) => {
    const region = event.detail?.region || "todas";

    DashboardStore.filters.region = region;
    DashboardStore.selectedRegion = region !== "todas" ? region : null;

    setSelectValue("filterChartPorcentajeRegion", region);
    setSelectValue("filterChartClimaRegion", region);

    DashboardStore.chartFilters.porcentajeHistorico.region = region;
    DashboardStore.chartFilters.clima.region = region;

    emitFilterChange();
  });
}

function bindSelect(id, callback) {
  const select = document.getElementById(id);
  if (!select) return;

  select.addEventListener("change", () => callback(select.value));
}

function fillSelect(id, values, allLabel, prettifyRegion = false, defaultValue = "todas") {
  const select = document.getElementById(id);
  if (!select) return;

  const currentValue = select.value || defaultValue;
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = defaultValue;
  defaultOption.textContent = allLabel;
  select.appendChild(defaultOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = prettifyRegion ? AppUtils.prettifyRegion(String(value)) : String(value);
    select.appendChild(option);
  });

  select.value = [...select.options].some((opt) => opt.value === currentValue)
    ? currentValue
    : defaultValue;
}

function setSelectValue(id, value) {
  const select = document.getElementById(id);
  if (!select) return;

  const exists = [...select.options].some((option) => option.value === value);
  if (exists) {
    select.value = value;
  }
}

function emitFilterChange() {
  window.dispatchEvent(
    new CustomEvent("dashboard:filtersChanged", {
      detail: {
        filters: { ...DashboardStore.filters },
        chartFilters: { ...DashboardStore.chartFilters },
      },
    })
  );
}