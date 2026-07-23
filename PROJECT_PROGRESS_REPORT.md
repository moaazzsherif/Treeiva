# Terriva AI Training Progress Report

This progress report summarizes the architectural restructuring, pipeline splitting, dataset validation, execution stats, and subsequent roadmap for the **Terriva Project**.

---

## 1. Architectural Reorganization

The repository has been restructured into a clean, modular, and production-ready machine learning directory layout:

```
trevva-ai-training/
├── data/
│   ├── raw/                  # Source raw datasets (Sentinel, DEM, Weather, SoilGrids, LUCAS)
│   ├── processed/            # Intermediate combined datasets (merged_features.csv)
│   ├── features/             # Individual extracted feature CSVs (sentinel2, dem, etc.)
│   ├── metadata/             # Run configuration logs
│   └── final/                # training_dataset.csv & training_dataset.parquet
├── outputs/                  # Exported visuals, scorecards, and reports
│   ├── csv/                  # Output tables
│   ├── maps/                 # Geospatial visualisations
│   ├── figures/              # Metric plots & charts
│   ├── reports/              # Summary PDF/HTML exports
│   ├── metrics/              # Model scoring outputs
│   ├── learning_curves/      # Neural network loss over epochs
│   ├── feature_importance/   # Tree gini / SHAP importance plots
│   └── confusion_matrix/     # Classification performance visualisations
└── models/                   # Persisted estimators & network weights
    ├── machine_learning/     # Tabular estimators (RF, XGBoost, etc.)
    ├── deep_learning/        # CNN & Vision Transformer models
    ├── ensemble/             # Stacking & voting weights
    ├── best/                 # Final production models
    └── experimental/         # Archive of experimental trials
```

---

## 2. Notebook Execution & Verification Summary

The original monolithic notebook `Untitled29.ipynb` was split into **28 modular pipeline notebooks** organized sequentially. Every notebook was executed in a clean environment, resulting in **100% pipeline success**:

| Step | Notebook Path | Duration | Execution Status | Outputs Generated / Actions |
|---|---|---|---|---|
| **00** | `00_project_pipeline.ipynb` | 31.11s | **SUCCESS** | Pipeline documentation, layout definitions, and data flow map. |
| **01** | `01_download_data.ipynb` | 116.74s | **SUCCESS** | Downloads raw source datasets (Sentinel-1/2, ERA5, Weather, SoilGrids, LUCAS). |
| **02** | `02_sentinel2.ipynb` | 33.54s | **SUCCESS** | Sentinel-2 bands, NDWI, NDVI, EVI -> `data/features/sentinel2_features.csv` |
| **03** | `03_sentinel1.ipynb` | 44.75s | **SUCCESS** | Sentinel-1 VV/VH backscatter metrics -> `data/features/sentinel1_features.csv` |
| **04** | `04_dem.ipynb` | 39.93s | **SUCCESS** | Elevation, Aspect, Slope -> `data/features/dem_features.csv` |
| **05** | `05_weather.ipynb` | 150.76s | **SUCCESS** | ERA5 weather time series statistics -> `data/features/weather_features.csv` |
| **06** | `06_soilgrids.ipynb` | 266.06s | **SUCCESS** | Extract local raster values (pH, nitrogen, sand...) -> `data/features/soilgrids_features.csv` |
| **07** | `07_lucas.ipynb` | 30.72s | **SUCCESS** | Cleans LUCAS laboratory soil assays -> `data/features/lucas_labels.csv` |
| **08.01** | `08_feature_engineering/01_merge_features.ipynb` | 12.46s | **SUCCESS** | Combines extracted features horizontally -> `data/processed/merged_features.csv` |
| **08.02** | `08_feature_engineering/02_cleaning.ipynb` | 12.53s | **SUCCESS** | Template: Handles missing values, duplicates, and invalid spatial inputs. |
| **08.03** | `08_feature_engineering/03_scaling.ipynb` | 13.54s | **SUCCESS** | Template: Standardizes and normalizes features. |
| **08.04** | `08_feature_engineering/04_feature_selection.ipynb` | 10.72s | **SUCCESS** | Template: Correlative filtering, RFE, and Mutual Information selection. |
| **08.05** | `08_feature_engineering/05_dataset_validation.ipynb` | 11.12s | **SUCCESS** | Template: Runs strict range, outlier, duplicate, and null-value audits. |
| **08.06** | `08_feature_engineering/06_create_final_dataset.ipynb` | 12.11s | **SUCCESS** | Saves compiled tabular dataset -> `data/final/training_dataset.csv` & `.parquet` |
| **08.07** | `08_feature_engineering/07_create_image_patches.ipynb` | 10.58s | **SUCCESS** | Template: Generates image tensor patches around coordinate offsets for CNNs. |
| **09.00** | `09_training/00_baseline.ipynb` | 10.81s | **SUCCESS** | Template: Dummy and linear baseline model benchmarks. |
| **09.01** | `09_training/01_random_forest.ipynb` | 23.29s | **SUCCESS** | Template: Random Forest regression tuning and logging. |
| **09.02** | `09_training/02_xgboost.ipynb` | 9.89s | **SUCCESS** | Template: XGBoost tree booster training. |
| **09.03** | `09_training/03_catboost.ipynb` | 12.89s | **SUCCESS** | Template: CatBoost categorical-aware tree training. |
| **09.04** | `09_training/04_lightgbm.ipynb` | 11.86s | **SUCCESS** | Template: LightGBM leaf-wise tree booster. |
| **09.05** | `09_training/05_cnn.ipynb` | 10.64s | **SUCCESS** | Template: Convolutional Neural Network on Sentinel spatial patches. |
| **09.06** | `09_training/06_vit.ipynb` | 13.19s | **SUCCESS** | Template: Vision Transformer (ViT) on patch tokens. |
| **09.07** | `09_training/07_multimodal.ipynb` | 11.38s | **SUCCESS** | Template: Fuses Sentinel spatial patch embedding with tabular weather vectors. |
| **09.08** | `09_training/08_ensemble.ipynb` | 10.60s | **SUCCESS** | Template: Stacking meta-regressors combining ML and Deep Learning outputs. |
| **09.09** | `09_training/compare_models.ipynb` | 10.13s | **SUCCESS** | Template: Compiles model performance, R2/RMSE tables, and SHAP importance. |
| **10.01** | `10_prediction/predict_soil.ipynb` | 11.80s | **SUCCESS** | Template: Out-of-sample inference coordinates handler. |
| **10.02** | `10_prediction/fertilizer_recommendation.ipynb` | 36.38s | **SUCCESS** | Template: Computes N-P-K recommendation maps using predicted attributes. |
| **10.03** | `10_prediction/yield_prediction.ipynb` | 53.38s | **SUCCESS** | Template: Fuses predictions with meteorological variables to predict crop yield. |
| **-** | `Untitled29.ipynb` (Original) | 975.27s | **FAILED** | Unaltered developer sandbox. Fails at final cell due to developer's type mismatch in `FarmFeatureExtractor.extract_all()` (*extract_all() missing 5 required arguments*). |

---

## 3. Current Project State

The extraction pipeline has been successfully validated on a single reference spatial location (coordinates `31.083, 30.563` on `2024-05-22`):
- All Sentinel, Weather, DEM, and SoilGrids spatial queries were executed successfully.
- Local raster extraction has been fully repaired (the corrupted SoilGrids `nitrogen.tif` was successfully downloaded with chunked retries and verified).
- Since full feature extraction has not yet been executed for the entire LUCAS sampling point database (338,500 sample locations), downstream training and prediction notebooks are structured as executable templates. They contain the validation statement:
  > *"The extraction pipeline has been validated using a single reference location. Model training will begin after feature extraction has been executed for all LUCAS sampling points."*

---

## 4. Technical Roadmap & Recommendations

To scale up and complete the Terriva Project, the following steps are recommended:

### Phase 1: Distributed Feature Extraction
1. **Parallel Extraction Script**: Convert the feature extraction cells from `02_sentinel2.ipynb` to `06_soilgrids.ipynb` into a unified parallel Python script using a library like `Dask` or `multiprocessing`.
2. **LUCAS Sampling Coordinates**: Read all active coordinates from `data/features/lucas_labels.csv`.
3. **API Rate Limiting & Caching**: Implement local caching of Sentinel images and weather datasets to avoid hitting Copernicus STAC and ERA5 download rate limits.

### Phase 2: Tabular Compilation & Engineering
1. Run `08_feature_engineering/01_merge_features.ipynb` on the multi-row output dataset.
2. Complete data cleaning, scaling, and feature selection using the provided pipeline steps (`02_cleaning.ipynb` to `05_dataset_validation.ipynb`).
3. Output the finalized massive training matrices to `data/final/training_dataset.csv` and `.parquet`.

### Phase 3: Model Training & Evaluation
1. Train and evaluate the models using the structured subdirectories `09_training/` (RF, XGBoost, CNNs, ViT, Multimodal, and Ensemble).
2. Generate validation metrics and compile the comparative model scoring board inside `09_training/compare_models.ipynb`.

### Phase 4: Production Deployment
1. Export the best-performing ensemble models to `models/best/`.
2. Integrate the production models with `10_prediction/` to serve live soil estimations, fertilizer prescription recommendations, and crop yield forecasts.
