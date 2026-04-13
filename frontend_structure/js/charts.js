// ======================================================
// charts.js
// Gráficos interactivos del dashboard principal y técnico
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {
  await AppUtils.ensureChartJs();
  await AppUtils.ensureDashboardData();

  setupChartDefaults();

  if (document.getElementById("chartIngresoVsCanasta")) {
    renderDashboardCharts();
    updateKpis();

    window.addEventListener("dashboard:filtersChanged", () => {
      renderDashboardCharts();
      updateKpis();
    });

    window.addEventListener("dashboard:porcentajeHistoricoFiltersChanged", () => {
      renderPorcentajeHistoricoChart();
    });

    window.addEventListener("dashboard:porNivelFiltersChanged", () => {
      renderPorNivelIngresoChart();
    });
  }

  if (document.getElementById("chartValidacionPrediccion")) {
    renderTechnicalDashboard();
  }
});

function setupChartDefaults() {
  Chart.defaults.color = "#c7d4e7";
  Chart.defaults.font.family = '"Segoe UI", "Inter", "Poppins", sans-serif';
  Chart.defaults.font.size = 13;
  Chart.defaults.borderColor = "rgba(255,255,255,0.08)";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.padding = 18;
  Chart.defaults.plugins.legend.labels.font = {
    size: 12,
    weight: "600",
  };
  Chart.defaults.plugins.tooltip.backgroundColor = "rgba(10, 20, 34, 0.96)";
  Chart.defaults.plugins.tooltip.borderColor = "rgba(255,255,255,0.08)";
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 12;
}

function renderDashboardCharts() {
  renderIngresoVsCanastaChart();
  renderPorcentajeHistoricoChart();
  renderPorNivelIngresoChart();
  renderPrediccionPorcentajeChart();
  renderPrediccionCanastaChart();
  renderClimaChart();

  requestChartResize();
}

function renderTechnicalDashboard() {
  renderValidationChart();
  renderMetricsChart();
  renderShapChart();
  updateTechnicalKpis();
  renderTechnicalInsights();

  requestChartResize();
}

function requestChartResize() {
  setTimeout(() => {
    Object.values(DashboardStore.charts).forEach((chart) => chart?.resize?.());
  }, 50);
}

function resolveValue(specific, general, allValue) {
  return specific && specific !== allValue ? specific : general || allValue;
}

function getChartFilters(chartKey) {
  const general = DashboardStore.filters || {};
  const specific = DashboardStore.chartFilters?.[chartKey] || {};

  return {
    anio: resolveValue(specific.anio, general.anio, "todos"),
    region: resolveValue(specific.region, general.region, "todas"),
    zona: resolveValue(specific.zona, general.zona, "todas"),
    vista: specific.vista || "historico_prediccion",
  };
}

function getMainRowsWithFilters(filters) {
  const rows = AppUtils.sortByYear(DashboardStore.data.graficoMain);
  if (!rows.length) return [];

  const cols = AppUtils.detectMainColumns(rows);
  const regionKey = AppUtils.detectRegionKey(rows);
  const zoneKey = AppUtils.detectZoneKey(rows);

  const filtered = AppUtils.filterRows(rows, filters, {
    yearKey: cols.year,
    regionKey,
    zoneKey,
  });

  return filtered.length ? filtered : rows;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function updateKpis() {
  const { prediccionPorcentaje } = DashboardStore.data;

  const rows = AppUtils.sortByYear(DashboardStore.data.graficoMain);
  const cols = AppUtils.detectMainColumns(rows);

  if (!rows.length) return;

  const selectedChartYear = DashboardStore.chartFilters?.main?.anio || "todos";
  const latestMain = rows[rows.length - 1];

  const current =
    selectedChartYear !== "todos"
      ? rows.find((row) => String(AppUtils.getYearValue(row, cols.year)) === String(selectedChartYear)) || latestMain
      : latestMain;

  const predKey = AppUtils.detectPredictionColumn(prediccionPorcentaje);
  const futureRows = prediccionPorcentaje
    .map((row) => ({
      anio: AppUtils.getYearValue(row),
      yhat: AppUtils.toNumber(row[predKey]),
    }))
    .filter((row) => Number.isFinite(row.anio) && Number.isFinite(row.yhat))
    .sort((a, b) => a.anio - b.anio);

  const latestPrediction = futureRows.length ? futureRows[futureRows.length - 1] : null;

  const ingresoValue = AppUtils.toNumber(current[cols.ingreso]);
  const canastaValue = AppUtils.toNumber(current[cols.canasta]);
  const porcentajeValue = AppUtils.toNumber(current[cols.porcentaje]);

  setText("kpiIngresoPromedio", AppUtils.formatCRC(ingresoValue));
  setText("kpiCanastaPromedio", AppUtils.formatCRC(canastaValue));
  setText("kpiPorcentajeCba", AppUtils.formatPercent(porcentajeValue));
  setText("kpiPrediccion", latestPrediction ? AppUtils.formatPercent(latestPrediction.yhat) : "N/D");

  setText("kpiIngresoGrafico", AppUtils.formatCRC(ingresoValue));
  setText("kpiCanastaGrafico", AppUtils.formatCRC(canastaValue));
  setText("kpiPorcentajeGrafico", AppUtils.formatPercent(porcentajeValue));

  window.dispatchEvent(new CustomEvent("dashboard:kpisUpdated"));
}

function baseLineDataset({
  label,
  data,
  borderColor,
  backgroundColor = "transparent",
  yAxisID = "y",
  fill = false,
  dashed = false,
}) {
  return {
    label,
    data,
    yAxisID,
    borderColor,
    backgroundColor,
    fill,
    tension: 0.28,
    pointRadius: 4,
    pointHoverRadius: 8,
    pointHitRadius: 18,
    borderWidth: 3,
    borderDash: dashed ? [8, 6] : [],
  };
}

function buildAxisTitle(text) {
  return {
    display: true,
    text,
    color: "#f4f8ff",
    font: {
      size: 13,
      weight: "700",
    },
  };
}

function renderIngresoVsCanastaChart() {
  const rows = AppUtils.sortByYear(DashboardStore.data.graficoMain);
  const cols = AppUtils.detectMainColumns(rows);
  const canvas = document.getElementById("chartIngresoVsCanasta");

  if (!canvas || !rows.length) {
    return AppUtils.renderNoDataChart("chartIngresoVsCanasta", "No hay datos para el gráfico principal");
  }

  const labels = rows.map((row) => AppUtils.getYearValue(row, cols.year));
  const ingreso = rows.map((row) => AppUtils.toNumber(row[cols.ingreso]));
  const canasta = rows.map((row) => AppUtils.toNumber(row[cols.canasta]));
  const porcentaje = rows.map((row) => AppUtils.toNumber(row[cols.porcentaje]));

  AppUtils.upsertChart("ingresoVsCanasta", "chartIngresoVsCanasta", {
    type: "line",
    data: {
      labels,
      datasets: [
        baseLineDataset({
          label: "Ingreso promedio",
          data: ingreso,
          yAxisID: "y",
          borderColor: "#4f8cff",
          backgroundColor: "rgba(79,140,255,0.10)",
          fill: false,
        }),
        baseLineDataset({
          label: "Canasta básica",
          data: canasta,
          yAxisID: "y",
          borderColor: "#00c2a8",
          backgroundColor: "rgba(0,194,168,0.10)",
          fill: false,
        }),
        baseLineDataset({
          label: "% del ingreso en comida",
          data: porcentaje,
          yAxisID: "y1",
          borderColor: "#ffb84d",
          backgroundColor: "rgba(255,184,77,0.10)",
          fill: false,
        }),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          align: "start",
        },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.dataset.yAxisID === "y1") {
                return `${context.dataset.label}: ${AppUtils.formatPercent(context.raw, 2)}`;
              }
              return `${context.dataset.label}: ${AppUtils.formatCRC(context.raw)}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: buildAxisTitle("Año"),
          ticks: {
            autoSkip: true,
            maxTicksLimit: 10,
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          position: "left",
          title: buildAxisTitle("Monto en colones (₡)"),
          ticks: {
            callback: (value) => AppUtils.formatCompact(value),
          },
        },
        y1: {
          position: "right",
          title: buildAxisTitle("Porcentaje del ingreso (%)"),
          grid: { drawOnChartArea: false },
          ticks: {
            callback: (value) => `${value}%`,
          },
        },
      },
    },
  });
}

function renderPorcentajeHistoricoChart() {
  const sourceRows = DashboardStore.data.porcentajeHistorico.length
    ? AppUtils.sortByYear(DashboardStore.data.porcentajeHistorico)
    : [];

  if (!sourceRows.length) {
    return AppUtils.renderNoDataChart("chartPorcentajeHistorico", "No hay datos históricos");
  }

  const chartFilters = DashboardStore.chartFilters?.porcentajeHistorico || {
    region: "todas",
    zona: "todas",
  };

  const regionKey = AppUtils.detectRegionKey(sourceRows) || "region";
  const zoneKey = AppUtils.detectZoneKey(sourceRows) || "zona";
  const porcentajeKey = AppUtils.detectPercentageKey(sourceRows);

  const cleanRows = sourceRows
    .map((row) => ({
      anio: AppUtils.getYearValue(row, "anio"),
      region: row[regionKey],
      zona: row[zoneKey],
      porcentaje: AppUtils.toNumber(row[porcentajeKey]),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.anio) &&
        row.region !== undefined &&
        row.region !== null &&
        row.region !== "" &&
        Number.isFinite(row.porcentaje)
    );

  const filteredRows = cleanRows.filter((row) => {
    const regionOk =
      chartFilters.region === "todas" ||
      AppUtils.matchRegion(row.region, chartFilters.region);

    const zonaOk =
      chartFilters.zona === "todas" ||
      AppUtils.matchZone(row.zona, chartFilters.zona);

    return regionOk && zonaOk;
  });

  if (!filteredRows.length) {
    return AppUtils.renderNoDataChart(
      "chartPorcentajeHistorico",
      "No hay datos para esos filtros"
    );
  }

  const grouped = new Map();

  filteredRows.forEach((row) => {
    const key = `${row.anio}||${row.region}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(row.porcentaje);
  });

  const years = [...new Set(filteredRows.map((row) => row.anio))].sort((a, b) => a - b);
  const regions = [...new Set(filteredRows.map((row) => row.region))];

  const palette = [
    "rgba(79,140,255,0.82)",
    "rgba(0,194,168,0.82)",
    "rgba(139,92,246,0.82)",
    "rgba(255,184,77,0.82)",
    "rgba(255,107,107,0.82)",
    "rgba(72,187,120,0.82)"
  ];

  const datasets = regions.map((region, index) => {
    const data = years.map((year) => {
      const key = `${year}||${region}`;
      const values = grouped.get(key) || [];
      if (!values.length) return null;

      const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
      return Number(avg.toFixed(2));
    });

    return {
      label: AppUtils.prettifyRegion(region),
      data,
      backgroundColor: palette[index % palette.length],
      borderRadius: 10,
      borderSkipped: false,
      maxBarThickness: 34,
    };
  });

  AppUtils.upsertChart("porcentajeHistorico", "chartPorcentajeHistorico", {
    type: "bar",
    data: {
      labels: years,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top",
          align: "start",
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${AppUtils.formatPercent(context.raw, 2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: false,
          title: buildAxisTitle("Año"),
          ticks: {
            maxRotation: 0,
          },
          grid: {
            color: "rgba(255,255,255,0.05)",
          },
        },
        y: {
          beginAtZero: true,
          title: buildAxisTitle("Porcentaje (%)"),
          ticks: {
            callback: (value) => `${value}%`,
          },
          grid: {
            color: "rgba(255,255,255,0.06)",
          },
        },
      },
    },
  });
}

function renderPorNivelIngresoChart() {
  const sourceRows = DashboardStore.data.porcentajeIngreso.length
    ? AppUtils.sortByYear(DashboardStore.data.porcentajeIngreso)
    : [];

  if (!sourceRows.length) {
    return AppUtils.renderNoDataChart("chartPorNivelIngreso", "No hay datos de desigualdad");
  }

  const chartFilters = DashboardStore.chartFilters?.porNivel || {
    anio: "todos",
    zona: "todas",
  };

  const yearKey = "anio";
  const zoneKey = AppUtils.detectZoneKey(sourceRows) || "zona";
  const levelKey =
    "nivel_ingreso" in sourceRows[0]
      ? "nivel_ingreso"
      : Object.keys(sourceRows[0]).find((k) => k.toLowerCase().includes("nivel")) || "nivel_ingreso";

  const valueKey =
    "porcentaje_ingreso_en_cba" in sourceRows[0]
      ? "porcentaje_ingreso_en_cba"
      : Object.keys(sourceRows[0]).find((k) => k.toLowerCase().includes("porcentaje")) || "porcentaje_ingreso_en_cba";

  const cleanRows = sourceRows
    .map((row) => ({
      anio: AppUtils.getYearValue(row, yearKey),
      zona: row[zoneKey],
      nivel_ingreso: row[levelKey],
      porcentaje: AppUtils.toNumber(row[valueKey]),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.anio) &&
        row.zona !== undefined &&
        row.zona !== null &&
        row.zona !== "" &&
        row.nivel_ingreso !== undefined &&
        row.nivel_ingreso !== null &&
        row.nivel_ingreso !== "" &&
        Number.isFinite(row.porcentaje)
    );

  const filteredRows = cleanRows.filter((row) => {
    const yearOk =
      chartFilters.anio === "todos" ||
      String(row.anio) === String(chartFilters.anio);

    const zonaOk =
      chartFilters.zona === "todas" ||
      AppUtils.matchZone(row.zona, chartFilters.zona);

    return yearOk && zonaOk;
  });

  if (!filteredRows.length) {
    return AppUtils.renderNoDataChart("chartPorNivelIngreso", "No hay datos para esos filtros");
  }

  const ordenNiveles = ["Bajo", "Medio", "Alto"];
  const levels = ordenNiveles.filter((nivel) =>
    filteredRows.some((row) => String(row.nivel_ingreso) === nivel)
  );

  const palette = {
    Bajo: "rgba(255,107,107,0.82)",
    Medio: "rgba(255,184,77,0.82)",
    Alto: "rgba(0,194,168,0.82)",
  };

  // Si hay un año seleccionado: barras simples por nivel
  if (chartFilters.anio !== "todos") {
    const data = levels.map((nivel) => {
      const values = filteredRows
        .filter((row) => row.nivel_ingreso === nivel)
        .map((row) => row.porcentaje);

      if (!values.length) return null;
      const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
      return Number(avg.toFixed(2));
    });

    return AppUtils.upsertChart("porNivelIngreso", "chartPorNivelIngreso", {
      type: "bar",
      data: {
        labels: levels,
        datasets: [
          {
            label: `% del ingreso en ${chartFilters.anio}`,
            data,
            backgroundColor: levels.map((nivel) => palette[nivel] || "rgba(79,140,255,0.82)"),
            borderRadius: 14,
            borderSkipped: false,
            maxBarThickness: 60,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.label}: ${AppUtils.formatPercent(context.raw, 2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: buildAxisTitle("Nivel de ingreso"),
            grid: {
              color: "rgba(255,255,255,0.05)",
            },
          },
          y: {
            beginAtZero: true,
            title: buildAxisTitle("Porcentaje (%)"),
            ticks: {
              callback: (value) => `${value}%`,
            },
            grid: {
              color: "rgba(255,255,255,0.06)",
            },
          },
        },
      },
    });
  }

  // Si el año es "todos": barras agrupadas por año y nivel
  const years = [...new Set(filteredRows.map((row) => row.anio))].sort((a, b) => a - b);

  const datasets = levels.map((nivel) => {
    const data = years.map((year) => {
      const values = filteredRows
        .filter((row) => row.anio === year && row.nivel_ingreso === nivel)
        .map((row) => row.porcentaje);

      if (!values.length) return null;
      const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
      return Number(avg.toFixed(2));
    });

    return {
      label: nivel,
      data,
      backgroundColor: palette[nivel] || "rgba(79,140,255,0.82)",
      borderRadius: 10,
      borderSkipped: false,
      maxBarThickness: 34,
    };
  });

  AppUtils.upsertChart("porNivelIngreso", "chartPorNivelIngreso", {
    type: "bar",
    data: {
      labels: years,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top",
          align: "start",
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${AppUtils.formatPercent(context.raw, 2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: false,
          title: buildAxisTitle("Año"),
          grid: {
            color: "rgba(255,255,255,0.05)",
          },
        },
        y: {
          beginAtZero: true,
          title: buildAxisTitle("Porcentaje (%)"),
          ticks: {
            callback: (value) => `${value}%`,
          },
          grid: {
            color: "rgba(255,255,255,0.06)",
          },
        },
      },
    },
  });
}

function renderPrediccionPorcentajeChart() {
  const actualRows = AppUtils.sortByYear(DashboardStore.data.graficoMain);
  const predRows = AppUtils.sortByYear(DashboardStore.data.prediccionPorcentaje);

  if (!actualRows.length || !predRows.length) {
    return AppUtils.renderNoDataChart("chartPrediccionPorcentaje", "Agrega prediccion_porcentaje_cba.csv");
  }

  const cols = AppUtils.detectMainColumns(actualRows);
  const predKey = AppUtils.detectPredictionColumn(predRows);
  const view = getChartFilters("prediccionPorcentaje").vista;

  const actualSeries = actualRows
    .map((row) => ({
      x: AppUtils.getYearValue(row, cols.year),
      y: AppUtils.toNumber(row[cols.porcentaje]),
    }))
    .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y));

  const predSeries = predRows
    .map((row) => ({
      x: AppUtils.getYearValue(row),
      y: AppUtils.toNumber(row[predKey]),
    }))
    .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y));

  if (!predSeries.length) {
    return AppUtils.renderNoDataChart("chartPrediccionPorcentaje", "No hay predicción válida para porcentaje");
  }

  const datasets = [];

  if (view !== "solo_prediccion") {
    datasets.push({
      ...baseLineDataset({
        label: "Histórico real",
        data: actualSeries,
        borderColor: "#4f8cff",
        backgroundColor: "rgba(79,140,255,0.10)",
        fill: false,
      }),
      parsing: false,
    });
  }

  datasets.push({
    ...baseLineDataset({
      label: view === "solo_prediccion" ? "Predicción del modelo" : "Predicción completa",
      data: predSeries,
      borderColor: "#ffb84d",
      backgroundColor: "rgba(255,184,77,0.12)",
      fill: false,
      dashed: true,
    }),
    parsing: false,
  });

  AppUtils.upsertChart("prediccionPorcentaje", "chartPrediccionPorcentaje", {
    type: "line",
    data: {
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: { position: "top", align: "start" },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.raw?.y ?? context.raw;
              return `${context.dataset.label}: ${AppUtils.formatPercent(value, 2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          title: buildAxisTitle("Año"),
          ticks: {
            precision: 0,
            stepSize: 1,
          },
        },
        y: {
          title: buildAxisTitle("Porcentaje (%)"),
          ticks: {
            callback: (value) => `${value}%`,
          },
        },
      },
    },
  });
}

function renderPrediccionCanastaChart() {
  const actualRows = AppUtils.sortByYear(DashboardStore.data.graficoMain);
  const predRows = AppUtils.sortByYear(DashboardStore.data.prediccionCanasta);

  if (!actualRows.length || !predRows.length) {
    return AppUtils.renderNoDataChart("chartPrediccionCanasta", "Agrega prediccion_cba.csv");
  }

  const cols = AppUtils.detectMainColumns(actualRows);
  const predKey = AppUtils.detectPredictionColumn(predRows);

  const actualSeries = actualRows
    .map((row) => ({
      x: AppUtils.getYearValue(row, cols.year),
      y: AppUtils.toNumber(row[cols.canasta]),
    }))
    .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y));

  const predSeries = predRows
    .map((row) => ({
      x: AppUtils.getYearValue(row),
      y: AppUtils.toNumber(row[predKey]),
    }))
    .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y));

  AppUtils.upsertChart("prediccionCanasta", "chartPrediccionCanasta", {
    type: "line",
    data: {
      datasets: [
        {
          ...baseLineDataset({
            label: "Canasta histórica",
            data: actualSeries,
            borderColor: "#00c2a8",
            backgroundColor: "rgba(0,194,168,0.10)",
            fill: false,
          }),
          parsing: false,
        },
        {
          ...baseLineDataset({
            label: "Predicción de canasta",
            data: predSeries,
            borderColor: "#8b5cf6",
            backgroundColor: "rgba(139,92,246,0.10)",
            fill: false,
            dashed: true,
          }),
          parsing: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: { position: "top", align: "start" },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.raw?.y ?? context.raw;
              return `${context.dataset.label}: ${AppUtils.formatCRC(value)}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          title: buildAxisTitle("Año"),
          ticks: {
            precision: 0,
            stepSize: 1,
          },
        },
        y: {
          title: buildAxisTitle("Costo de canasta (₡)"),
          ticks: {
            callback: (value) => AppUtils.formatCompact(value),
          },
        },
      },
    },
  });
}

function renderClimaChart() {
  const mainRows = AppUtils.sortByYear(DashboardStore.data.graficoMain);
  const climateRows = DashboardStore.data.climaRegiones;

  if (!mainRows.length || !climateRows.length) {
    return AppUtils.renderNoDataChart("chartClima", "Agrega clima_regiones_cr.csv");
  }

  const cols = AppUtils.detectMainColumns(mainRows);
  const regionKey = AppUtils.detectRegionKey(climateRows) || "region";
  const regionFilter = getChartFilters("clima").region;

  let filteredClimate = climateRows;

  if (regionFilter && regionFilter !== "todas") {
    filteredClimate = climateRows.filter((row) => AppUtils.matchRegion(row[regionKey], regionFilter));
  }

  const groupedClimate = AppUtils.unique(filteredClimate.map((row) => AppUtils.getYearValue(row)))
    .map((year) => {
      const rowsOfYear = filteredClimate.filter((row) => AppUtils.getYearValue(row) === year);
      return {
        anio: year,
        lluvia: AppUtils.mean(rowsOfYear.map((row) => AppUtils.toNumber(row.lluvia))),
      };
    })
    .sort((a, b) => a.anio - b.anio);

  const merged = mainRows
    .map((row) => {
      const year = AppUtils.getYearValue(row, cols.year);
      const climate = groupedClimate.find((item) => item.anio === year);

      return {
        anio: year,
        porcentaje: AppUtils.toNumber(row[cols.porcentaje]),
        lluvia: climate ? climate.lluvia : NaN,
      };
    })
    .filter((row) => Number.isFinite(row.porcentaje) && Number.isFinite(row.lluvia));

  if (!merged.length) {
    return AppUtils.renderNoDataChart("chartClima", "No hay cruce válido entre clima y porcentaje");
  }

  AppUtils.upsertChart("clima", "chartClima", {
    type: "line",
    data: {
      labels: merged.map((row) => row.anio),
      datasets: [
        baseLineDataset({
          label: "% del ingreso en canasta",
          data: merged.map((row) => row.porcentaje),
          yAxisID: "y",
          borderColor: "#4f8cff",
          backgroundColor: "rgba(79,140,255,0.10)",
          fill: false,
        }),
        baseLineDataset({
          label: regionFilter !== "todas" ? `Lluvia (${AppUtils.prettifyRegion(regionFilter)})` : "Lluvia promedio",
          data: merged.map((row) => row.lluvia),
          yAxisID: "y1",
          borderColor: "#00c2a8",
          backgroundColor: "rgba(0,194,168,0.10)",
          fill: false,
          dashed: true,
        }),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", align: "start" },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.dataset.yAxisID === "y") {
                return `${context.dataset.label}: ${AppUtils.formatPercent(context.raw, 2)}`;
              }
              return `${context.dataset.label}: ${Number(context.raw).toFixed(2)} mm`;
            },
          },
        },
      },
      scales: {
        x: {
          title: buildAxisTitle("Año"),
        },
        y: {
          position: "left",
          title: buildAxisTitle("Porcentaje (%)"),
          ticks: { callback: (value) => `${value}%` },
        },
        y1: {
          position: "right",
          title: buildAxisTitle("Lluvia (mm)"),
          grid: { drawOnChartArea: false },
          ticks: { callback: (value) => `${value} mm` },
        },
      },
    },
  });
}

function updateTechnicalKpis() {
  const metrics = DashboardStore.data.metrics;

  const rmse =
    AppUtils.extractMetric(metrics, ["rmse", "RMSE", "regression.rmse"]) ||
    computeValidationRmse();

  const accuracy = AppUtils.extractMetric(metrics, ["accuracy", "classification.accuracy"]);
  const precision = AppUtils.extractMetric(metrics, ["precision", "classification.precision"]);
  const recall = AppUtils.extractMetric(metrics, ["recall", "classification.recall"]);

  setText("kpiRmse", Number.isFinite(rmse) ? rmse.toFixed(2) : "N/D");
  setText("kpiAccuracy", Number.isFinite(accuracy) ? `${(accuracy * 100).toFixed(1)}%` : "N/D");
  setText("kpiPrecision", Number.isFinite(precision) ? `${(precision * 100).toFixed(1)}%` : "N/D");
  setText("kpiRecall", Number.isFinite(recall) ? `${(recall * 100).toFixed(1)}%` : "N/D");

  window.dispatchEvent(new CustomEvent("dashboard:kpisUpdated"));
}

function computeValidationRmse() {
  const actualRows = AppUtils.sortByYear(DashboardStore.data.graficoMain);
  const predRows = AppUtils.sortByYear(DashboardStore.data.prediccionPorcentaje);
  if (!actualRows.length || !predRows.length) return NaN;

  const cols = AppUtils.detectMainColumns(actualRows);
  const predKey = AppUtils.detectPredictionColumn(predRows);

  const merged = actualRows
    .map((row) => {
      const year = AppUtils.getYearValue(row, cols.year);
      const pred = predRows.find((item) => AppUtils.getYearValue(item) === year);
      if (!pred) return null;

      return {
        real: AppUtils.toNumber(row[cols.porcentaje]),
        predicho: AppUtils.toNumber(pred[predKey]),
      };
    })
    .filter(Boolean)
    .filter((row) => Number.isFinite(row.real) && Number.isFinite(row.predicho));

  if (!merged.length) return NaN;

  const mse =
    merged.reduce((sum, row) => sum + Math.pow(row.real - row.predicho, 2), 0) / merged.length;

  return Math.sqrt(mse);
}

function renderValidationChart() {
  const actualRows = AppUtils.sortByYear(DashboardStore.data.graficoMain);
  const predRows = AppUtils.sortByYear(DashboardStore.data.prediccionPorcentaje);

  if (!actualRows.length || !predRows.length) {
    return AppUtils.renderNoDataChart("chartValidacionPrediccion", "Agrega prediccion_porcentaje_cba.csv");
  }

  const cols = AppUtils.detectMainColumns(actualRows);
  const predKey = AppUtils.detectPredictionColumn(predRows);

  const merged = actualRows
    .map((row) => {
      const year = AppUtils.getYearValue(row, cols.year);
      const pred = predRows.find((item) => AppUtils.getYearValue(item) === year);
      if (!pred) return null;

      return {
        anio: year,
        real: AppUtils.toNumber(row[cols.porcentaje]),
        predicho: AppUtils.toNumber(pred[predKey]),
      };
    })
    .filter(Boolean)
    .filter((row) => Number.isFinite(row.real) && Number.isFinite(row.predicho));

  if (!merged.length) {
    return AppUtils.renderNoDataChart("chartValidacionPrediccion", "No hay años coincidentes para validar");
  }

  AppUtils.upsertChart("validacionPrediccion", "chartValidacionPrediccion", {
    type: "line",
    data: {
      labels: merged.map((row) => row.anio),
      datasets: [
        baseLineDataset({
          label: "Real",
          data: merged.map((row) => row.real),
          borderColor: "#4f8cff",
          backgroundColor: "rgba(79,140,255,0.12)",
          fill: false,
        }),
        baseLineDataset({
          label: "Predicho",
          data: merged.map((row) => row.predicho),
          borderColor: "#ffb84d",
          backgroundColor: "rgba(255,184,77,0.12)",
          fill: false,
          dashed: true,
        }),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", align: "start" },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${AppUtils.formatPercent(context.raw, 2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: buildAxisTitle("Año"),
        },
        y: {
          title: buildAxisTitle("Porcentaje (%)"),
          ticks: { callback: (value) => `${value}%` },
        },
      },
    },
  });
}

function renderMetricsChart() {
  const metrics = DashboardStore.data.metrics;

  const metricItems = [
    { label: "Accuracy", value: AppUtils.extractMetric(metrics, ["accuracy", "classification.accuracy"]) },
    { label: "Precision", value: AppUtils.extractMetric(metrics, ["precision", "classification.precision"]) },
    { label: "Recall", value: AppUtils.extractMetric(metrics, ["recall", "classification.recall"]) },
    { label: "F1", value: AppUtils.extractMetric(metrics, ["f1", "f1_score", "classification.f1"]) },
  ].filter((item) => Number.isFinite(item.value));

  if (!metricItems.length) {
    return AppUtils.renderNoDataChart("chartMetricasModelo", "Agrega model_metrics.json");
  }

  AppUtils.upsertChart("metricasModelo", "chartMetricasModelo", {
    type: "bar",
    data: {
      labels: metricItems.map((item) => item.label),
      datasets: [
        {
          label: "Métricas (%)",
          data: metricItems.map((item) => item.value * 100),
          backgroundColor: [
            "rgba(79,140,255,0.78)",
            "rgba(0,194,168,0.78)",
            "rgba(139,92,246,0.78)",
            "rgba(255,184,77,0.78)",
          ],
          borderRadius: 14,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${Number(context.raw).toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          title: buildAxisTitle("Métrica"),
        },
        y: {
          title: buildAxisTitle("Valor (%)"),
          suggestedMax: 100,
          ticks: { callback: (value) => `${value}%` },
        },
      },
    },
  });
}

function renderShapChart() {
  const rows = DashboardStore.data.shapRows;
  if (!rows.length) {
    return AppUtils.renderNoDataChart("chartShap", "Agrega shap_importancia.csv");
  }

  const sample = rows[0];
  const featureKey =
    "feature" in sample
      ? "feature"
      : Object.keys(sample).find((key) => key.toLowerCase().includes("feature") || key.toLowerCase().includes("variable")) ||
        Object.keys(sample)[0];

  const valueKey =
    "importance" in sample
      ? "importance"
      : Object.keys(sample).find(
          (key) =>
            key.toLowerCase().includes("importance") ||
            key.toLowerCase().includes("shap") ||
            key.toLowerCase().includes("valor")
        ) || Object.keys(sample)[1];

  const top = rows
    .map((row) => ({
      feature: row[featureKey],
      importance: AppUtils.toNumber(row[valueKey]),
    }))
    .filter((row) => Number.isFinite(row.importance))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10)
    .reverse();

  if (!top.length) {
    return AppUtils.renderNoDataChart("chartShap", "No hay variables SHAP válidas");
  }

  AppUtils.upsertChart("shap", "chartShap", {
    type: "bar",
    data: {
      labels: top.map((row) => row.feature),
      datasets: [
        {
          label: "Importancia",
          data: top.map((row) => row.importance),
          backgroundColor: "rgba(139,92,246,0.8)",
          borderRadius: 12,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return `Importancia: ${Number(context.raw).toFixed(3)}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: buildAxisTitle("Importancia"),
        },
        y: {
          title: buildAxisTitle("Variable"),
        },
      },
    },
  });
}

function renderTechnicalInsights() {
  const target = document.getElementById("technicalInsights");
  if (!target) return;

  const rmse = computeValidationRmse();
  const shapRows = DashboardStore.data.shapRows;
  const metrics = DashboardStore.data.metrics;

  let topFeature = "N/D";

  if (shapRows.length) {
    const sample = shapRows[0];
    const featureKey =
      "feature" in sample
        ? "feature"
        : Object.keys(sample).find((key) => key.toLowerCase().includes("feature") || key.toLowerCase().includes("variable")) ||
          Object.keys(sample)[0];

    const valueKey =
      "importance" in sample
        ? "importance"
        : Object.keys(sample).find(
            (key) =>
              key.toLowerCase().includes("importance") ||
              key.toLowerCase().includes("shap") ||
              key.toLowerCase().includes("valor")
          ) || Object.keys(sample)[1];

    const strongest = shapRows
      .map((row) => ({
        feature: row[featureKey],
        importance: AppUtils.toNumber(row[valueKey]),
      }))
      .filter((row) => Number.isFinite(row.importance))
      .sort((a, b) => b.importance - a.importance)[0];

    if (strongest) topFeature = strongest.feature;
  }

  const accuracy = AppUtils.extractMetric(metrics, ["accuracy", "classification.accuracy"]);
  const recall = AppUtils.extractMetric(metrics, ["recall", "classification.recall"]);

  target.textContent =
    `El modelo técnico muestra un RMSE ${Number.isFinite(rmse) ? `de ${rmse.toFixed(2)}` : "no disponible"}, ` +
    `con una variable dominante identificada como ${topFeature}. ` +
    `${Number.isFinite(accuracy) ? `La accuracy reportada es de ${(accuracy * 100).toFixed(1)}%. ` : ""}` +
    `${Number.isFinite(recall) ? `El recall alcanza ${(recall * 100).toFixed(1)}%. ` : ""}` +
    `Estas métricas ayudan a interpretar el comportamiento predictivo y la consistencia general del análisis.`;
}