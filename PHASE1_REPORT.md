# Repository Status

- **Folders checked**:
  - `trevva-ai-training/notebooks/`
  - `trevva-ai-training/notebooks/08_feature_engineering/`
  - `trevva-ai-training/notebooks/09_training/`
  - `trevva-ai-training/notebooks/10_prediction/`
  - `trevva-ai-training/data/raw/`
  - `trevva-ai-training/data/features/`
  - `trevva-ai-training/data/processed/`
  - `trevva-ai-training/data/final/`
- **Notebooks checked**:
  - `00_project_pipeline.ipynb`
  - `01_download_data.ipynb`
  - `02_sentinel2.ipynb`
  - `03_sentinel1.ipynb`
  - `04_dem.ipynb`
  - `05_weather.ipynb`
  - `06_soilgrids.ipynb`
  - `07_lucas.ipynb`
  - `08_feature_engineering/01_merge_features.ipynb`
  - `08_feature_engineering/02_cleaning.ipynb`
  - `08_feature_engineering/03_scaling.ipynb`
  - `08_feature_engineering/04_feature_selection.ipynb`
  - `08_feature_engineering/05_dataset_validation.ipynb`
  - `08_feature_engineering/06_create_final_dataset.ipynb`
  - `08_feature_engineering/07_create_image_patches.ipynb`
  - `09_training/00_baseline.ipynb`
  - `09_training/01_random_forest.ipynb`
  - `09_training/02_xgboost.ipynb`
  - `09_training/03_catboost.ipynb`
  - `09_training/04_lightgbm.ipynb`
  - `09_training/05_cnn.ipynb`
  - `09_training/06_vit.ipynb`
  - `09_training/07_multimodal.ipynb`
  - `09_training/08_ensemble.ipynb`
  - `09_training/compare_models.ipynb`
  - `10_prediction/predict_soil.ipynb`
  - `10_prediction/fertilizer_recommendation.ipynb`
  - `10_prediction/yield_prediction.ipynb`
  - `Untitled29.ipynb` (monolithic developmental sandbox)
- **Notebooks fixed**:
  - None in this specific turn (all pipeline notebooks are in a verified, successfully executed status from the previous split).
- **Notebooks skipped**:
  - None.

# Outputs

### Generated CSVs
- `trevva-ai-training/data/features/sentinel2_features.csv`
- `trevva-ai-training/data/features/sentinel1_features.csv`
- `trevva-ai-training/data/features/dem_features.csv`
- `trevva-ai-training/data/features/weather_features.csv`
- `trevva-ai-training/data/features/soilgrids_features.csv`
- `trevva-ai-training/data/features/lucas_labels.csv`
- `trevva-ai-training/data/processed/merged_features.csv`
- `trevva-ai-training/data/final/training_dataset.csv`

### Generated Rasters
- `trevva-ai-training/data/raw/soilgrids/clay.tif`
- `trevva-ai-training/data/raw/soilgrids/nitrogen.tif` (repaired and fully downloaded)
- `trevva-ai-training/data/raw/soilgrids/phh2o.tif`
- `trevva-ai-training/data/raw/soilgrids/sand.tif`
- `trevva-ai-training/data/raw/soilgrids/silt.tif`
- `trevva-ai-training/data/raw/soilgrids/soc.tif`

### Generated Datasets
- `trevva-ai-training/data/final/training_dataset.parquet`

# Current Pipeline

The feature extraction pipeline starts at **`01_download_data.ipynb`** (which downloads raw data, rasters, weather netCDFs, and LUCAS files) and ends at **`08_feature_engineering/06_create_final_dataset.ipynb`** (which packages the compiled spatial features and labels into final CSV and Parquet files ready for model training).

# Remaining blockers

The following blockers prevent running the feature extraction pipeline for **ALL** LUCAS sampling points (18,984 rows in `lucas_labels.csv`):
1. **Hardcoded Coordinates & Dates**: The extraction notebooks (`02_sentinel2.ipynb` through `06_soilgrids.ipynb`) have coordinates (`lon = 31.083`, `lat = 30.563`, `date = "2024-05-22"`) hardcoded in their setup cells instead of pulling from `lucas_labels.csv`.
2. **Missing Loop over LUCAS Points**: There is no iterator or loop to traverse all 18,984 coordinates and target dates.
3. **Planetary Computer Rate Limiting & Network Latency**: Executing sequential STAC API queries for 18,984 points will trigger connection throttling, timeouts, or HTTP 429 errors.
4. **Lack of Multiprocessing/Parallelization**: The extraction code runs on a single thread. Parallelization (using `Dask`, `multiprocessing`, or `joblib`) is missing.
5. **No Caching or Checkpointing**: If the extraction fails or times out mid-run, there is no state tracking or file check to resume from the last successful index, forcing a complete restart.
6. **Limited ERA5 Spatial/Temporal Coverage**: The ERA5 NetCDF files (`era5.nc`, `test.nc`) only contain data covering the single Egyptian reference point coordinate area. They do not cover all European LUCAS sampling point coordinates or the corresponding observation years.
7. **No Output Merge / Distributed Output Handler**: The pipeline does not write intermediate chunked outputs or compile them into a unified feature table at the end of the run.

# Bugs fixed

- None in this turn (the pipeline was split and verified previously, and all 28 pipeline notebooks are running with status `SUCCESS`).

# Files modified

- None.

# Files created

- `trevva-ai-training/data/raw/soilgrids/nitrogen.tif` (repaired)
- `PHASE1_REPORT.md` (this report)

# Ready for Phase 2?

YES
