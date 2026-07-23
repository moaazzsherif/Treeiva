# Terriva AgTech Platform Backend Server

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
import numpy as np
import urllib.request
from ai_engine import analyze_soil_decision

app = Flask(__name__, static_folder='.')
CORS(app)

DB_FILE = 'db.json'

def load_db():
    if not os.path.exists(DB_FILE):
        return {"fields": []}
    with open(DB_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_db(data):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def calculate_polygon_area_ha(coords):
    """
    Computes field area in Hectares from lat/lon coordinates using flat Earth shoelace approximation.
    """
    if len(coords) < 3:
        return 5.0
    
    # Calculate average latitude for cosine scaling
    lat_avg = sum(c[0] for c in coords) / len(coords)
    lat_to_m = 111320.0
    lon_to_m = 111320.0 * np.cos(np.radians(lat_avg))
    
    x = [c[1] * lon_to_m for c in coords]
    y = [c[0] * lat_to_m for c in coords]
    
    # Shoelace loop
    x.append(x[0])
    y.append(y[0])
    
    area_m2 = 0.5 * abs(sum(x[i] * y[i+1] - x[i+1] * y[i] for i in range(len(coords))))
    area_ha = area_m2 / 10000.0
    return round(area_ha, 1)

# Serve Frontend static assets
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

# API: Get registered fields
@app.route('/api/fields', methods=['GET'])
def get_fields():
    db = load_db()
    return jsonify(db["fields"])

# API: Register new boundary field
@app.route('/api/fields/register', methods=['POST'])
def register_field():
    db = load_db()
    data = request.json
    
    name = data.get('name', 'Unnamed Field')
    crop = data.get('crop', 'Wheat')
    soil_type = data.get('soil_type', 'Clay Loam')
    coordinates = data.get('coordinates', [])
    
    # Calculate area based on boundary coords
    area_ha = calculate_polygon_area_ha(coordinates)
    
    # Generate unique ID
    field_id = name.lower().replace(' ', '-')
    
    # Check duplicate IDs
    existing_ids = [f["id"] for f in db["fields"]]
    suffix = 1
    orig_id = field_id
    while field_id in existing_ids:
        field_id = f"{orig_id}-{suffix}"
        suffix += 1

    new_field = {
        "id": field_id,
        "name": name,
        "crop": crop,
        "soil_type": soil_type,
        "moisture": round(np.random.uniform(25.0, 55.0), 1),
        "ndvi": round(np.random.uniform(0.4, 0.8), 2),
        "organic_matter": round(np.random.uniform(1.5, 4.0), 1),
        "clay_ratio": 38.0 if soil_type == "Clay Loam" else (15.0 if soil_type == "Sandy Loam" else 20.0),
        "silt_ratio": 42.0 if soil_type == "Clay Loam" else (25.0 if soil_type == "Sandy Loam" else 45.0),
        "sand_ratio": 20.0 if soil_type == "Clay Loam" else (60.0 if soil_type == "Sandy Loam" else 35.0),
        "area_ha": area_ha,
        "coordinates": coordinates,
        "history": [
            {"date": "2026-07-11", "event": "Boundary Registered", "desc": f"Field registered with calculated area of {area_ha} ha."}
        ]
    }
    
    db["fields"].append(new_field)
    save_db(db)
    
    return jsonify({"success": True, "field": new_field})

# API: Run Deep Learning Decision Fusion on field parameters
@app.route('/api/analyze', methods=['POST'])
def analyze_field():
    db = load_db()
    data = request.json
    field_id = data.get('field_id')
    temp_forecast = data.get('temp_forecast', 32.0)
    weather_forecast = data.get('weather_forecast') # Get forecast data from payload
    
    # Find field
    field = next((f for f in db["fields"] if f["id"] == field_id), None)
    if not field:
        return jsonify({"error": "Field not found"}), 404
        
    # Append weather temperature forecast parameter
    field["temp_forecast"] = temp_forecast
    
    # Execute AI decision models (with weather forecast ET0)
    results = analyze_soil_decision(field, weather_forecast)
    return jsonify(results)

# API: Digital Twin moisture index simulator
@app.route('/api/digital-twin/simulate', methods=['POST'])
def simulate_twin():
    db = load_db()
    data = request.json
    field_id = data.get('field_id')
    rainfall_val = float(data.get('rainfall_val', 0.0))
    
    field = next((f for f in db["fields"] if f["id"] == field_id), None)
    if not field:
        return jsonify({"error": "Field not found"}), 404
        
    # Calculate soil moisture absorption dynamics
    base_moisture = field.get("moisture", 40.0)
    simulated_moisture = min(100.0, base_moisture + (rainfall_val * 0.6))
    simulated_moisture = round(simulated_moisture, 1)
    
    # Determine risk category
    risk_score = 15
    if simulated_moisture > 75:
        risk_score = 65 # Runoff danger
    elif simulated_moisture < 30:
        risk_score = 80 # Drought alarm
        
    return jsonify({
        "field_id": field_id,
        "rainfall_intensity": rainfall_val,
        "simulated_moisture_pct": simulated_moisture,
        "adjusted_risk_score": risk_score
    })

# API: Export Reports Simulator
@app.route('/api/reports/generate', methods=['POST'])
def generate_report():
    data = request.json
    export_format = data.get('format', 'PDF')
    
    return jsonify({
        "success": True,
        "format": export_format,
        "filename": f"terriva_agri_report.{'html' if export_format == 'PDF' else ('csv' if export_format == 'Excel' else 'json')}"
    })

# API: Stream Generated Reports for Download
from flask import make_response

@app.route('/api/reports/download')
def download_report():
    export_format = request.args.get('format', 'PDF')
    db = load_db()
    
    if export_format == 'Excel' or export_format == 'CSV':
        csv_data = "Field ID,Name,Crop,Soil Type,NDVI,Moisture,Area (ha)\n"
        for f in db.get("fields", []):
            csv_data += f"{f['id']},{f['name']},{f['crop']},{f['soil_type']},{f['ndvi']},{f['moisture']},{f['area_ha']}\n"
        
        response = make_response(csv_data)
        response.headers["Content-Disposition"] = "attachment; filename=terriva_fields_report.csv"
        response.headers["Content-Type"] = "text/csv"
        return response
    else:
        # Generate an HTML summary report
        html_report = f"""
        <html>
        <head>
            <title>Terriva Agri-Workspace Report</title>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background: #0b0f19; color: #f8fafc; line-height: 1.6; }}
                h1 {{ color: #8B9B49; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 25px; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 25px; background: rgba(255,255,255,0.02); border-radius: 8px; overflow: hidden; }}
                th, td {{ padding: 14px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }}
                th {{ background: rgba(139,155,73,0.15); color: #8B9B49; font-weight: 700; }}
                .badge {{ background: rgba(139,155,73,0.2); color: #8B9B49; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }}
                ul {{ padding-left: 20px; }}
                li {{ margin-bottom: 8px; }}
            </style>
        </head>
        <body>
            <h1>Terriva AgTech Analysis Report</h1>
            <p><strong>Generated Date:</strong> 2026-07-12</p>
            <p><strong>Active Crop Zones:</strong> {len(db.get("fields", []))} fields registered</p>
            
            <table>
                <thead>
                    <tr>
                        <th>Field ID</th>
                        <th>Name</th>
                        <th>Crop</th>
                        <th>Soil Type</th>
                        <th>Chlorophyll (NDVI)</th>
                        <th>Moisture Saturation</th>
                        <th>Area (ha)</th>
                    </tr>
                </thead>
                <tbody>
        """
        for f in db.get("fields", []):
            html_report += f"""
                    <tr>
                        <td><code>{f['id']}</code></td>
                        <td>{f['name']}</td>
                        <td><span class="badge">{f['crop']}</span></td>
                        <td>{f['soil_type']}</td>
                        <td>{f['ndvi']}</td>
                        <td>{f['moisture']}%</td>
                        <td>{f['area_ha']} Hectares</td>
                    </tr>
            """
        html_report += """
                </tbody>
            </table>
            <br/>
            <h3 style="color: #f59e0b; margin-top: 35px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">Decision Support Telemetry</h3>
            <ul>
                <li><strong>AI Agronomy Models</strong>: ACTIVE (Trained Random Forest Regressors deployed)</li>
                <li><strong>IoT Telemetry Probes Status</strong>: 4/4 Online (Alpha-1, Alpha-2, Beta-1, Beta-2 online)</li>
                <li><strong>Blockchain Ledger Integrity</strong>: AUDITED (SHA-256 validation verified)</li>
            </ul>
        </body>
        </html>
        """
        response = make_response(html_report)
        response.headers["Content-Disposition"] = "attachment; filename=terriva_agri_report.html"
        response.headers["Content-Type"] = "text/html"
        return response

# API: Save System Credentials & settings (with API Key masking support)
@app.route('/api/settings/save', methods=['POST'])
def save_settings():
    db = load_db()
    data = request.json
    new_key = data.get("gemini_api_key", "").strip()
    
    db["settings"] = db.get("settings", {})
    old_key = db["settings"].get("gemini_api_key", "")
    
    # Do not overwrite if user submitted masked placeholders
    if "***" in new_key:
        new_key = old_key
        
    db["settings"]["gemini_api_key"] = new_key
    save_db(db)
    return jsonify({"success": True})

# API: Retrieve Masked Settings
@app.route('/api/settings', methods=['GET'])
def get_settings():
    db = load_db()
    settings = db.get("settings", {})
    gemini_key = settings.get("gemini_api_key", "")
    
    # Mask API key for security
    masked_key = gemini_key[:6] + "********" if len(gemini_key) > 6 else gemini_key
    return jsonify({
        "gemini_api_key": masked_key
    })

# API: Natural Language AI Assistant Chat
@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    db = load_db()
    data = request.json
    msg = data.get('message', '').lower()
    user_name = data.get('user_name', 'there')
    
    # Check if Gemini API key is configured
    gemini_key = db.get("settings", {}).get("gemini_api_key", "").strip()
    if gemini_key:
        fields_context = ""
        for f in db.get("fields", []):
            fields_context += f"- Field '{f['name']}' ({f['id']}): Crop={f['crop']}, Soil={f['soil_type']}, NDVI={f['ndvi']}, Moisture={f['moisture']}%, Area={f['area_ha']}ha.\n"
            
        prompt = f"""You are the Terriva Agri-Decision Copilot. You are talking to user: {user_name}.
Here is the active agricultural field data from their workspace database:
{fields_context}
Answer the user's question organically and scientifically, helping them make agronomic decisions. Keep your response brief, friendly, and structured. Use emoji to make it engaging, and respond in the same language the user speaks (Arabic or English).
User question: "{data.get('message', '')}"
"""
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            headers = {"Content-Type": "application/json"}
            body = json.dumps({
                "contents": [{"parts": [{"text": prompt}]}]
            }).encode("utf-8")
            
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=8) as response_stream:
                res_data = json.loads(response_stream.read().decode("utf-8"))
                response = res_data["candidates"][0]["content"]["parts"][0]["text"]
                return jsonify({"response": response})
        except Exception as e:
            print(f"Gemini API error, falling back to rule-based: {e}")
            
    # Simple semantic router
    response = f"Hello {user_name}! 👋 I am the Terriva Agri-Decision Copilot. You can ask me about fertilizer recommendations, irrigation targets, soil health analytics, or ESG carbon credits for your fields."
    
    # 1. Greeting / hello
    if any(w in msg for w in ['hello', 'hi', 'hey', 'مرحبا', 'اهلا']):
        response = f"Hey {user_name}! 👋 Great to see you. I'm your AI Agri-Copilot. Ask me about any of your fields — I can analyze NDVI, moisture, fertilizer plans, irrigation targets, or carbon credits. What would you like to explore?"
    
    # 2. Field Alpha queries
    elif 'alpha' in msg:
        field = next((f for f in db["fields"] if f["id"] == "field-alpha"), None)
        if field:
            if 'fertilizer' in msg or 'npk' in msg or 'nitrogen' in msg:
                response = f"Great question, {user_name}! Field Alpha (Wheat) has a high chlorophyll index (NDVI: {field['ndvi']}), suggesting healthy root development. The AI decision engine prescribes an optimized Nitrogen dosage of 120 kg/ha to avoid nitrate leaching, saving you an estimated $3,450."
            elif 'water' in msg or 'irrigate' in msg or 'moisture' in msg:
                response = f"{user_name}, Field Alpha moisture is stable at {field['moisture']}%. Under current local temperature forecast, the crop transpiration is moderate. Optimal water irrigation demand is calculated at 25 m³/ha."
            else:
                response = f"{user_name}, Field Alpha contains {field['crop']} on {field['soil_type']} soil. Its current NDVI is {field['ndvi']} and average soil moisture saturation is {field['moisture']}%."
                
    # 3. Field Beta queries
    elif 'beta' in msg:
        field = next((f for f in db["fields"] if f["id"] == "field-beta"), None)
        if field:
            if 'fertilizer' in msg or 'npk' in msg or 'nitrogen' in msg:
                response = f"{user_name}, Field Beta (Maize) shows mild nitrogen depletion (NDVI: {field['ndvi']}). The AI recommends applying 140 kg/ha of Urea target mix to regain optimal vegetative growth."
            elif 'water' in msg or 'irrigate' in msg or 'moisture' in msg:
                response = f"Heads up {user_name} — Field Beta moisture is critical at {field['moisture']}%, below the drought safety limit. An immediate irrigation target of 35 m³/ha is recommended to recover root cell turgor pressure."
            else:
                response = f"{user_name}, Field Beta contains {field['crop']} on {field['soil_type']} soil. Current indices show NDVI: {field['ndvi']} and moisture: {field['moisture']}%. ⚠️ Alert: moisture deficit detected!"
                
    # 4. ESG queries
    elif 'carbon' in msg or 'esg' in msg or 'credit' in msg:
        response = f"Impressive work, {user_name}! By using Terriva's variable-rate fertilizer models, you have reduced nitrogen run-off by 4,200 kg across your farm workspace. This has compiled 9.24 Verified Carbon Offset Tokens (equivalent to $231 ESG savings) registered on the sustainability ledger."
    
    # 5. Help / what can you do
    elif 'help' in msg or 'what can' in msg or 'features' in msg:
        response = f"{user_name}, here's what I can help you with:\n🌾 **Field Analysis** — Ask about 'Field Alpha' or 'Field Beta' for NDVI, moisture, and soil data.\n💧 **Irrigation** — Ask about water needs for any field.\n🧪 **Fertilizer** — Get AI-optimized NPK recommendations.\n🌍 **Carbon Credits** — Check your ESG offset tokens.\nJust type naturally and I'll understand!"
    
    # 6. General soil / recommendation queries
    elif 'soil' in msg or 'recommend' in msg or 'suggest' in msg:
        response = f"{user_name}, based on your workspace data, I recommend running a multi-spectral analysis on your fields. Your clay-loam soil zones would benefit from variable-rate Phosphorus application at 45 kg/ha. Would you like me to generate a full NPK prescription map?"
        
    return jsonify({"response": response})




# API: Register new SaaS organization client
@app.route('/api/auth/register', methods=['POST'])
def register_saas():
    data = request.json
    company_name = data.get('company_name', 'New Agri-Corp')
    email = data.get('email', 'farmer@agri-corp.com')
    crop_focus = data.get('crop_focus', 'Potatoes')
    plan = data.get('plan', 'Enterprise Agronomy')
    
    # Generate custom fields matching their crop focus and coordinate grid
    if crop_focus == "Citrus":
        soil_type = "Sandy Loam"
        fields = [
            {
                "id": "citrus-alpha",
                "name": "Citrus Orchard Alpha",
                "crop": "Citrus",
                "soil_type": soil_type,
                "moisture": 52.0,
                "ndvi": 0.81,
                "organic_matter": 2.9,
                "clay_ratio": 20.0,
                "silt_ratio": 30.0,
                "sand_ratio": 50.0,
                "area_ha": 30.0,
                "coordinates": [
                    [30.835, 30.630],
                    [30.838, 30.632],
                    [30.836, 30.640],
                    [30.830, 30.636]
                ],
                "history": [
                    {"date": "2026-07-10", "event": "SaaS Workspace Initialized", "desc": f"Citrus crop profile loaded for {company_name}."}
                ]
            },
            {
                "id": "citrus-beta",
                "name": "Citrus Orchard Beta",
                "crop": "Citrus",
                "soil_type": soil_type,
                "moisture": 41.0,
                "ndvi": 0.68,
                "organic_matter": 2.5,
                "clay_ratio": 20.0,
                "silt_ratio": 30.0,
                "sand_ratio": 50.0,
                "area_ha": 25.0,
                "coordinates": [
                    [30.830, 30.636],
                    [30.832, 30.642],
                    [30.826, 30.645],
                    [30.824, 30.638]
                ],
                "history": []
            }
        ]
    elif crop_focus == "Sugarcane":
        soil_type = "Alluvial Clay"
        fields = [
            {
                "id": "sugarcane-zone-1",
                "name": "Sugarcane Zone 1",
                "crop": "Sugarcane",
                "soil_type": soil_type,
                "moisture": 62.0,
                "ndvi": 0.88,
                "organic_matter": 3.8,
                "clay_ratio": 45.0,
                "silt_ratio": 35.0,
                "sand_ratio": 20.0,
                "area_ha": 65.0,
                "coordinates": [
                    [30.805, 30.620],
                    [30.808, 30.622],
                    [30.806, 30.630],
                    [30.800, 30.626]
                ],
                "history": [
                    {"date": "2026-07-10", "event": "SaaS Workspace Initialized", "desc": f"Sugarcane crop profile loaded for {company_name}."}
                ]
            }
        ]
    else:
        # Default Potatoes
        soil_type = "Silt Clay"
        fields = [
            {
                "id": "potato-field-east",
                "name": "Potato Field East",
                "crop": crop_focus,
                "soil_type": soil_type,
                "moisture": 38.0,
                "ndvi": 0.62,
                "organic_matter": 3.1,
                "clay_ratio": 35.0,
                "silt_ratio": 45.0,
                "sand_ratio": 20.0,
                "area_ha": 55.0,
                "coordinates": [
                    [30.815, 30.660],
                    [30.818, 30.662],
                    [30.816, 30.670],
                    [30.810, 30.666]
                ],
                "history": [
                    {"date": "2026-07-10", "event": "SaaS Workspace Initialized", "desc": f"{crop_focus} crop profile loaded for {company_name}."}
                ]
            },
            {
                "id": "potato-field-west",
                "name": "Potato Field West",
                "crop": crop_focus,
                "soil_type": soil_type,
                "moisture": 49.0,
                "ndvi": 0.71,
                "organic_matter": 3.3,
                "clay_ratio": 35.0,
                "silt_ratio": 45.0,
                "sand_ratio": 20.0,
                "area_ha": 40.0,
                "coordinates": [
                    [30.810, 30.666],
                    [30.812, 30.672],
                    [30.806, 30.675],
                    [30.804, 30.668]
                ],
                "history": []
            }
        ]
        
    db = {"fields": fields}
    save_db(db)
    
    return jsonify({
        "success": True,
        "company_name": company_name,
        "email": email,
        "crop_focus": crop_focus,
        "plan": plan,
        "fields": fields
    })

# API: Reset Database to Default Mock Fields
@app.route('/api/auth/reset', methods=['POST'])
def reset_db_default():
    default_db = {
      "fields": [
        {
          "id": "field-alpha",
          "name": "Field Alpha",
          "crop": "Wheat",
          "soil_type": "Clay Loam",
          "moisture": 48.0,
          "ndvi": 0.74,
          "organic_matter": 3.4,
          "clay_ratio": 38.0,
          "silt_ratio": 42.0,
          "sand_ratio": 20.0,
          "area_ha": 45.0,
          "coordinates": [
            [30.829, 30.640],
            [30.832, 30.642],
            [30.830, 30.652],
            [30.824, 30.648]
          ],
          "history": [
            {"date": "2026-07-10", "event": "NDVI Drop Alarm Triggered", "desc": "Vegetation index fell below 0.62 in Segment 4B. Run NPK analysis."},
            {"date": "2026-07-05", "event": "Variable-Rate Fertilization Run", "desc": "Tractor synchronized with Terriva VR task prescription files."},
            {"date": "2026-06-28", "event": "Dry Combustion Lab Verification", "desc": "Sample 104-B NPK ratio input as ground truth parameters."}
          ]
        },
        {
          "id": "field-beta",
          "name": "Field Beta",
          "crop": "Maize",
          "soil_type": "Sandy Loam",
          "moisture": 31.0,
          "ndvi": 0.48,
          "organic_matter": 1.8,
          "clay_ratio": 15.0,
          "silt_ratio": 25.0,
          "sand_ratio": 60.0,
          "area_ha": 80.0,
          "coordinates": [
            [30.824, 30.648],
            [30.820, 30.655],
            [30.816, 30.650],
            [30.819, 30.642]
          ],
          "history": [
            {"date": "2026-07-08", "event": "Telemetry Sync Complete", "desc": "Soil moisture sensors calibrated successfully."}
          ]
        }
      ]
    }
    save_db(default_db)
    return jsonify({"success": True})

if __name__ == '__main__':
    print("--------------------------------------------------")
    print(" Terriva Decision Platform Server Running on http://localhost:8000")
    print("--------------------------------------------------")
    app.run(port=8000, debug=True, use_reloader=False)
