// ======================================================
// utils.js
// Utilidades globales del dashboard
// ======================================================

(function (global) {
  const DashboardStore = global.DashboardStore || {
    data: {},
    filters: {
      anio: "todos",
      region: "todas",
      zona: "todas",
    },
    chartFilters: {
      main: {
        anio: "todos",
        region: "todas",
        zona: "todas",
      },
      porcentajeHistorico: {
        region: "todas",
        zona: "todas",
      },
      porNivel: {
        anio: "todos",
        zona: "todas",
      },
      prediccionPorcentaje: {
        vista: "historico_prediccion",
      },
      clima: {
        region: "todas",
      },
    },
    charts: {},
    map: null,
    mapMarkers: [],
    selectedRegion: null,
    dataPromise: null,
  };

  const AppUtils = {
    async loadScript(src) {
      const exists = [...document.scripts].some((s) => s.src === src);
      if (exists) return;

      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    },

    async loadStyle(href) {
      const exists = [...document.styleSheets].some((sheet) => sheet.href === href);
      if (exists) return;

      return new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
      });
    },

    async ensureChartJs() {
      if (global.Chart) return;
      await this.loadScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js");
    },

    async ensureLeaflet() {
      if (!global.L) {
        await this.loadStyle("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        await this.loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
      }
    },

    parseCSV(text) {
      if (!text || !text.trim()) return [];

      const raw = text.replace(/^\uFEFF/, "").trim();

      // Evita intentar parsear HTML por error
      if (raw.startsWith("<!DOCTYPE") || raw.startsWith("<html")) {
        console.error("Se recibió HTML en lugar de CSV");
        return [];
      }

      const lines = raw.split(/\r?\n/).filter((line) => line.trim());
      if (!lines.length) return [];

      // Detectar delimitador automáticamente
      const firstLine = lines[0];
      const commaCount = (firstLine.match(/,/g) || []).length;
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      const delimiter = semicolonCount > commaCount ? ";" : ",";

      const headers = this.splitCSVLine(lines[0], delimiter).map((h) =>
        h.replace(/^\uFEFF/, "").trim()
      );

      return lines.slice(1).map((line) => {
        const values = this.splitCSVLine(line, delimiter);
        const row = {};

        headers.forEach((header, index) => {
          row[header] = (values[index] ?? "").trim();
        });

        return row;
      });
    },

    splitCSVLine(line, delimiter = ",") {
      const result = [];
      let current = "";
      let insideQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"' && insideQuotes && next === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === delimiter && !insideQuotes) {
          result.push(current);
          current = "";
        } else {
          current += char;
        }
      }

      result.push(current);
      return result;
    },

    async fetchCSV(path) {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`No se pudo leer el archivo: ${path}`);
      }
      const text = await response.text();
      return this.parseCSV(text);
    },

    async fetchFirstAvailableCSV(paths) {
      for (const path of paths) {
        try {
          return await this.fetchCSV(path);
        } catch (error) {
          console.warn(`[CSV no encontrado] ${path}`);
        }
      }
      return [];
    },

    async fetchFirstAvailableJSON(paths) {
      for (const path of paths) {
        try {
          const response = await fetch(path);
          if (!response.ok) throw new Error("JSON no encontrado");
          return await response.json();
        } catch (error) {
          console.warn(`[JSON no encontrado] ${path}`);
        }
      }
      return null;
    },

    toNumber(value) {
      if (value === null || value === undefined || value === "") return NaN;
      if (typeof value === "number") return value;

      let normalized = String(value).trim();
      if (!normalized) return NaN;

      normalized = normalized
        .replace(/\s/g, "")
        .replace(/₡/g, "")
        .replace(/%/g, "");

      if (normalized.includes(",") && normalized.includes(".")) {
        normalized = normalized.replace(/,/g, "");
      } else if (normalized.includes(",") && !normalized.includes(".")) {
        normalized = normalized.replace(",", ".");
      }

      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : NaN;
    },

    normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
    },

    normalizeRegion(value) {
      return this.normalizeText(value).replace(/\s+/g, "_");
    },

    matchRegion(a, b) {
      return this.normalizeRegion(a) === this.normalizeRegion(b);
    },

    matchZone(a, b) {
      const zoneA = this.normalizeText(a);
      const zoneB = this.normalizeText(b);

      if (zoneB === "urbana") return zoneA.includes("urbana");
      if (zoneB === "rural") return zoneA.includes("rural");

      return zoneA === zoneB;
    },

    getYearValue(row, yearKey = "anio") {
      if (!row) return NaN;

      if (yearKey && yearKey in row) {
        const direct = this.toNumber(row[yearKey]);
        if (Number.isFinite(direct)) return direct;
      }

      if ("anio" in row) {
        const direct = this.toNumber(row.anio);
        if (Number.isFinite(direct)) return direct;
      }

      if ("year" in row) {
        const direct = this.toNumber(row.year);
        if (Number.isFinite(direct)) return direct;
      }

      if ("ds" in row) {
        const match = String(row.ds).match(/\d{4}/);
        if (match) return Number(match[0]);
      }

      return NaN;
    },

    sortByYear(rows, yearKey = "anio") {
      return [...rows].sort((a, b) => this.getYearValue(a, yearKey) - this.getYearValue(b, yearKey));
    },

    unique(values) {
      return [...new Set(values.filter((v) => v !== null && v !== undefined && v !== ""))];
    },

    mean(values) {
      const clean = values.filter((v) => Number.isFinite(v));
      if (!clean.length) return NaN;
      return clean.reduce((sum, v) => sum + v, 0) / clean.length;
    },

    formatCRC(value) {
      if (!Number.isFinite(value)) return "N/D";
      return new Intl.NumberFormat("es-CR", {
        style: "currency",
        currency: "CRC",
        maximumFractionDigits: 0,
      }).format(value);
    },

    formatPercent(value, decimals = 1) {
      if (!Number.isFinite(value)) return "N/D";
      return `${Number(value).toFixed(decimals)}%`;
    },

    formatCompact(value) {
      if (!Number.isFinite(value)) return "N/D";
      return new Intl.NumberFormat("es-CR", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    },

    createGradient(ctx, colorStart, colorEnd) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, colorStart);
      gradient.addColorStop(1, colorEnd);
      return gradient;
    },

    getRegionCoords() {
    return {
      "Central": [9.93, -84.08],
      "Chorotega": [10.63, -85.44],
      "Pacífico Central": [9.63, -84.62],
      "Brunca": [8.65, -83.07],
      "Huetar Atlántica": [9.99, -83.03],
      "Huetar Norte": [10.27, -84.95],
    };
  },

    prettifyRegion(region) {
      if (!region) return "N/D";
      return String(region).replaceAll("_", " ");
    },

    detectRegionKey(rows) {
      if (!rows?.length) return null;
      const sample = rows[0];
      const candidates = ["region", "Region", "región", "region_nombre"];
      return candidates.find((key) => key in sample) || null;
    },

    detectZoneKey(rows) {
      if (!rows?.length) return null;
      const sample = rows[0];
      const candidates = ["zona", "Zona", "area", "Área", "area_tipo"];
      return candidates.find((key) => key in sample) || null;
    },

    detectMainColumns(rows) {
      if (!rows.length) {
        return {
          year: "anio",
          ingreso: "ingreso_percapita_promedio",
          canasta: "cba_promedio",
          porcentaje: "porcentaje_ingreso_en_cba",
        };
      }

      const sample = rows[0];

      return {
        year: "anio" in sample ? "anio" : "year",
        ingreso:
          "ingreso_percapita_promedio" in sample
            ? "ingreso_percapita_promedio"
            : "dinero_promedio_por_persona" in sample
            ? "dinero_promedio_por_persona"
            : "ingreso_promedio" in sample
            ? "ingreso_promedio"
            : Object.keys(sample).find((k) => k.toLowerCase().includes("ingreso")) || "ingreso_percapita_promedio",
        canasta:
          "cba_promedio" in sample
            ? "cba_promedio"
            : "costo_promedio_canasta" in sample
            ? "costo_promedio_canasta"
            : "canasta_basica" in sample
            ? "canasta_basica"
            : Object.keys(sample).find((k) => k.toLowerCase().includes("canasta") || k.toLowerCase().includes("cba")) ||
              "cba_promedio",
        porcentaje:
          "porcentaje_ingreso_en_cba" in sample
            ? "porcentaje_ingreso_en_cba"
            : "porcentaje_dinero_en_canasta" in sample
            ? "porcentaje_dinero_en_canasta"
            : "porcentaje_salario_comida" in sample
            ? "porcentaje_salario_comida"
            : Object.keys(sample).find((k) => k.toLowerCase().includes("porcentaje")) || "porcentaje_ingreso_en_cba",
      };
    },

    detectPredictionColumn(rows) {
      if (!rows.length) return "yhat";
      const sample = rows[0];
      const candidates = [
        "yhat",
        "prediccion",
        "valor_predicho",
        "canasta_predicha",
        "cba_predicha",
        "pronostico",
      ];

      for (const key of candidates) {
        if (key in sample) return key;
      }

      return (
        Object.keys(sample).find(
          (key) =>
            !["anio", "year", "ds", "yhat_lower", "yhat_upper", "lower", "upper"].includes(key)
        ) || "yhat"
      );
    },

    detectPredictionLowerColumn(rows) {
      if (!rows.length) return null;
      const sample = rows[0];
      const candidates = ["yhat_lower", "lower", "inferior"];
      return candidates.find((key) => key in sample) || null;
    },

    detectPredictionUpperColumn(rows) {
      if (!rows.length) return null;
      const sample = rows[0];
      const candidates = ["yhat_upper", "upper", "superior"];
      return candidates.find((key) => key in sample) || null;
    },

    detectPercentageKey(rows) {
      if (!rows.length) return "porcentaje_ingreso_en_cba";
      const sample = rows[0];
      const candidates = [
        "porcentaje_ingreso_en_cba",
        "porcentaje_dinero_en_canasta",
        "porcentaje_salario_comida",
        "porcentaje",
      ];
      return candidates.find((key) => key in sample) || Object.keys(sample).find((k) => k.toLowerCase().includes("porcentaje")) || "porcentaje_ingreso_en_cba";
    },

    filterRows(rows, filters = {}, options = {}) {
      const {
        yearKey = "anio",
        regionKey = this.detectRegionKey(rows),
        zoneKey = this.detectZoneKey(rows),
      } = options;

      return rows.filter((row) => {
        const rowYear = this.getYearValue(row, yearKey);

        if (filters.anio && filters.anio !== "todos") {
          if (String(rowYear) !== String(filters.anio)) return false;
        }

        if (filters.region && filters.region !== "todas" && regionKey) {
          if (!this.matchRegion(row[regionKey], filters.region)) return false;
        }

        if (filters.zona && filters.zona !== "todas" && zoneKey) {
          if (!this.matchZone(row[zoneKey], filters.zona)) return false;
        }

        return true;
      });
    },

    destroyChartByCanvasId(canvasId) {
      Object.entries(DashboardStore.charts).forEach(([key, chart]) => {
        if (chart?.canvas?.id === canvasId) {
          chart.destroy();
          delete DashboardStore.charts[key];
        }
      });
    },

    upsertChart(key, canvasId, config) {
      this.destroyChartByCanvasId(canvasId);

      const canvas = document.getElementById(canvasId);
      if (!canvas || !global.Chart) return null;

      const chart = new Chart(canvas, config);
      DashboardStore.charts[key] = chart;
      return chart;
    },

    renderNoDataChart(canvasId, title = "Sin datos disponibles") {
      const canvas = document.getElementById(canvasId);
      if (!canvas || !global.Chart) return;

      this.upsertChart(`empty_${canvasId}`, canvasId, {
        type: "bar",
        data: {
          labels: [],
          datasets: [],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            title: {
              display: true,
              text: title,
              color: "#f4f8ff",
              font: { size: 16, weight: "700" },
            },
          },
          scales: {
            x: { display: false },
            y: { display: false },
          },
        },
      });
    },

    extractMetric(metrics, paths) {
      if (!metrics) return NaN;

      const list = Array.isArray(paths) ? paths : [paths];

      for (const path of list) {
        const parts = String(path).split(".");
        let current = metrics;

        for (const part of parts) {
          current = current?.[part];
        }

        const value = this.toNumber(current);
        if (Number.isFinite(value)) return value;
      }

      return NaN;
    },

    injectMapMarkerStyles() {
      if (document.getElementById("dashboard-map-marker-styles")) return;

      const style = document.createElement("style");
      style.id = "dashboard-map-marker-styles";
      style.textContent = `
        .custom-region-marker {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4f8cff, #00c2a8);
          border: 2px solid rgba(255,255,255,0.9);
          box-shadow: 0 0 0 0 rgba(79,140,255,0.55);
          animation: pulseMarker 2s infinite;
        }

        .custom-region-marker.active {
          background: linear-gradient(135deg, #ffb84d, #8b5cf6);
          transform: scale(1.2);
        }

        @keyframes pulseMarker {
          0% { box-shadow: 0 0 0 0 rgba(79,140,255,0.5); }
          70% { box-shadow: 0 0 0 14px rgba(79,140,255,0); }
          100% { box-shadow: 0 0 0 0 rgba(79,140,255,0); }
        }

        .leaflet-popup-content-wrapper,
        .leaflet-popup-tip {
          background: rgba(10,20,34,0.95);
          color: #f4f8ff;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 12px 28px rgba(0,0,0,0.35);
        }

        .region-popup h4 {
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }

        .region-popup p {
          margin: 0.2rem 0;
          color: #c7d4e7;
          line-height: 1.5;
        }
      `;
      document.head.appendChild(style);
    },

    async ensureDashboardData() {
      if (DashboardStore.dataPromise) {
        return DashboardStore.dataPromise;
      }

      DashboardStore.dataPromise = (async () => {
        const [
          graficoMain,
          porcentajeHistorico,
          porcentajeIngreso,
          prediccionPorcentaje,
          prediccionCanasta,
          climaRegiones,
          shapRows,
          metrics,
        ] = await Promise.all([
          this.fetchFirstAvailableCSV([
            "../data/grafico_dinero_vs_canasta.csv",
          ]),
          this.fetchFirstAvailableCSV([
            "../data/porcentaje_historico_cba.csv",
          ]),
          this.fetchFirstAvailableCSV([
            "../data/porcentaje_por_ingreso.csv",
            "../data/porcentaje_por_ingreso_cba.csv",
          ]),
          this.fetchFirstAvailableCSV([
            "../data/prediccion_porcentaje_cba.csv",
          ]),
          this.fetchFirstAvailableCSV([
            "../data/prediccion_cba.csv",
            "../data/predicciones_prophet.csv",
          ]),
          this.fetchFirstAvailableCSV([
            "../data/clima_regiones_cr.csv",
            "../data/clima_por_region.csv",
          ]),
          this.fetchFirstAvailableCSV([
            "../data/shap_importancia.csv",
            "../data/shap_importance.csv",
            "../data/shap_importancia_limpia.csv",
          ]),
          this.fetchFirstAvailableJSON([
            "../data/model_metrics.json",
            "../data/metrics.json",
          ]),
        ]);

        DashboardStore.data = {
          graficoMain,
          porcentajeHistorico,
          porcentajeIngreso,
          prediccionPorcentaje,
          prediccionCanasta,
          climaRegiones,
          shapRows,
          metrics,
        };

        return DashboardStore.data;
      })();

      return DashboardStore.dataPromise;
    },
  };

  global.AppUtils = AppUtils;
  global.DashboardStore = DashboardStore;
})(window);