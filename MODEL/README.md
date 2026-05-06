# Kaggle Deep Learning & AutoML Benchmark: Agricultural Drought Risk

This repository/folder contains the `kaggle_Deep_Learning.ipynb` notebook, which is a complete, end-to-end Machine Learning pipeline designed to predict Agricultural Drought Risk (Vegetation Condition Index - VCI) from satellite imagery and soil data. 

This notebook pits Google's **TabNet (Deep Learning)** against **AutoGluon (Gradient Boosting Ensembles)** to determine the optimal architecture for spatial-tabular data.

## 📓 Notebook Structure & Workflow

The `kaggle_Deep_Learning.ipynb` notebook is broken down into the following logical phases:

### 1. Data Preparation & Feature Engineering
*   **Data Loading:** Imports the pre-processed `train_data_timeseries_prepared.csv` dataset.
*   **Feature Engineering:** Mathematically derives critical remote sensing indices from raw color bands to help the AI understand physical land conditions:
    *   `NDVI` (Normalized Difference Vegetation Index)
    *   `NDWI` (Normalized Difference Water Index)
    *   `SAVI` (Soil Adjusted Vegetation Index)
*   **Outlier Removal:** Utilizes an Unsupervised Machine Learning algorithm (`IsolationForest`) to automatically detect and remove anomalous data points before training.
*   **Out-Of-Time Validation Split:** To prevent the AI from "cheating" with future data, the dataset is split temporally:
    *   **Train Set:** All data from 2018 to 2020.
    *   **Test Set:** Unseen holdout data from 2021.

### 2. Phase 2: AutoGluon (The Champion Model)
*   **Training:** Deploys AutoGluon's `TabularPredictor` using the `high_quality` preset. It utilizes GPU acceleration to train dozens of tree-based models (XGBoost, LightGBM, Random Forest).
*   **Ensembling:** Builds a multi-layer stacking ensemble (`WeightedEnsemble_L3`) by combining the best-performing trees.
*   **Export:** Zips the trained model directory (`autogluon_vci_model.zip`) so it can be downloaded and deployed into a production FastAPI backend.

### 3. Phase 3: TabNet (The Benchmark Model)
*   **Data Scaling:** Applies `StandardScaler` to normalize the tabular data, which is a strict mathematical requirement for Neural Networks.
*   **Network Architecture:** Trains Google's `TabNetRegressor`, a specialized deep learning architecture designed for tabular datasets.
*   **Training Loop & Early Stopping:** The neural network trains over multiple epochs, monitoring the `Validation RMSE`. It utilizes an **Early Stopping** mechanism (patience = 15) to automatically halt training and roll back to the optimal weights before overfitting occurs (stopping at epoch 63, saving epoch 48).

---

## 📊 Final Results (Evaluated on Unseen 2021 Data)

The notebook concludes by evaluating both architectures on the exact same 2021 test set. 

| Model Architecture | R² Score | MAE | RMSE |
| :--- | :--- | :--- | :--- |
| **TabNet** (Deep Learning) | `0.4794` | `13.12` | `13.30` |
| **AutoGluon** (Tree Ensemble) | `0.5899` | `11.60` | `15.80` |

**Conclusion:** The notebook proves computationally that Gradient Boosting Tree Ensembles (AutoGluon) inherently outperform continuous Neural Networks (TabNet) on spatial-tabular data containing sharp physical boundaries.
