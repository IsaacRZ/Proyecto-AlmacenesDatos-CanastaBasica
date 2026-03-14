conda create -n canasta-bigdata python=3.11
conda activate canasta-bigdata


# Core data
pip install pandas pyreadstat openpyxl

# Big Data
pip install pyspark

# Data Warehouse
pip install duckdb

# Modelos predictivos
pip install scikit-learn xgboost prophet shap

# Visualización
pip install plotly matplotlib seaborn

# Jupyter
pip install jupyter notebook ipykernel

# Utilidades
pip install tqdm python-dotenv

# Registrar el kernel en Jupyter
python -m ipykernel install --user --name canasta-bigdata --display-name "Canasta BigData CR"