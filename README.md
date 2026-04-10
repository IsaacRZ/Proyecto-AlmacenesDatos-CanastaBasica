# Proyecto Big Data: Análisis y Predicción de la Canasta Básica — Costa Rica

**Curso:** Almacenes de Datos  
**Fecha:** March 2026  
**Stack:** Python 3.11 · PySpark · DuckDB · Prophet · XGBoost · SHAP

---

## Objetivo

Construir un Data Warehouse con más de 2 millones de observaciones a partir
de datos públicos del INEC Costa Rica, para analizar el comportamiento histórico
de la Canasta Básica Alimentaria (CBA) y predecir su evolución 2026–2030.

---

## Fuentes de datos

| Fuente | Archivos | Filas brutas | Descripción |
|--------|----------|-------------|-------------|
| ENAHO  | 11 archivos .sav (2010–2025) | 373,843 | Encuesta Nacional de Hogares — nivel persona |
| ENIGH  | 3 archivos .sav (2024) | 177,972 | Encuesta Ingresos y Gastos — ítems de gasto por hogar |
| **Total DW** | — | **5,411,856** | Incluyendo tabla de crossjoin |

Todos los datos son de acceso público bajo licencia Creative Commons BY-SA 4.0 del INEC.

---

## Arquitectura del Data Warehouse

Modelo dimensional (esquema estrella):
```
DIMENSIONES                    HECHOS
─────────────                  ──────────────────────────
dim_tiempo      (11 filas)  →  fact_personas    (373,843)
dim_region       (6 filas)  →  fact_gasto_hogar (177,972)
dim_hogar       (41 filas)  →  fact_crossjoin (4,859,959)
dim_ccif        (13 filas)  →  serie_cba_prophet    (11)
```

La tabla `fact_crossjoin` cruza cada persona de ENAHO con las
13 divisiones CCIF del ENIGH, generando el volumen Big Data del proyecto.

---

## Pipeline ETL
```
data/raw/          →  etl/01_extract_transform.py  →  data/processed/
data/processed/    →  etl/02_build_warehouse.py    →  data/warehouse/
data/warehouse/    →  models/03_prophet.py         →  predicciones
data/warehouse/    →  models/04_xgboost_shap.py    →  clasificación
```

Reproducción completa:
```bash
pip install -r requirements.txt
jupyter notebook notebooks/01_exploracion.ipynb
```

---

## Resultados del modelo Prophet (CBA)

| Año  | CBA predicha (₡) | Intervalo 95% |
|------|-----------------|---------------|
| 2026 | 60,740          | 57,857–63,897 |
| 2027 | 62,830          | 59,903–65,726 |
| 2028 | 64,920          | 62,226–67,946 |
| 2029 | 67,015          | 63,835–70,110 |
| 2030 | 69,105          | 65,927–72,546 |

**Validación cruzada:** MAPE = 14.0% · RMSE = ₡8,494

**Eventos marcados como changepoints:**
- 2015: cambio metodológico INEC (nueva canasta base) → +15.8%
- 2020: pandemia COVID-19 → variación -0.3% (caída del consumo)
- 2022: inflación post-pandemia → +16.6% (máximo histórico)

---

## Resultados del modelo XGBoost + SHAP (vulnerabilidad)

**ROC-AUC:** 0.9998 · **Accuracy:** 99% · **F1 vulnerable:** 0.98

**Interpretación del ROC-AUC alto:**  
El INEC define pobreza como `ingreso_percapita < linea_pobreza`.
Esta frontera de decisión es casi perfectamente lineal, lo que hace que
`ingreso_percapita_bruto` sea un predictor determinístico del target.
El valor del modelo está en cuantificar los factores secundarios via SHAP.

**Top 5 variables por importancia SHAP:**

| Variable | Impacto SHAP | Interpretación |
|----------|-------------|----------------|
| ingreso_percapita_bruto | 8.31 | Factor determinante principal |
| ingreso_hogar_bruto     | 1.15 | Efecto del tamaño del hogar sobre el ingreso total |
| valor_cba               | 0.93 | A mayor CBA, mayor presión sobre hogares vulnerables |
| zona (urbano/rural)     | 0.69 | Zona rural aumenta el riesgo de vulnerabilidad |
| tam_hogar               | 0.43 | Hogares más grandes tienen mayor exposición |

**Decisión técnica documentada — data leakage:**  
Se removieron `linea_pobreza`, `decil_ingreso` y `quintil_ingreso` del
modelo porque son variables calculadas por el INEC **a partir del**
`nivel_pobreza` (el target). Incluirlas generaría fuga de información
y un modelo inválido para uso predictivo real.

---

## Limitaciones

1. **Serie Prophet con 11 puntos:** años 2013, 2014, 2016, 2017, 2019
   no tienen ENAHO disponible. Los gaps reducen la precisión temporal.
2. **ENIGH de un solo año (2024):** el crossjoin asume que la estructura
   de gasto no cambia entre años, lo cual es una simplificación.
3. **MAPE 14%:** aceptable para series cortas anuales pero insuficiente
   para decisiones de política pública sin series mensuales del IPC.
4. **Datos hasta 2025:** el INEC publica ENAHO con ~6 meses de rezago.

---

## Estructura del proyecto
```
canasta-basica-cr/
├── data/
│   ├── raw/           # Archivos originales INEC (.sav) — no modificar
│   ├── processed/     # Parquets limpios post-ETL
│   └── warehouse/     # Tablas DW + modelos + predicciones
<<<<<<< HEAD
├── etl/
│   ├── 01_eda.ipynb   # Exploratory data analysis
│   └── 01tel.ipynb    # Consolidación ENAHO
├── ml/                # Modelos (Prophet, XGBoost+SHAP)
├── database/          # Scripts SQL
├── dashboard/         # Visualizaciones
├── docs/              # Documentación
=======
├── notebooks/
│   └── 01_exploracion.ipynb
>>>>>>> feature/isaac-refactor
├── requirements.txt
└── README.md
```

---

## Tecnologías

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Ingesta .sav | pyreadstat | Único lector nativo de SPSS en Python |
| Procesamiento | Pandas + PySpark | Pandas para ETL, PySpark para DW >1M filas |
| Almacenamiento | Parquet + DuckDB | Columnar, comprimido, queries SQL rápidas |
| Serie temporal | Prophet (Meta) | Manejo nativo de gaps, changepoints y regressores |
| Clasificación | XGBoost | Mejor rendimiento en datos tabulares estructurados |
| Explicabilidad | SHAP | Interpretación local y global del modelo |
