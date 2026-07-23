# Terriva Agricultural Dataset Generator
# Generates realistic CSV datasets for ML training

import pandas as pd
import numpy as np
import os

# Create data/ directory if it doesn't exist
os.makedirs("data", exist_ok=True)

# Set random seed for reproducibility
np.random.seed(42)
n_samples = 1500

print("Generating soil_nutrients_train.csv...")
# 1. Soil Nutrients & Crop Suitability Dataset
# Features: N, P, K, temperature, humidity, ph, rainfall, crop
crops = ["Wheat", "Maize", "Alfalfa", "Cotton"]
data_nutrients = []
for _ in range(n_samples):
    crop = np.random.choice(crops)
    if crop == "Wheat":
        n = np.random.randint(60, 110)
        p = np.random.randint(30, 60)
        k = np.random.randint(30, 50)
        temp = np.random.uniform(15, 25)
        hum = np.random.uniform(50, 70)
        ph = np.random.uniform(6.0, 7.2)
        rain = np.random.uniform(100, 250)
    elif crop == "Maize":
        n = np.random.randint(80, 140)
        p = np.random.randint(40, 70)
        k = np.random.randint(25, 45)
        temp = np.random.uniform(20, 30)
        hum = np.random.uniform(60, 80)
        ph = np.random.uniform(5.5, 6.8)
        rain = np.random.uniform(80, 180)
    elif crop == "Alfalfa":
        n = np.random.randint(15, 40)
        p = np.random.randint(60, 95)
        k = np.random.randint(100, 140)
        temp = np.random.uniform(18, 28)
        hum = np.random.uniform(40, 65)
        ph = np.random.uniform(6.5, 7.8)
        rain = np.random.uniform(50, 120)
    else: # Cotton
        n = np.random.randint(70, 130)
        p = np.random.randint(35, 65)
        k = np.random.randint(80, 120)
        temp = np.random.uniform(25, 35)
        hum = np.random.uniform(50, 75)
        ph = np.random.uniform(5.8, 7.5)
        rain = np.random.uniform(60, 150)
        
    data_nutrients.append([n, p, k, round(temp, 1), round(hum, 1), round(ph, 1), round(rain, 1), crop])

df_nutrients = pd.DataFrame(data_nutrients, columns=["N", "P", "K", "temperature", "humidity", "ph", "rainfall", "crop"])
df_nutrients.to_csv("data/soil_nutrients_train.csv", index=False)


print("Generating crop_yield_train.csv...")
# 2. Crop Yield & Fertilizer Performance Dataset
# Features: crop, soil_type, ndvi, moisture, nitrogen_applied, phosphorus_applied, potassium_applied, area_ha, yield_tons_ha
soils = ["Clay Loam", "Sandy Loam", "Silt Loam"]
data_yield = []
for _ in range(n_samples):
    crop = np.random.choice(crops)
    soil = np.random.choice(soils)
    ndvi = np.random.uniform(0.35, 0.85)
    moisture = np.random.uniform(15, 55)
    area = np.random.uniform(2.0, 25.0)
    
    # Applied fertilizer based on typical averages with some variance
    if crop == "Wheat":
        n_applied = np.random.randint(100, 160)
        p_applied = np.random.randint(40, 70)
        k_applied = np.random.randint(50, 90)
        # Yield formula mimicking realistic response curves
        base_yield = 4.5 + (ndvi * 3.5) + (moisture / 45) + (n_applied / 150) - abs(n_applied - 130)/100
    elif crop == "Maize":
        n_applied = np.random.randint(120, 200)
        p_applied = np.random.randint(50, 85)
        k_applied = np.random.randint(60, 110)
        base_yield = 3.5 + (ndvi * 4.2) + (moisture / 30) + (n_applied / 120) - abs(n_applied - 160)/80
    elif crop == "Alfalfa":
        n_applied = np.random.randint(20, 50)
        p_applied = np.random.randint(60, 100)
        k_applied = np.random.randint(90, 140)
        base_yield = 2.0 + (ndvi * 2.8) + (moisture / 40) + (p_applied / 80)
    else: # Cotton
        n_applied = np.random.randint(90, 140)
        p_applied = np.random.randint(40, 65)
        k_applied = np.random.randint(80, 120)
        base_yield = 1.8 + (ndvi * 2.5) + (moisture / 35) + (k_applied / 100)
        
    # Add random agricultural noise
    yield_tons = base_yield + np.random.normal(0, 0.25)
    yield_tons = max(1.0, round(yield_tons, 2))
    
    data_yield.append([crop, soil, round(ndvi, 2), round(moisture, 1), n_applied, p_applied, k_applied, round(area, 1), yield_tons])

df_yield = pd.DataFrame(data_yield, columns=["crop", "soil_type", "ndvi", "moisture", "nitrogen_applied", "phosphorus_applied", "potassium_applied", "area_ha", "yield_tons_ha"])
df_yield.to_csv("data/crop_yield_train.csv", index=False)


print("Generating soil_moisture_train.csv...")
# 3. Microclimate & Soil Moisture Forecasting Dataset
# Features: temp_max, temp_min, humidity, wind_speed, precipitation, evapotranspiration_et0, soil_moisture_prev, soil_moisture_target
data_moisture = []
for _ in range(n_samples):
    temp_max = np.random.uniform(22.0, 42.0)
    temp_min = temp_max - np.random.uniform(8.0, 14.0)
    humidity = np.random.uniform(30, 85)
    wind_speed = np.random.uniform(5.0, 25.0)
    
    # 20% chance of rain
    if np.random.rand() < 0.2:
        precipitation = np.random.uniform(2.0, 25.0)
    else:
        precipitation = 0.0
        
    # ET0 FAO equation approximation based on temperature, wind, humidity
    et0 = (temp_max * 0.12) + (wind_speed * 0.08) - (humidity * 0.03)
    et0 = max(0.5, round(et0, 2))
    
    soil_moisture_prev = np.random.uniform(15, 60)
    
    # Net moisture balance formula
    moisture_change = (precipitation * 0.8) - (et0 * 1.5)
    soil_moisture_target = soil_moisture_prev + moisture_change
    soil_moisture_target = min(65.0, max(10.0, round(soil_moisture_target, 1)))
    
    data_moisture.append([round(temp_max, 1), round(temp_min, 1), round(humidity, 1), round(wind_speed, 1), round(precipitation, 1), et0, round(soil_moisture_prev, 1), soil_moisture_target])

df_moisture = pd.DataFrame(data_moisture, columns=["temp_max", "temp_min", "humidity", "wind_speed", "precipitation", "evapotranspiration_et0", "soil_moisture_prev", "soil_moisture_target"])
df_moisture.to_csv("data/soil_moisture_train.csv", index=False)

print("Datasets generated successfully!")
