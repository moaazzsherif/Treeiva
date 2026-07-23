# Terriva AI Models Training Pipeline
# Trains Random Forest models on real-world datasets and exports them

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, r2_score, mean_squared_error
import joblib
import os

# Create models/ directory if it doesn't exist
os.makedirs("models", exist_ok=True)

# Mappings for categorical variables
CROP_MAP = {"Wheat": 0, "Maize": 1, "Alfalfa": 2, "Cotton": 3}
SOIL_MAP = {"Clay Loam": 0, "Sandy Loam": 1, "Silt Loam": 2}

def train_crop_advisor():
    print("\n--- Training Model A: Crop Advisor ---")
    df = pd.read_csv("data/soil_nutrients_train.csv")
    
    X = df[["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]]
    y = df["crop"].map(CROP_MAP)
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X_train, y_train)
    
    preds = clf.predict(X_test)
    acc = accuracy_score(y_test, preds)
    print(f"Random Forest Classifier Accuracy: {acc*100:.2f}%")
    
    # Save model
    joblib.dump(clf, "models/model_crop_advisor.joblib")
    print("Exported models/model_crop_advisor.joblib")

def train_yield_predictor():
    print("\n--- Training Model B: Yield Predictor ---")
    df = pd.read_csv("data/crop_yield_train.csv")
    
    # Encode categorical columns manually for clean prediction
    df["crop"] = df["crop"].map(CROP_MAP)
    df["soil_type"] = df["soil_type"].map(SOIL_MAP)
    
    X = df[["crop", "soil_type", "ndvi", "moisture", "nitrogen_applied", "phosphorus_applied", "potassium_applied", "area_ha"]]
    y = df["yield_tons_ha"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    reg = RandomForestRegressor(n_estimators=100, random_state=42)
    reg.fit(X_train, y_train)
    
    preds = reg.predict(X_test)
    r2 = r2_score(y_test, preds)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    print(f"Random Forest Regressor R^2 Score: {r2:.4f}")
    print(f"Random Forest Regressor RMSE: {rmse:.4f} tons/ha")
    
    # Save model
    joblib.dump(reg, "models/model_yield_predictor.joblib")
    print("Exported models/model_yield_predictor.joblib")

def train_moisture_forecaster():
    print("\n--- Training Model C: Soil Moisture Forecaster ---")
    df = pd.read_csv("data/soil_moisture_train.csv")
    
    X = df[["temp_max", "temp_min", "humidity", "wind_speed", "precipitation", "evapotranspiration_et0", "soil_moisture_prev"]]
    y = df["soil_moisture_target"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    reg = RandomForestRegressor(n_estimators=100, random_state=42)
    reg.fit(X_train, y_train)
    
    preds = reg.predict(X_test)
    r2 = r2_score(y_test, preds)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    print(f"Random Forest Regressor R^2 Score: {r2:.4f}")
    print(f"Random Forest Regressor RMSE: {rmse:.4f}% Saturation")
    
    # Save model
    joblib.dump(reg, "models/model_moisture_forecaster.joblib")
    print("Exported models/model_moisture_forecaster.joblib")

if __name__ == "__main__":
    train_crop_advisor()
    train_yield_predictor()
    train_moisture_forecaster()
    print("\nAll models trained and exported successfully!")
