# Agricultural Drought Risk Prediction (VCI) Pipeline

This repository contains the complete machine learning pipeline for predicting Agricultural Drought Risk (Vegetation Condition Index - VCI) using spatial-temporal satellite data. It includes massive-scale data preprocessing, feature engineering, and a benchmark comparison between AutoGluon (Tree Ensembles) and TabNet (Deep Learning).

## 🗂 Code Structure & Working Explanation

The codebase is divided into three main logical steps: **Data Preprocessing**, **Model Generation**, and **Training/Evaluation**.

### 1. Data Preprocessing
**File:** `preprocess_all_time_data.py`
*   **Purpose:** Handles the processing of 18 massive quarterly raw data files (approx. 20GB total) spanning from 2018 to 2021.
*   **How it works:** 
    *   It loops through all raw `train_data_*_Q*_renamed.csv` files chunk-by-chunk to prevent memory (RAM) crashing.
    *   It extracts the `Year` and `Quarter` natively from the file names and appends them as new temporal features.
    *   It performs critical data cleaning: removing NoData pixels (`-9999`), dropping `NaN`s, and filtering out extreme physical anomalies (e.g., `Thermal < -50`).
    *   It safely samples a fraction of the data (5%) to create a manageable, high-quality unified dataset.
    *   **Output:** `train_data_timeseries_prepared.csv`

### 2. AutoGluon AutoML Pipeline (The Champion Model)
**File:** `generate_notebook.py` -> `train_models_kaggle.ipynb`
*   **Purpose:** The primary predictive engine. `generate_notebook.py` is a Python script that programmatically generates the Kaggle-ready Jupyter Notebook.
*   **How it works (`train_models_kaggle.ipynb`):**
    *   **Feature Engineering:** Calculates advanced agricultural indices from raw spectral bands: NDVI, NDWI, and SAVI (which proved to be the most critical feature).
    *   **Temporal Split:** Prevents temporal data leakage by explicitly splitting the data into a Training set (2018-2020) and an Out-Of-Time Test set (2021).
    *   **Training:** Utilizes `AutoGluon TabularPredictor` on the `high_quality` preset. It internally performs K-Fold bagging on the 2018-2020 data and builds a Multi-Layer Weighted Ensemble from XGBoost, LightGBM, and Random Forests.
    *   **Export:** Automatically evaluates the model on the 2021 unseen data (Outputting RMSE, MAE, R²) and zips the final `autogluon_vci_model` directory for deployment to the GIS web backend.

### 3. Deep Learning Benchmark (The Comparison Model)
**File:** `generate_tabnet_script.py` -> `train_tabnet_kaggle.ipynb`
*   **Purpose:** Provides a deep learning comparison baseline to evaluate against AutoGluon.
*   **How it works (`train_tabnet_kaggle.ipynb`):**
    *   Uses Google's `TabNetRegressor`, a neural network optimized for tabular data.
    *   Performs strict `StandardScaler` transformations (a mathematical requirement for neural networks, unlike tree models).
    *   Trains over 100 epochs using the PyTorch backend, tracking Training vs. Validation Loss, and utilizes Early Stopping to prevent overfitting.
    *   **Result:** Outputs the final R² metric on the 2021 test set, proving computationally that Gradient Boosting Trees (AutoGluon) inherently outperform continuous Neural Networks (TabNet) on spatial-tabular data characterized by sharp geographical boundaries.

---

## 🚀 How to Run the Code

1.  **Preprocess the Data:**
    Place the 18 raw quarterly CSV files into the data directory. Run the preprocessor to generate the unified time-series dataset:
    ```bash
    python preprocess_all_time_data.py
    ```
2.  **Generate the Notebooks:**
    Run the generator scripts to build the Jupyter Notebooks.
    ```bash
    python generate_notebook.py
    python generate_tabnet_script.py
    ```
3.  **Train on Kaggle/GPU:**
    Upload `train_data_timeseries_prepared.csv` and both `.ipynb` notebooks to a GPU-enabled environment (like Kaggle or Google Colab). Run all cells to train the models, output the evaluation metrics, and generate the final exported `.zip` model for production deployment.
