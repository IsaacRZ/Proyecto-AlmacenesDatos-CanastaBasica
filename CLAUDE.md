# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Big Data project for analyzing and predicting Costa Rica's Basic Food Basket (Canasta Básica Alimentaria - CBA) using INEC public data. Builds a Data Warehouse with 5.4M+ observations from household surveys (2010-2025) and implements predictive models (Prophet for CBA forecasting, XGBoost+SHAP for vulnerability classification).

## Environment Setup

```bash
# Create and activate conda environment
conda create -n canasta-bigdata python=3.11
conda activate canasta-bigdata

# Install all dependencies
pip install -r requirements.txt

# Register kernel for Jupyter
python -m ipykernel install --user --name canasta-bigdata --display-name "Canasta BigData CR"
```

**Note:** `pyarrow` is included in `requirements.txt` and required for Parquet file operations.

## Project Structure

```
canasta-basica-cr/
├── data/
│   ├── raw/           # INEC .sav files (ENAHO, ENIGH)
│   ├── processed/     # Cleaned Parquet files post-ETL
│   └── warehouse/     # Dimensional tables + models + predictions
├── etl/
│   ├── 01_eda.ipynb   # Exploratory data analysis
│   └── 01tel.ipynb    # ENAHO consolidation & cleaning
├── ml/                # Predictive models (Prophet, XGBoost+SHAP)
├── database/          # SQL scripts & analytical queries
├── dashboard/         # Visualizations & dashboards
├── docs/              # Project documentation
├── requirements.txt
├── condaenv.sh
└── README.md
```

## Data Pipeline

```
data/raw/      →  etl/01_eda.ipynb   →  data/processed/
data/processed/ →  etl/01tel.ipynb   →  data/warehouse/
data/warehouse/ →  ml/               →  predicciones/
```

### Data Sources

| Source | Files | Rows | Description |
|--------|-------|------|-------------|
| ENAHO | 11 `.sav` files (2010-2025) | 373,843 | National Household Survey |
| ENIGH | 3 `.sav` files (2024) | 177,972 | Income and Expenditure Survey |

### Key Variables

- **Target (Prophet):** `valor_cba` - monthly CBA value in colones (₡)
- **Target (XGBoost):** `nivel_pobreza` - poverty level classification
- **Critical predictor:** `ingreso_percapita_bruto` - deterministic boundary with target

## Architecture

**Dimensional Model (Star Schema):**
- `dim_tiempo` (11 rows) → `fact_personas` (373,843)
- `dim_region` (6 rows) → `fact_gasto_hogar` (177,972)  
- `dim_hogar` (41 rows) → `fact_crossjoin` (4,859,959)
- `dim_ccif` (13 rows) → `serie_cba_prophet` (11)

The `fact_crossjoin` table joins each ENAHO person with 13 CCIF expenditure divisions from ENIGH, generating Big Data volume.

## Model Results

**Prophet (CBA Forecast):**
- MAPE: 14.0% | RMSE: ₡8,494
- 2026 forecast: ₡60,740 (95% CI: 57,857-63,897)

**XGBoost+SHAP (Vulnerability):**
- ROC-AUC: 0.9998 | F1 vulnerable: 0.98
- High ROC-AUC expected: INEC defines poverty as `ingreso_percapita < linea_pobreza`

## Key Technical Decisions

1. **Data leakage prevention:** Removed `linea_pobreza`, `decil_ingreso`, `quintil_ingreso` from XGBoost model—these are calculated by INEC *from* the poverty level (target), causing information leakage.

2. **Missing years:** 2013, 2014, 2016, 2017, 2019 have no ENAHO data—reduces temporal precision.

3. **Crossjoin assumption:** ENIGH 2024 expenditure structure assumed constant across years.

## Common Operations

```bash
# Run ETL notebooks
jupyter notebook etl/01_eda.ipynb
jupyter notebook etl/01tel.ipynb

# Process ENAHO data
# Requires pyarrow for Parquet output
```

## Technologies

| Layer | Technology |
|-------|------------|
| SPSS ingestion | pyreadstat |
| Processing | Pandas + PySpark |
| Storage | Parquet + DuckDB |
| Time series | Prophet |
| Classification | XGBoost + SHAP |