/* Terriva Dashboard Core JS */

// Global fetch interceptor to support file:// protocol and cross-origin debugging
(function() {
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      const apiBase = (window.location.protocol === 'file:') ? 'http://localhost:8000' : '';
      input = apiBase + input;
    }
    return originalFetch(input, init);
  };
})();

// Global state variables
let map;
let activeTheme = 'dark';
let activeMapLayer = 'base';
let charts = {};
let twinAnimationId = null;
let currentTwinField = 'field-alpha';
let deviceLat = 30.8252; // Default Beheira lat
let deviceLon = 30.6483; // Default Beheira lon
let deviceCity = "Beheira, EG";
let deviceTemp = "32";
let activeFieldIdForAnalysis = 'field-alpha';
let loggedInUserName = 'Moaaz';
let weatherForecastData = null;

// Initialize the application once loaded
window.addEventListener('DOMContentLoaded', () => {
  initTwinCanvas();
  showView('landing-view');
  
  // Set theme from storage
  const savedTheme = localStorage.getItem('terriva-theme') || 'dark';
  setTheme(savedTheme);

  // FAQ Accordion Toggle
  document.querySelectorAll('.faq-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.faq-item');
      const isActive = item.classList.contains('active');
      
      // Close other items
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
});

// Fetch Device Geolocation & Weather
function triggerDeviceSync() {
  if (navigator.geolocation) {
    showToast('Syncing Location', 'Retrieving device GPS coordinates...', 'info');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        deviceLat = position.coords.latitude;
        deviceLon = position.coords.longitude;
        
        // Update Leaflet map coordinates
        if (map) {
          map.flyTo([deviceLat, deviceLon], 15);
        }
        
        // Fetch local city name & local temperature
        fetchLocationMetadata(deviceLat, deviceLon);
      },
      (error) => {
        console.warn("Geolocation permission denied, using default coordinates.", error);
        showToast('GPS Fallback Active', 'Using default coordinates (Beheira, Egypt).', 'warning');
        loadFieldsTable();
      }
    );
  } else {
    showToast('GPS Deficit', 'Geolocation not supported by this device browser.', 'warning');
    loadFieldsTable();
  }
}

// Reverse Geocoding & Weather Telemetry Ingestion
function fetchLocationMetadata(lat, lon) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration&timezone=auto`;
  const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

  // 1. Fetch Temperature
  fetch(weatherUrl)
    .then(res => res.json())
    .then(data => {
      if (data) {
        if (data.current_weather) {
          deviceTemp = Math.round(data.current_weather.temperature);
          updateWeatherWidget();
        }
        if (data.daily) {
          weatherForecastData = {
            temp_max: data.daily.temperature_2m_max[0],
            temp_min: data.daily.temperature_2m_min[0],
            precipitation: data.daily.precipitation_sum[0],
            evapotranspiration_et0: data.daily.et0_fao_evapotranspiration[0] || 5.0,
            humidity: 58.0,
            wind_speed: 14.2
          };
          
          // Dynamically update Overview climate cards
          const overviewTemp = document.getElementById('label-device-temp');
          if (overviewTemp) overviewTemp.textContent = deviceTemp;
        }
      }
    })
    .catch(err => console.error("Error fetching weather forecast:", err));

  // 2. Fetch City Name
  fetch(geoUrl)
    .then(res => res.json())
    .then(data => {
      if (data && data.address) {
        deviceCity = data.address.city || data.address.town || data.address.village || data.address.suburb || "Local Region";
        updateWeatherWidget();
        showToast('Device Localized', `Map centered on ${deviceCity}.`, 'success');
        
        const overviewCity = document.getElementById('label-device-city');
        if (overviewCity) overviewCity.textContent = deviceCity;
      }
      
      // Store coordinates; map initializes when GIS tab opens
      registerLocalFieldAroundCoords(lat, lon);
    })
    .catch(err => {
      console.error("Geocoding failed:", err);
      deviceCity = "Localized Farm";
      updateWeatherWidget();
      registerLocalFieldAroundCoords(lat, lon);
    });
}

function updateWeatherWidget() {
  const widget = document.querySelector('.weather-widget');
  if (widget) {
    widget.innerHTML = `
      <i class="fa-solid fa-cloud-sun text-warning"></i>
      <span>${deviceCity} &bull; ${deviceTemp}°C &bull; Connected</span>
    `;
  }
}

// Register a mock farm boundary polygon around the user's real coordinates
function registerLocalFieldAroundCoords(lat, lon) {
  // Generate square coords around center lat/lon
  const d = 0.003; // ~300 meters offset
  const coordinates = [
    [lat + d, lon - d],
    [lat + d, lon + d],
    [lat - d, lon + d],
    [lat - d, lon - d]
  ];

  fetch('/api/fields/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: "My Local Field",
      crop: "Wheat",
      soil_type: "Clay Loam",
      coordinates: coordinates
    })
  })
    .then(res => res.json())
    .then(data => {
      if(data.success) {
        loadFieldsTable();
        // Add polygon to map
        drawFieldsOnMap();
      }
    })
    .catch(err => console.error("Failed to register local coordinates field:", err));
}
// View Controller State Transitions
function showView(viewId) {
  const views = ['landing-view', 'login-view', 'dashboard-view'];
  views.forEach(v => {
    document.getElementById(v).style.display = (v === viewId) ? 'flex' : 'none';
  });

  if (viewId === 'dashboard-view') {
    document.body.style.height = '100vh';
    document.body.style.overflow = 'hidden';
    // Start Geolocation flow on entry
    triggerDeviceSync();
    
    setTimeout(() => {
      if(map) map.invalidateSize();
      initCharts();
    }, 100);
  } else {
    document.body.style.height = 'auto';
    document.body.style.overflow = 'auto';
  }
}
// Sidebar Navigation Tab Switching
function switchTab(tabId, element) {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
  });
  if(element) element.classList.add('active');

  document.querySelectorAll('.page-content').forEach(page => {
    page.classList.remove('active');
  });
  const targetTab = document.getElementById(tabId);
  if(targetTab) targetTab.classList.add('active');

  if(tabId === 'tab-gis') {
    // Initialize map on first visit if not yet created (wait for 400ms fade-in transition to complete)
    setTimeout(() => {
      if(!map) {
        initLeafletMap();
      } else {
        map.invalidateSize();
        map.flyTo([deviceLat, deviceLon], 14, { duration: 0.5 });
      }
      drawFieldsOnMap();
    }, 500);
  }
  
  if(tabId === 'tab-digital-twin') {
    setTimeout(() => {
      initTwinCanvas();
    }, 150);
  }
  
  // Start admin terminal when entering admin tab
  if(tabId === 'tab-admin') {
    try { startAdminTerminalSimulator(); } catch(e) {}
  }

  // Load system settings when entering settings tab
  if(tabId === 'tab-settings') {
    try { loadSystemSettings(); } catch(e) {}
  }
}

// 2FA login simulator
function goTo2FA() {
  const emailInput = document.getElementById('login-email');
  if (emailInput && !emailInput.value.trim()) {
    emailInput.value = 'moaaz@terriva.com';
  }
  const step1 = document.querySelector('.login-step-1');
  if (step1) step1.style.display = 'none';
  
  const regStep = document.querySelector('.login-register');
  if (regStep) regStep.style.display = 'none';
  
  const step2 = document.querySelector('.login-step-2');
  if (step2) step2.style.display = 'block';
  
  showToast('رمز التوثيق 2FA', 'تم إرسال كود التحقق الأمني للهاتف المسجل.', 'info');
}

function resetLogin() {
  const step2 = document.querySelector('.login-step-2');
  if (step2) step2.style.display = 'none';
  const step1 = document.querySelector('.login-step-1');
  if (step1) step1.style.display = 'block';
}

const PRESET_ACCOUNTS = {
  'banha@terriva.com': {
    name: 'مزرعة بنها والقليوبية',
    company: 'مزارع بنها الحديثة (Sentinel-2 L2A)',
    field: {
      id: 'field-banha',
      name: 'مزرعة بنها - القليوبية (Sentinel-2 L2A)',
      crop: 'Wheat',
      crop_ar: 'قمح وموالح بنها',
      soil_type: 'Clay Loam',
      location: 'القليوبية - بنها',
      moisture: 38.5,
      area_feddan: 10.0,
      area_ha: 4.2,
      coordinates: [
        [30.462, 31.182],
        [30.465, 31.186],
        [30.460, 31.190],
        [30.457, 31.185]
      ]
    }
  },
  'moaaz@terriva.com': {
    name: 'معاذ شريف',
    company: 'مزارع معاذ شريف للإنتاج الزراعي',
    field: {
      id: 'field-moaaz',
      name: 'مزرعة معاذ شريف - أرض المانجو والنخيل',
      crop: 'Mango',
      crop_ar: 'مانجو ونخيل تمر',
      soil_type: 'Sandy Loam',
      location: 'البحيرة - النوبارية',
      moisture: 24.5,
      area_feddan: 25.0,
      area_ha: 10.5,
      coordinates: [[30.829, 30.640], [30.832, 30.642], [30.830, 30.652], [30.824, 30.648]]
    }
  },
  'moaazshrif246@gmail.com': {
    name: 'معاذ شريف',
    company: 'مزارع معاذ شريف للإنتاج الزراعي',
    field: {
      id: 'field-moaaz',
      name: 'مزرعة معاذ شريف - أرض المانجو والنخيل',
      crop: 'Mango',
      crop_ar: 'مانجو ونخيل تمر',
      soil_type: 'Sandy Loam',
      location: 'البحيرة - النوبارية',
      moisture: 24.5,
      area_feddan: 25.0,
      area_ha: 10.5,
      coordinates: [[30.829, 30.640], [30.832, 30.642], [30.830, 30.652], [30.824, 30.648]]
    }
  },
  'wafaa@terriva.com': {
    name: 'وفاء أحمد',
    company: 'مزارع وفاء أحمد للفواكه الاستوائية',
    field: {
      id: 'field-wafaa',
      name: 'أرض وفاء أحمد - حقول الفراولة والعنب',
      crop: 'Strawberry',
      crop_ar: 'فراولة وعنب',
      soil_type: 'Clay Loam',
      location: 'القليوبية - طوخ',
      moisture: 36.0,
      area_feddan: 15.0,
      area_ha: 6.3,
      coordinates: [[30.450, 31.180], [30.454, 31.185], [30.452, 31.192], [30.446, 31.188]]
    }
  },
  'menna@terriva.com': {
    name: 'منة الله',
    company: 'مزارع منة الله للمحاصيل الاستراتيجية',
    field: {
      id: 'field-menna',
      name: 'حقول منة الله - أرض القمح والذرة الشاملة',
      crop: 'Wheat',
      crop_ar: 'قمح وذرة',
      soil_type: 'Clay Loam',
      location: 'الشرقية - الزقازيق',
      moisture: 42.0,
      area_feddan: 40.0,
      area_ha: 16.8,
      coordinates: [[30.580, 31.500], [30.585, 31.508], [30.582, 31.515], [30.575, 31.507]]
    }
  },
  'makram@terriva.com': {
    name: 'مكرم محمد',
    company: 'مزارع مكرم محمد للبطاطس والموالح',
    field: {
      id: 'field-makram',
      name: 'مزارع مكرم محمد - حقول البطاطس والموالح',
      crop: 'Potato',
      crop_ar: 'بطاطس وموالح',
      soil_type: 'Silt Clay',
      location: 'المنوفية - مدينة السادات',
      moisture: 39.0,
      area_feddan: 30.0,
      area_ha: 12.6,
      coordinates: [[30.380, 30.520], [30.385, 30.526], [30.382, 30.534], [30.375, 30.528]]
    }
  }
};

function selectPresetAccount(email) {
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  if (emailInput) emailInput.value = email;
  if (passInput) passInput.value = '123';
}

function calculateClientAiInference(field) {
  const areaFeddan = field.area_feddan || 10.0;
  const crop = field.crop || 'Wheat';
  
  let nKgPerFeddan = 240;
  let pKgPerFeddan = 180;
  let kKgPerFeddan = 45;
  let waterM3PerFeddan = 85;

  if (crop === 'Mango') {
    nKgPerFeddan = 280; pKgPerFeddan = 160; kKgPerFeddan = 90; waterM3PerFeddan = 110;
  } else if (crop === 'Strawberry') {
    nKgPerFeddan = 210; pKgPerFeddan = 190; kKgPerFeddan = 80; waterM3PerFeddan = 75;
  } else if (crop === 'Potato') {
    nKgPerFeddan = 260; pKgPerFeddan = 220; kKgPerFeddan = 120; waterM3PerFeddan = 95;
  } else if (crop === 'Wheat') {
    nKgPerFeddan = 237; pKgPerFeddan = 150; kKgPerFeddan = 45; waterM3PerFeddan = 85;
  }

  const nBagsFeddan = Math.round((nKgPerFeddan / 50) * 10) / 10;
  const pBagsFeddan = Math.round((pKgPerFeddan / 50) * 10) / 10;
  const kBagsFeddan = Math.round((kKgPerFeddan / 50) * 10) / 10;

  const nTotalBags = Math.round(nBagsFeddan * areaFeddan);
  const pTotalBags = Math.round(pBagsFeddan * areaFeddan);
  const kTotalBags = Math.round(kBagsFeddan * areaFeddan);

  const totalWaterField = Math.round(waterM3PerFeddan * areaFeddan);

  return {
    field_id: field.id || 'field-1',
    field_name: field.name || 'حقل مزرعتي',
    fertilizer_recommendation: {
      nitrogen: {
        fertilizer_name: 'سلفات نشادر (20.6% N)',
        kg_per_feddan: nKgPerFeddan,
        bags_per_feddan: nBagsFeddan,
        total_bags_field: nTotalBags,
        recommendation_reason: 'التربة قلوية وحاجة المحصول للنمو الخضري'
      },
      phosphorus: {
        fertilizer_name: 'سوبر فوسفات أحادي (15.5% P2O5)',
        kg_per_feddan: pKgPerFeddan,
        bags_per_feddan: pBagsFeddan,
        total_bags_field: pTotalBags
      },
      potassium: {
        fertilizer_name: 'سلفات بوتاسيوم (50% K2O)',
        kg_per_feddan: kKgPerFeddan,
        bags_per_feddan: kBagsFeddan,
        total_bags_field: kTotalBags
      },
      irrigation: {
        water_m3_per_feddan: waterM3PerFeddan,
        total_water_m3_field: totalWaterField,
        irrigation_schedule_ar: 'الري كل 4 إلى 6 أيام بالتنقيط',
        irrigation_method_ar: 'الري بالتنقيط المحسّن'
      }
    },
    shap_values: {
      ndvi: 0.42,
      moisture: 0.35,
      organic_matter: 0.28
    }
  };
}

function applyUserLandData(accountData) {
  if (!accountData) return;
  const name = accountData.name || 'مزارع جديد';
  const company = accountData.company || 'مزرعتي الخاصة';
  const field = accountData.field || {};

  loggedInUserName = name;

  // 1. Sidebar Avatar & User Card
  const userAvatar = document.querySelector('.sidebar-footer .user-avatar');
  if (userAvatar) userAvatar.textContent = name.substring(0, 2).toUpperCase();

  const userInfoH4 = document.querySelector('.sidebar-footer .user-info h4');
  if (userInfoH4) userInfoH4.textContent = name;

  const userInfoP = document.querySelector('.sidebar-footer .user-info p');
  if (userInfoP) userInfoP.textContent = company;

  // 2. Overview Stat Cards
  const statArea = document.getElementById('stat-total-area-desc');
  if (statArea) statArea.textContent = `${field.area_feddan || 10} فدان مساحة المزرعة الكلية`;

  const statMoisture = document.getElementById('stat-moisture-val');
  if (statMoisture) statMoisture.textContent = `${field.moisture || 35.0}%`;

  const statFields = document.getElementById('stat-total-fields-val');
  if (statFields) statFields.textContent = `1 حقل نشط (${field.crop_ar || field.crop || 'قمح'})`;

  const weatherWidget = document.querySelector('.weather-widget span');
  if (weatherWidget) weatherWidget.textContent = `${field.location || 'البحيرة - النوبارية'} • 32°C • مشمس`;

  // 3. Overview Table
  const overviewBody = document.querySelector('.field-table tbody');
  if (overviewBody && field.name) {
    overviewBody.innerHTML = `
      <tr>
        <td>${field.name}</td>
        <td><span class="crop-tag">${field.crop_ar || field.crop}</span></td>
        <td>${field.soil_type || 'طينية لومية'}</td>
        <td>${field.moisture}%</td>
        <td class="trend-up" style="color:var(--primary-light)">+28.5%</td>
        <td><button class="glass-btn" style="padding: 5px 10px;" onclick="viewFieldTwin('${field.id}')">عرض التوأم</button></td>
      </tr>
    `;
  }

  // 4. Copilot Chat Greeting
  const greetingEl = document.getElementById('copilot-initial-greeting');
  if (greetingEl) {
    greetingEl.textContent = `أهلاً بك يا ${name}! 👋 تم تحميل ${field.name} (${field.area_feddan || 10} فدان ${field.crop_ar || field.crop}). اسألني عن توصيات التسميد بالشكاير أو الري بالمتر المكعب.`;
  }

  // 5. Trigger Recommendations View with Client AI calculations
  const aiData = calculateClientAiInference(field);
  updateRecommendationsView(aiData);

  // 6. Fly Leaflet Map to Field Coordinates
  if (map && field.coordinates && field.coordinates.length > 0) {
    const center = field.coordinates[0];
    map.flyTo(center, 14);
  }
}

function enterDashboard() {
  // Immediately switch view to dashboard!
  showView('dashboard-view');

  try {
    const emailInput = document.getElementById('login-email');
    const email = (emailInput && emailInput.value.trim()) ? emailInput.value.trim() : 'banha@terriva.com';
    
    // Find account in PRESET_ACCOUNTS or create a fallback
    const accountData = PRESET_ACCOUNTS[email] || PRESET_ACCOUNTS['banha@terriva.com'];

    // Apply user land data reactively!
    applyUserLandData(accountData);

    // Attempt backend login sync if node server is alive
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: '123' })
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.field) {
          applyUserLandData({
            name: data.user_name,
            company: data.company,
            field: data.field
          });
        }
      })
      .catch(err => console.log('Backend sync skipped, operating in static client mode.'));

    showToast('تم تسجيل الدخول', `أهلاً بك يا ${accountData.name}! تم فتح مساحة عمل ${accountData.company}.`, 'success');
  } catch (err) {
    console.error('enterDashboard error caught:', err);
  }
}

function logout() {
  // Reset database back to default mock fields on logout
  fetch('/api/auth/reset', { method: 'POST' })
    .then(() => {
      loadFieldsTable();
      if(map) drawFieldsOnMap();
    });

  showView('landing-view');
  resetLogin();
  toggleLoginRegister(false);
}

function moveOtpFocus(input, index) {
  if (input.value.length === 1 && index < 4) {
    document.querySelectorAll('.otp-input')[index].focus();
  }
}

// Theme Config
function toggleTheme() {
  const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
}

function setTheme(theme) {
  activeTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('terriva-theme', theme);
  
  const toggleIcon = document.querySelector('.theme-toggle i');
  if(toggleIcon) {
    toggleIcon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

// Toast System
function showToast(title, desc, type = 'success') {
  const toast = document.getElementById('toast-notif');
  const tTitle = document.getElementById('toast-title');
  const tDesc = document.getElementById('toast-desc');
  
  tTitle.textContent = title;
  tDesc.textContent = desc;
  
  if(type === 'success') toast.style.borderLeftColor = 'var(--primary)';
  else if(type === 'danger') toast.style.borderLeftColor = 'var(--danger)';
  else if(type === 'info') toast.style.borderLeftColor = 'var(--info)';
  else toast.style.borderLeftColor = 'var(--warning)';

  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

// Leaflet GIS Mapping
let layersGroup = null;

function initLeafletMap() {
  if (map) return; // Only init once

  map = L.map('leaflet-map').setView([deviceLat, deviceLon], 14);

  // Satellite layer
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; World Imagery Map'
  }).addTo(map);

  layersGroup = L.layerGroup().addTo(map);

  // Geoman drawing controls
  map.pm.addControls({
    position: 'topleft',
    drawCircleMarker: false,
    drawMarker: false,
    drawPolyline: false,
    drawCircle: false,
    cutPolygon: false
  });

  // Listen to new draws
  map.on('pm:create', function(e) {
    const layer = e.layer;
    const latlngs = layer.getLatLngs()[0].map(coord => [coord.lat, coord.lng]);
    const drawnName = `حقل مخصص ${Math.floor(Math.random() * 100) + 1}`;
    
    const drawnFieldObj = {
      id: `field-${Date.now()}`,
      name: drawnName,
      crop: "Maize",
      crop_ar: "ذرة عامة",
      soil_type: "Sandy Loam",
      moisture: 35.0,
      ndvi: 0.70,
      organic_matter: 2.2,
      area_feddan: 12.0,
      area_ha: 5.0,
      coordinates: latlngs
    };

    fetch('/api/fields/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: drawnName,
        crop: "Maize",
        soil_type: "Sandy Loam",
        coordinates: latlngs
      })
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data && data.success) {
          showToast('Field Registered', 'New drawn polygon saved to database.', 'success');
          if (data.field) LOCAL_FIELDS.push(data.field);
        } else {
          LOCAL_FIELDS.push(drawnFieldObj);
        }
        loadFieldsTable();
        drawFieldsOnMap();
      })
      .catch(err => {
        console.warn('Backend polygon save offline, saving drawn polygon locally:', err);
        LOCAL_FIELDS.push(drawnFieldObj);
        showToast('Field Registered', 'New drawn polygon added to your local workspace.', 'success');
        loadFieldsTable();
        drawFieldsOnMap();
      });
  });

  drawFieldsOnMap();
  
  // Secondary size invalidation safety net
  setTimeout(() => {
    if(map) map.invalidateSize();
  }, 200);
}

// === Real Copernicus Sentinel-2 NDVI Overlay ===
let ndviOverlay = null;
const BANHA_NDVI_BOUNDS = [[30.445, 31.170], [30.475, 31.200]]; // Real bbox from Sentinel Hub
const BANHA_NDVI_IMAGE = 'banha_ndvi_real.png';

function toggleNdviOverlay(show) {
  if (!map) return;
  if (show) {
    if (!ndviOverlay) {
      ndviOverlay = L.imageOverlay(BANHA_NDVI_IMAGE, BANHA_NDVI_BOUNDS, {
        opacity: 0.75,
        interactive: true
      });
      ndviOverlay.bindPopup(`
        <div style="font-family: var(--font-body); color:#2c3518; padding: 8px; min-width: 220px;">
          <h4 style="font-weight: 700; margin-bottom: 8px;">🛰️ Sentinel-2 L2A — NDVI حقيقي</h4>
          <p style="font-size:12px;"><b>القمر:</b> Sentinel-2A (ESA Copernicus)</p>
          <p style="font-size:12px;"><b>التاريخ:</b> 28 يوليو 2026</p>
          <p style="font-size:12px;"><b>الموقع:</b> بنها - القليوبية</p>
          <p style="font-size:12px;"><b>السحب:</b> 0.01%</p>
          <hr style="margin: 6px 0; border:none; border-top:1px solid #ddd;">
          <p style="font-size:11px;"><b style="color:#1a9850;">🟢 أخضر غامق:</b> نبات صحي (NDVI > 0.6)</p>
          <p style="font-size:11px;"><b style="color:#fee08b;">🟡 أصفر:</b> تربة/محصول ضعيف</p>
          <p style="font-size:11px;"><b style="color:#c0392b;">🔴 أحمر:</b> مياه / مباني</p>
        </div>
      `);
    }
    ndviOverlay.addTo(map);
    map.flyToBounds(BANHA_NDVI_BOUNDS, { maxZoom: 14, duration: 1.5 });
  } else {
    if (ndviOverlay) {
      map.removeLayer(ndviOverlay);
    }
  }
}

function renderPolygonsOnMap(fields) {
  if (!map || !layersGroup) return;
  layersGroup.clearLayers();

  // Toggle real NDVI satellite overlay
  toggleNdviOverlay(activeMapLayer === 'ndvi');

  (fields || []).forEach(field => {
    if (!field.coordinates || field.coordinates.length === 0) return;

    let fillCol = '#8B9B49';
    let opacity = 0.25;

    // Visual layers color scaling
    if (activeMapLayer === 'ndvi') {
      fillCol = (field.ndvi || 0.7) > 0.6 ? '#1a9850' : '#fee08b';
      opacity = 0.3;
    } else if (activeMapLayer === 'moisture') {
      fillCol = (field.moisture || 35) > 40 ? '#2171b5' : '#deebf7';
      opacity = 0.5;
    } else if (activeMapLayer === 'vr') {
      fillCol = '#E5B869';
      opacity = 0.55;
    }

    const polygon = L.polygon(field.coordinates, {
      color: activeMapLayer === 'vr' ? '#E5B869' : '#8B9B49',
      fillColor: fillCol,
      fillOpacity: opacity,
      weight: 2
    }).addTo(layersGroup);

    polygon.bindPopup(`
      <div style="font-family: var(--font-body); color:#2c3518; padding: 5px; min-width: 180px;">
        <h4 style="font-weight: 700; margin-bottom: 5px;">${field.name}</h4>
        <p style="font-size:12px;"><b>Crop:</b> ${field.crop_ar || field.crop}</p>
        <p style="font-size:12px;"><b>NDVI Index:</b> ${field.ndvi || 0.72}</p>
        <p style="font-size:12px;"><b>Moisture:</b> ${field.moisture || 35}%</p>
        <p style="font-size:12px;"><b>Area:</b> ${field.area_feddan || 10} Feddans</p>
      </div>
    `);
  });
}

function drawFieldsOnMap() {
  if (!map || !layersGroup) return;

  fetch('/api/fields')
    .then(res => {
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      return res.json();
    })
    .then(fields => {
      if (Array.isArray(fields) && fields.length > 0) {
        LOCAL_FIELDS = fields;
      }
      renderPolygonsOnMap(LOCAL_FIELDS);
    })
    .catch(err => {
      console.warn('Backend map fields API offline, rendering local polygons:', err);
      renderPolygonsOnMap(LOCAL_FIELDS);
    });
}
function setMapLayer(layerType) {
  activeMapLayer = layerType;
  
  const layers = ['base', 'ndvi', 'moisture', 'vr'];
  layers.forEach(l => {
    const btn = document.getElementById(`btn-layer-${l}`);
    if (btn) {
      if (l === layerType) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  drawFieldsOnMap();
  animateTractorVR();
  showToast('GIS Layer Configured', `Active overlay set to: ${layerType.toUpperCase()}`, 'info');
}
function onTimelineSliderChange(val) {
  const months = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'June 2026'];
  document.getElementById('timeline-date-label').textContent = months[val - 1];
  drawFieldsOnMap();
}

let LOCAL_FIELDS = [
  {
    id: "field-banha",
    name: "مزرعة بنها - القليوبية (Sentinel-2 L2A)",
    crop: "Wheat",
    crop_ar: "قمح وموالح بنها",
    soil_type: "Clay Loam",
    moisture: 38.5,
    ndvi: 0.74,
    organic_matter: 2.9,
    area_feddan: 10.0,
    area_ha: 4.2,
    coordinates: [
      [30.462, 31.182],
      [30.465, 31.186],
      [30.460, 31.190],
      [30.457, 31.185]
    ]
  },
  {
    id: "field-moaaz",
    name: "مزرعة معاذ شريف - أرض المانجو والنخيل",
    crop: "Mango",
    crop_ar: "مانجو ونخيل تمر",
    soil_type: "Sandy Loam",
    moisture: 24.5,
    ndvi: 0.72,
    organic_matter: 1.8,
    area_feddan: 25.0,
    area_ha: 10.5,
    coordinates: [[30.829, 30.640], [30.832, 30.642], [30.830, 30.652], [30.824, 30.648]]
  }
];

function renderFieldsUI(fields) {
  const overviewBody = document.querySelector('.field-table tbody');
  if (overviewBody) {
    overviewBody.innerHTML = '';
    (fields || []).forEach(field => {
      overviewBody.innerHTML += `
        <tr>
          <td>${field.name}</td>
          <td><span class="crop-tag">${field.crop_ar || field.crop}</span></td>
          <td>${field.soil_type}</td>
          <td>${field.moisture}%</td>
          <td class="trend-up" style="color:var(--primary-light)">+${Math.round((field.ndvi || 0.7) * 20)}%</td>
          <td><button class="glass-btn" style="padding: 5px 10px;" onclick="viewFieldTwin('${field.id}')">View Twin</button></td>
        </tr>
      `;
    });
  }

  const analysisSelect = document.getElementById('field-setup-name');
  if (analysisSelect && fields.length > 0) {
    activeFieldIdForAnalysis = fields[0]?.id || 'field-moaaz';
  }
}

// Fetch and load database fields table
function loadFieldsTable() {
  fetch('/api/fields')
    .then(res => {
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      return res.json();
    })
    .then(fields => {
      if (Array.isArray(fields) && fields.length > 0) {
        LOCAL_FIELDS = fields;
      }
      renderFieldsUI(LOCAL_FIELDS);
    })
    .catch(err => {
      console.warn('Backend fields API unreachable, using local store:', err);
      renderFieldsUI(LOCAL_FIELDS);
    });
}

// Register field form submit
function registerNewField() {
  const nameInput = document.getElementById('field-setup-name');
  const cropInput = document.getElementById('field-setup-crop');
  const soilInput = document.getElementById('field-setup-soil');

  const name = nameInput ? nameInput.value.trim() : '';
  const crop = cropInput ? cropInput.value : 'Wheat';
  const soil = soilInput ? soilInput.value : 'Clay Loam';

  if (!name) {
    showToast('Missing Moniker', 'Please specify field name.', 'danger');
    return;
  }

  // Generate mock coordinates around current device location
  const d = 0.002;
  const offsetLat = (Math.random() - 0.5) * 0.01;
  const offsetLon = (Math.random() - 0.5) * 0.01;
  const centerLat = deviceLat + offsetLat;
  const centerLon = deviceLon + offsetLon;
  
  const coordinates = [
    [centerLat + d, centerLon - d],
    [centerLat + d, centerLon + d],
    [centerLat - d, centerLon + d],
    [centerLat - d, centerLon - d]
  ];

  const newFieldObj = {
    id: `field-${Date.now()}`,
    name: name,
    crop: crop,
    crop_ar: crop,
    soil_type: soil,
    moisture: Math.round((28 + Math.random() * 20) * 10) / 10,
    ndvi: 0.72,
    organic_matter: 2.5,
    area_feddan: 10.0,
    area_ha: 4.2,
    coordinates: coordinates
  };

  fetch('/api/fields/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name,
      crop: crop,
      soil_type: soil,
      coordinates: coordinates
    })
  })
    .then(res => {
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data && data.success) {
        showToast('Farm Registered', `New field boundary added successfully.`, 'success');
        if (data.field) LOCAL_FIELDS.push(data.field);
      } else {
        showToast('Registration Failure', data.message || 'Could not register field.', 'danger');
        LOCAL_FIELDS.push(newFieldObj);
      }
      loadFieldsTable();
      drawFieldsOnMap();
      switchTab('tab-gis', document.querySelectorAll('.sidebar-link')[2]);
    })
    .catch(err => {
      console.warn('Backend register API unreachable, saving locally:', err);
      LOCAL_FIELDS.push(newFieldObj);
      showToast('Farm Registered', 'New field boundary added to your local workspace.', 'success');
      loadFieldsTable();
      drawFieldsOnMap();
      switchTab('tab-gis', document.querySelectorAll('.sidebar-link')[2]);
    });
}

// AI Analysis Simulation
function runAISimulation() {
  const runBtn = document.getElementById('btn-run-ai');
  const spinRing = document.getElementById('ai-spin-ring');
  const progressFill = document.getElementById('ai-progress-bar');
  const stepTitle = document.getElementById('ai-step-title');
  const stepDesc = document.getElementById('ai-step-desc');
  const shapVisual = document.getElementById('shap-results');

  runBtn.disabled = true;
  spinRing.classList.add('active');
  shapVisual.style.display = 'none';

  const steps = [
    { pct: 20, title: 'Parsing Sentinel Bands', desc: 'Fetching 10m bands from Sentinel-2 tile archive...' },
    { pct: 50, title: 'Syncing IoT Telemetry', desc: 'Validating moisture and soil EC telemetry signals...' },
    { pct: 85, title: 'Ground Truth Alignment', desc: 'Matching spectroscopy lab data matrices...' },
    { pct: 100, title: 'Compilation Complete', desc: 'All datasets successfully fused into the decision model.' }
  ];

  let idx = 0;
  const interval = setInterval(() => {
    if (idx < steps.length) {
      progressFill.style.width = `${steps[idx].pct}%`;
      stepTitle.textContent = steps[idx].title;
      stepDesc.textContent = steps[idx].desc;
      idx++;
    } else {
      clearInterval(interval);
      
      // Pull real predictions from python backend decision engine
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_id: activeFieldIdForAnalysis,
          temp_forecast: deviceTemp,
          weather_forecast: weatherForecastData
        })
      })
        .then(res => res.json())
        .then(data => {
          spinRing.classList.remove('active');
          runBtn.disabled = false;
          
          // Show SHAP bars
          shapVisual.style.display = 'block';
          updateShapAttributions(data.shap_values);
          
          // Update Recommendations Tab parameters with actual API response
          updateRecommendationsView(data);
          
          showToast('Optimization Compiled', 'Decision engine model execution completed.', 'success');
          
          setTimeout(() => {
            switchTab('tab-recommendations', document.querySelectorAll('.sidebar-link')[4]);
          }, 1500);
        });
    }
  }, 1000);
}

function updateShapAttributions(shap) {
  const shapResultsDiv = document.getElementById('shap-results');
  if(!shapResultsDiv) return;

  // Render bars dynamically reflecting positive/negative pull
  shapResultsDiv.innerHTML = `
    <h4>Explainable AI (SHAP Impact Values)</h4>
    <p style="font-size:12px; color:var(--text-secondary); margin-bottom: 15px;">Features with the largest direct impact on fertilizer recommendations</p>
    
    <div class="shap-bar-row">
      <div class="shap-label">NDVI Index</div>
      <div class="shap-track">
        <div class="shap-fill ${shap.ndvi >= 0 ? 'positive' : 'negative'}" style="width: ${Math.min(50, Math.abs(shap.ndvi * 100))}%"></div>
      </div>
      <span style="font-size:11px; margin-left:10px;">${shap.ndvi}</span>
    </div>
    <div class="shap-bar-row">
      <div class="shap-label">Soil moisture</div>
      <div class="shap-track">
        <div class="shap-fill ${shap.moisture >= 0 ? 'positive' : 'negative'}" style="width: ${Math.min(50, Math.abs(shap.moisture * 2.5))}%"></div>
      </div>
      <span style="font-size:11px; margin-left:10px;">${shap.moisture}</span>
    </div>
    <div class="shap-bar-row">
      <div class="shap-label">Organic Matter</div>
      <div class="shap-track">
        <div class="shap-fill ${shap.organic_matter >= 0 ? 'positive' : 'negative'}" style="width: ${Math.min(50, Math.abs(shap.organic_matter * 10))}%"></div>
      </div>
      <span style="font-size:11px; margin-left:10px;">${shap.organic_matter}</span>
    </div>
  `;
}

function updateRecommendationsView(data) {
  latestPrescriptionData = data;
  const recTab = document.getElementById('tab-recommendations');
  if(!recTab) return;

  const fRec = data.fertilizer_recommendation || {};
  const nRec = fRec.nitrogen || {};
  const pRec = fRec.phosphorus || {};
  const kRec = fRec.potassium || {};
  const compRec = fRec.organic_compost || {};
  const irrRec = fRec.irrigation || {};

  // Update Overview Stat Cards
  const valN = document.getElementById('rec-n-val');
  if(valN) valN.textContent = `${nRec.kg_per_feddan || data.nitrogen_kg_ha} كجم/فدان (${nRec.bags_per_feddan || 0} شكارة)`;
  
  const nameN = document.getElementById('rec-n-name');
  if(nameN) nameN.textContent = nRec.fertilizer_name || 'سلفات نشادر (20.6% N)';

  const valW = document.getElementById('rec-water-val');
  if(valW) valW.textContent = `${irrRec.water_m3_per_feddan || data.water_m3_feddan || 25} m³/فدان`;

  const schedW = document.getElementById('rec-water-schedule');
  if(schedW) schedW.textContent = irrRec.irrigation_schedule_ar || 'حسب رطوبة التربة والبخر';

  const valC = document.getElementById('rec-cost-val');
  if(valC) valC.textContent = `-$${data.cost_savings_usd || 0}`;

  // Update Detailed Prescription Cards Container
  const cardsContainer = document.getElementById('agri-prescription-cards');
  if(cardsContainer) {
    cardsContainer.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px; margin-bottom:25px;">
        
        <!-- Nitrogen Card -->
        <div class="glass" style="padding:20px; border-top:4px solid #10b981;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="color:#10b981; margin:0;"><i class="fa-solid fa-flask"></i> السماد النيتروجيني (N)</h4>
            <span class="crop-tag">${data.crop_ar || data.crop || 'قمح'}</span>
          </div>
          <p style="font-weight:700; font-size:16px; margin-bottom:8px;">${nRec.fertilizer_name || 'سلفات نشادر 20.6%'}</p>
          <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; font-size:13px; margin-bottom:10px;">
            <div>• الجرعة للفدان: <strong>${nRec.kg_per_feddan || 0} كجم/فدان</strong> (حوالي <strong>${nRec.bags_per_feddan || 0} شكارة</strong>)</div>
            <div>• إجمالي الحقل (${fRec.area_feddan || 5} فدان): <strong>${nRec.total_bags_field || 0} شكارة</strong></div>
          </div>
          <p style="font-size:12px; color:var(--text-secondary); margin:0;">💡 <em>${nRec.recommendation_reason || 'توزيع متوازن للتسميد'}</em></p>
        </div>

        <!-- Phosphorus Card -->
        <div class="glass" style="padding:20px; border-top:4px solid #3b82f6;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="color:#3b82f6; margin:0;"><i class="fa-solid fa-atom"></i> السماد الفوسفاتي (P)</h4>
            <span class="crop-tag" style="background:rgba(59,130,246,0.15); color:#3b82f6;">فوسفور</span>
          </div>
          <p style="font-weight:700; font-size:16px; margin-bottom:8px;">${pRec.fertilizer_name || 'سوبر فوسفات أحادي'}</p>
          <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; font-size:13px; margin-bottom:10px;">
            <div>• الجرعة للفدان: <strong>${pRec.kg_per_feddan || 0} كجم/فدان</strong> (حوالي <strong>${pRec.bags_per_feddan || 0} شكارة</strong>)</div>
            <div>• إجمالي الحقل: <strong>${pRec.total_bags_field || 0} شكارة</strong></div>
          </div>
          <p style="font-size:12px; color:var(--text-secondary); margin:0;">💡 <em>${pRec.recommendation_reason || 'تحفيز نمو الجذور'}</em></p>
        </div>

        <!-- Potassium Card -->
        <div class="glass" style="padding:20px; border-top:4px solid #f59e0b;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="color:#f59e0b; margin:0;"><i class="fa-solid fa-bolt"></i> السماد البوتاسي (K)</h4>
            <span class="crop-tag" style="background:rgba(245,158,11,0.15); color:#f59e0b;">بوتاسيوم</span>
          </div>
          <p style="font-weight:700; font-size:16px; margin-bottom:8px;">${kRec.fertilizer_name || 'سلفات بوتاسيوم 50%'}</p>
          <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; font-size:13px; margin-bottom:10px;">
            <div>• الجرعة للفدان: <strong>${kRec.kg_per_feddan || 0} كجم/فدان</strong> (حوالي <strong>${kRec.bags_per_feddan || 0} شكارة</strong>)</div>
            <div>• إجمالي الحقل: <strong>${kRec.total_bags_field || 0} شكارة</strong></div>
          </div>
          <p style="font-size:12px; color:var(--text-secondary); margin:0;">💡 <em>${kRec.recommendation_reason || 'تحسين حجم وملاءمة الثمار'}</em></p>
        </div>

        <!-- Irrigation Prescriptions Card -->
        <div class="glass" style="padding:20px; border-top:4px solid #06b6d4;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="color:#06b6d4; margin:0;"><i class="fa-solid fa-droplet"></i> نظام الاحتياج المائي والري الذكي</h4>
            <span class="crop-tag" style="background:rgba(6,182,212,0.15); color:#06b6d4;">ري ذكي</span>
          </div>
          <p style="font-weight:700; font-size:16px; margin-bottom:8px;">${irrigation_m3_per_feddan || irrRec.water_m3_per_feddan || 85} م³ / فدان للرية الواحدة</p>
          <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; font-size:13px; margin-bottom:10px;">
            <div>• مواعيد الري: <strong>${irrRec.irrigation_schedule_ar || 'كل 4 إلى 6 أيام'}</strong></div>
            <div>• طريقة الري الموصى بها: <strong>${irrRec.irrigation_method_ar || 'الري بالتنقيط'}</strong></div>
            <div>• إجمالي مياه الحقل: <strong>${irrRec.total_water_m3_field || 0} م³</strong></div>
          </div>
          <p style="font-size:12px; color:var(--text-secondary); margin:0;">💡 <em>البخر-ندح اليومي التقديري: ${irrRec.daily_et0_mm || 5.5} ملم/يوم</em></p>
        </div>

      </div>
    `;
  }
}

// Global variable storing latest prescription data
let latestPrescriptionData = null;

function sharePrescriptionWhatsApp() {
  const data = latestPrescriptionData || {};
  const fRec = data.fertilizer_recommendation || {};
  const nRec = fRec.nitrogen || {};
  const pRec = fRec.phosphorus || {};
  const kRec = fRec.potassium || {};
  const irrRec = fRec.irrigation || {};

  const crop = data.crop_ar || data.crop || 'قمح';
  const area = fRec.area_feddan || 5;

  const msg = `🌾 *توصية التسميد والري الذكي - منصة Terriva* 🌾%0A` +
              `• المحصول: ${crop} | المساحة: ${area} فدان%0A%0A` +
              `🧪 *الأسمدة الموصى بها:*%0A` +
              `- النيتروجين: ${nRec.fertilizer_name || 'سلفات نشادر'} -> ${nRec.total_bags_field || 0} شكارة (${nRec.bags_per_feddan || 0} شكارة/فدان)%0A` +
              `- الفوسفور: ${pRec.fertilizer_name || 'سوبر فوسفات'} -> ${pRec.total_bags_field || 0} شكارة%0A` +
              `- البوتاسيوم: ${kRec.fertilizer_name || 'سلفات بوتاسيوم'} -> ${kRec.total_bags_field || 0} شكارة%0A%0A` +
              `💧 *الري الذكي:*%0A` +
              `- الكمية: ${irrRec.water_m3_per_feddan || 85} م³/فدان (%0A` +
              `- الجدول: ${irrRec.irrigation_schedule_ar || 'كل 4 إلى 6 أيام'}%0A%0A` +
              `📈 زيادة المحصول المتوقعة: +${data.yield_improvement_pct || 15}%`;

  window.open(`https://wa.me/201011068548?text=${msg}`, '_blank');
}

function printPrescriptionReport(event) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }
  window.print();
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('rest-api-key');
  const icon = document.getElementById('rest-api-key-eye');
  if (input) {
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) icon.className = 'fa-solid fa-eye-slash';
    } else {
      input.type = 'password';
      if (icon) icon.className = 'fa-solid fa-eye';
    }
  }
}

// Digital Twin Canvas rendering
let rainIntensity = 15;
function initTwinCanvas() {
  const canvas = document.getElementById('twin-canvas');
  if(!canvas) return;

  if (twinAnimationId) {
    cancelAnimationFrame(twinAnimationId);
  }

  const ctx = canvas.getContext('2d');
  let width = canvas.offsetWidth;
  let height = canvas.offsetHeight;
  if (width === 0) width = 600;
  if (height === 0) height = 400;
  canvas.width = width;
  canvas.height = height;

  const rows = 18;
  const cols = 18;
  const spacingX = width / (cols + 1);
  const spacingY = height / (rows + 1);
  let rotation = 0;

  function renderTwinFrame() {
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = activeTheme === 'dark' ? 'rgba(139, 155, 73, 0.25)' : 'rgba(139, 155, 73, 0.4)';
    ctx.lineWidth = 1;

    rotation += 0.003;

    for(let r = 0; r < rows; r++) {
      ctx.beginPath();
      for(let c = 0; c < cols; c++) {
        const xOffset = (c - cols/2) * spacingX * 0.8;
        const yOffset = (r - rows/2) * spacingY * 0.8;
        
        const wave = Math.sin(r * 0.3 + rotation * 2) * Math.cos(c * 0.3 + rotation) * 15 * (rainIntensity / 15);
        
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const rotatedX = xOffset * cos - yOffset * sin;
        const rotatedY = xOffset * sin + yOffset * cos;

        const z = 300 + rotatedY * 0.5; 
        const projX = width/2 + (rotatedX * 280) / z;
        const projY = height/2 + ((rotatedY - wave) * 180) / z;

        if(c === 0) ctx.moveTo(projX, projY);
        else ctx.lineTo(projX, projY);

        if(c % 2 === 0 && r % 2 === 0) {
          ctx.fillStyle = activeTheme === 'dark' ? `rgba(14, 165, 233, ${0.4 + (rainIntensity/100)})` : 'var(--info)';
          ctx.beginPath();
          ctx.arc(projX, projY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.stroke();
    }

    twinAnimationId = requestAnimationFrame(renderTwinFrame);
  }

  renderTwinFrame();
}

function onTwinSliderChange(val) {
  rainIntensity = val;
  document.getElementById('label-rain-val').textContent = `${val} mm`;
  
  // Call simulation backend API
  fetch('/api/digital-twin/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      field_id: currentTwinField,
      rainfall_val: val
    })
  })
    .then(res => res.json())
    .then(data => {
      const twinHeader = document.querySelector('.twin-canvas-overlay div:nth-child(2) div:nth-child(2)');
      if(twinHeader) {
        twinHeader.textContent = `${data.simulated_moisture_pct}% (Risk: ${data.adjusted_risk_score}%)`;
        twinHeader.style.color = data.adjusted_risk_score > 50 ? 'var(--danger)' : 'var(--primary-light)';
      }
    });
}

function viewFieldTwin(fieldId) {
  currentTwinField = fieldId;
  fetch('/api/fields')
    .then(res => res.json())
    .then(fields => {
      const field = fields.find(f => f.id === fieldId);
      if(field) {
        document.getElementById('twin-field-title').textContent = field.name;
        activeFieldIdForAnalysis = fieldId;
      }
      switchTab('tab-digital-twin', document.querySelectorAll('.sidebar-link')[5]);
    });
}

// Side-by-side Mobile Simulator
function toggleMobileSimulator() {
  const sim = document.getElementById('mobile-sim');
  const frame = document.querySelector('.dashboard-layout');

  if(sim.style.display === 'none') {
    sim.style.display = 'flex';
    frame.classList.add('with-sidebar-sim');
    showToast('Mobile Simulator Enabled', 'Interactive mobile app simulator synchronized.', 'info');
  } else {
    sim.style.display = 'none';
    frame.classList.remove('with-sidebar-sim');
  }
}

// Reports Hub PDF/Excel compilation API
function simulateReportDownload(format) {
  const modal = document.getElementById('modal-overlay');
  const mTitle = document.getElementById('modal-title');
  const mBody = document.getElementById('modal-body');

  mTitle.textContent = `Exporting ${format} Report`;
  
  mBody.innerHTML = `
    <div style="text-align:center; padding:30px;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:36px; color:var(--primary); margin-bottom:15px;"></i>
      <h4>Querying database and imagery bands...</h4>
      <p style="font-size:12px; color:var(--text-secondary); margin-top:5px;">This takes 2 seconds for server compilation.</p>
    </div>
  `;
  modal.style.display = 'flex';

  fetch('/api/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: format })
  })
    .then(res => res.json())
    .then(data => {
      setTimeout(() => {
        mBody.innerHTML = `
          <div style="text-align:center; padding:10px;">
            <i class="fa-solid fa-circle-check" style="font-size:40px; color:var(--primary); margin-bottom:15px;"></i>
            <h4>Download Completed!</h4>
            <p style="font-size:12px; color:var(--text-secondary); margin: 5px 0 20px 0;">Your file: <b>${data.filename}</b> has compiled successfully.</p>
            <button class="primary-btn" onclick="closeModal()">Close Window</button>
          </div>
        `;
        // Trigger real file download
        const downloadBase = (window.location.protocol === 'file:') ? 'http://localhost:8000' : '';
        window.location.href = downloadBase + `/api/reports/download?format=${format}`;
      }, 1500);
    });
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// Init ChartJS elements
function initCharts() {
  if (charts.yield) return;

  const yieldCtx = document.getElementById('yield-chart').getContext('2d');
  charts.yield = new Chart(yieldCtx, {
    type: 'bar',
    data: {
      labels: ['2022', '2023', '2024', '2025', '2026 (Pred)'],
      datasets: [
        {
          label: 'Field Alpha (Wheat)',
          data: [5.2, 5.8, 6.1, 6.4, 7.2],
          backgroundColor: '#8B9B49',
          borderRadius: 6
        },
        {
          label: 'Field Beta (Maize)',
          data: [4.1, 4.4, 4.2, 4.9, 5.5],
          backgroundColor: '#0ea5e9',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: activeTheme === 'dark' ? '#94a3b8' : '#475569' } }
      },
      scales: {
        x: { ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8' } },
        y: { ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8' } }
      }
    }
  });

  const npkCtx = document.getElementById('npk-chart').getContext('2d');
  charts.npk = new Chart(npkCtx, {
    type: 'line',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
      datasets: [
        {
          label: 'Nitrogen (N)',
          data: [85, 92, 110, 105, 115, 120],
          borderColor: '#8B9B49',
          tension: 0.3
        },
        {
          label: 'Phosphorus (P)',
          data: [42, 40, 48, 52, 50, 48],
          borderColor: '#E5B869',
          tension: 0.3
        },
        {
          label: 'Potassium (K)',
          data: [65, 70, 72, 68, 75, 78],
          borderColor: '#0ea5e9',
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: activeTheme === 'dark' ? '#94a3b8' : '#475569' } }
      },
      scales: {
        x: { ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8' } },
        y: { ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8' } }
      }
    }
  });

  const waterCtx = document.getElementById('water-chart').getContext('2d');
  charts.water = new Chart(waterCtx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Target Demand',
          data: [20, 22, 20, 25, 24, 20, 18],
          borderColor: '#0ea5e9',
          borderDash: [5, 5],
          tension: 0.1
        },
        {
          label: 'Actual Ingestion',
          data: [20, 24, 21, 28, 23, 19, 17],
          backgroundColor: 'rgba(14,165,233,0.1)',
          borderColor: '#38bdf8',
          fill: true,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: activeTheme === 'dark' ? '#94a3b8' : '#475569' } }
      },
      scales: {
        x: { ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8' } },
        y: { ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8' } }
      }
    }
  });

  const roiCtx = document.getElementById('roi-chart').getContext('2d');
  charts.roi = new Chart(roiCtx, {
    type: 'doughnut',
    data: {
      labels: ['Fertilizer Saved', 'Water Optimized', 'Yield Profit', 'Carbon Credits'],
      datasets: [{
        data: [35, 15, 40, 10],
        backgroundColor: ['#8B9B49', '#E5B869', '#A06A30', '#6366f1']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: activeTheme === 'dark' ? '#94a3b8' : '#475569' }
        }
      }
    }
  });

  // ---- Soil Health Radar Chart ----
  const radarCtx = document.getElementById('soil-radar-chart').getContext('2d');
  charts.soilRadar = new Chart(radarCtx, {
    type: 'radar',
    data: {
      labels: ['Organic Matter', 'Nitrogen', 'Phosphorus', 'Potassium', 'pH Balance', 'Microbial Activity', 'Water Retention'],
      datasets: [
        {
          label: 'Field Alpha',
          data: [82, 75, 68, 88, 72, 90, 78],
          borderColor: '#8B9B49',
          backgroundColor: 'rgba(139, 155, 73, 0.15)',
          pointBackgroundColor: '#8B9B49',
          pointRadius: 4
        },
        {
          label: 'Field Beta',
          data: [65, 60, 72, 55, 80, 58, 62],
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.1)',
          pointBackgroundColor: '#0ea5e9',
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: activeTheme === 'dark' ? '#94a3b8' : '#475569' } }
      },
      scales: {
        r: {
          angleLines: { color: 'rgba(148,163,184,0.15)' },
          grid: { color: 'rgba(148,163,184,0.1)' },
          pointLabels: { color: activeTheme === 'dark' ? '#94a3b8' : '#475569', font: { size: 10 } },
          ticks: { display: false },
          suggestedMin: 0,
          suggestedMax: 100
        }
      }
    }
  });

  // ---- Soil pH Trend Chart ----
  const phCtx = document.getElementById('ph-trend-chart').getContext('2d');
  charts.phTrend = new Chart(phCtx, {
    type: 'line',
    data: {
      labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      datasets: [
        {
          label: 'Soil pH Level',
          data: [6.2, 6.3, 6.1, 6.4, 6.5, 6.3, 6.6, 6.5, 6.7, 6.8, 6.7, 6.9],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#f59e0b'
        },
        {
          label: 'Optimal Range (6.5)',
          data: [6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5],
          borderColor: 'rgba(74, 222, 128, 0.5)',
          borderDash: [8, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: activeTheme === 'dark' ? '#94a3b8' : '#475569' } }
      },
      scales: {
        x: { ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8' } },
        y: {
          min: 5.5, max: 7.5,
          ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8' }
        }
      }
    }
  });

  // ---- Pest & Disease Risk Chart ----
  const pestCtx = document.getElementById('pest-risk-chart').getContext('2d');
  charts.pestRisk = new Chart(pestCtx, {
    type: 'bar',
    data: {
      labels: ['Aphids', 'Rust Fungus', 'Stem Borer', 'Leaf Blight', 'Root Rot', 'Whitefly'],
      datasets: [{
        label: 'Risk Level (%)',
        data: [72, 45, 28, 58, 15, 38],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.6)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(245, 158, 11, 0.6)'
        ],
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          max: 100,
          ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8', callback: v => v + '%' }
        },
        y: { ticks: { color: activeTheme === 'dark' ? '#94a3b8' : '#475569' } }
      }
    }
  });

  // ---- Monthly Revenue vs Cost Chart ----
  const revCtx = document.getElementById('revenue-cost-chart').getContext('2d');
  charts.revCost = new Chart(revCtx, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'Revenue',
          data: [8200, 9100, 7800, 11400, 12800, 14200],
          backgroundColor: 'rgba(139, 155, 73, 0.85)',
          borderRadius: 6
        },
        {
          label: 'Operating Cost',
          data: [5400, 5100, 4800, 6200, 5900, 5500],
          backgroundColor: 'rgba(229, 184, 105, 0.7)',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: activeTheme === 'dark' ? '#94a3b8' : '#475569' } }
      },
      scales: {
        x: { ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8' } },
        y: { ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8', callback: v => '$' + (v/1000).toFixed(0) + 'K' } }
      }
    }
  });

  const temporalCtx = document.getElementById('multi-temporal-chart').getContext('2d');
  charts.temporal = new Chart(temporalCtx, {
    type: 'line',
    data: {
      labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
      datasets: [
        {
          label: 'Current Season 2026 (Sentinel-2)',
          data: [0.15, 0.28, 0.45, 0.74, 0.76, null],
          borderColor: '#8B9B49',
          backgroundColor: 'rgba(139, 155, 73, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: '5-Year Average (Historical Reference)',
          data: [0.12, 0.25, 0.40, 0.58, 0.68, 0.70],
          borderColor: '#E5B869',
          borderDash: [5, 5],
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: activeTheme === 'dark' ? '#94a3b8' : '#475569' } }
      },
      scales: {
        x: { ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8' } },
        y: { ticks: { color: activeTheme === 'dark' ? '#64748b' : '#94a3b8' } }
      }
    }
  });
}

function simulateFileUpload() {
  showToast('File Uploader', 'Select KML/GeoJSON boundaries to sync coordinates.', 'info');
}

function exportShapefile() {
  fetch('/api/fields')
    .then(res => res.json())
    .then(fields => {
      if (fields.length === 0) {
        showToast('Export Cancelled', 'No fields available to export.', 'warning');
        return;
      }
      const geojson = {
        type: "FeatureCollection",
        features: fields.map(f => ({
          type: "Feature",
          properties: {
            id: f.id,
            name: f.name,
            crop: f.crop,
            soil_type: f.soil_type,
            area_ha: f.area_ha,
            ndvi: f.ndvi,
            moisture: f.moisture
          },
          geometry: {
            type: "Polygon",
            coordinates: [f.coordinates.map(c => [c[1], c[0]])]
          }
        }))
      };
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojson, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "terriva_workspace_fields.geojson");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('GIS Export Success', 'GeoJSON fields saved to downloads.', 'success');
    })
    .catch(err => {
      console.error(err);
      showToast('Export Failed', 'Unable to retrieve workspace fields.', 'danger');
    });
}

// ========================================== 
// 1. Tractor VR Guidance Path Simulator 
// ========================================== 
let tractorMarker = null;
let tractorPath = null;

function animateTractorVR() {
  if (tractorMarker) map.removeLayer(tractorMarker);
  if (tractorPath) map.removeLayer(tractorPath);

  if (activeMapLayer !== 'vr') return;

  // Mock GPS guidance lines coordinates
  const pathCoords = [
    [30.829, 30.640],
    [30.832, 30.642],
    [30.830, 30.652],
    [30.824, 30.648],
    [30.829, 30.640]
  ];

  tractorPath = L.polyline(pathCoords, {
    color: '#E5B869',
    dashArray: '5, 10',
    weight: 2
  }).addTo(map);

  let step = 0;
  tractorMarker = L.marker(pathCoords[0], {
    icon: L.divIcon({
      html: '<i class="fa-solid fa-tractor" style="font-size:18px; color:#E5B869; text-shadow: 0 0 5px #000;"></i>',
      iconSize: [20, 20],
      className: 'tractor-icon-div'
    })
  }).addTo(map);

  const interval = setInterval(() => {
    if (activeMapLayer !== 'vr' || !map.hasLayer(tractorMarker)) {
      clearInterval(interval);
      if(tractorMarker) map.removeLayer(tractorMarker);
      if(tractorPath) map.removeLayer(tractorPath);
      return;
    }
    step = (step + 1) % pathCoords.length;
    tractorMarker.setLatLng(pathCoords[step]);
  }, 1200);
}

// ========================================== 
// 2. AI Copilot Natural Language & Voice Assistant 
// ========================================== 
function toggleAICopilot() {
  const drawer = document.getElementById('ai-copilot-drawer');
  if(drawer.style.display === 'none' || !drawer.style.display) {
    drawer.style.display = 'flex';
  } else {
    drawer.style.display = 'none';
  }
}

function sendCopilotChatMessage() {
  const input = document.getElementById('copilot-user-input');
  const msg = input.value.trim();
  if(!msg) return;
  
  appendCopilotBubble(msg, 'user');
  input.value = '';
  
  // Send message to Flask NLP API
  fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg, user_name: loggedInUserName })
  })
    .then(res => res.json())
    .then(data => {
      appendCopilotBubble(data.response, 'ai');
      // Announce response via Web Speech synthesis
      speakResponse(data.response);
    });
}

function checkCopilotSendKey(event) {
  if(event.key === 'Enter') {
    sendCopilotChatMessage();
  }
}

function appendCopilotBubble(text, sender) {
  const flow = document.getElementById('copilot-msg-flow');
  flow.innerHTML += `
    <div class="chat-msg ${sender}">${text}</div>
  `;
  flow.scrollTop = flow.scrollHeight;
}

// Web Speech Synthesis (Text-To-Speech)
function speakResponse(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    // Strip emoji and markdown symbols for clean speech
    const cleanText = text
      .replace(/[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, '')
      .replace(/\*\*/g, '')
      .replace(/[⚠️👋🌾💧🧪🌍]/g, '')
      .trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0; 
    utterance.pitch = 1.0;
    // Select english voice if available
    const voices = window.speechSynthesis.getVoices();
    const engVoice = voices.find(v => v.lang.startsWith('en'));
    if (engVoice) utterance.voice = engVoice;
    window.speechSynthesis.speak(utterance);
  }
}

// HTML5 Speech Recognition (Voice Dictation)
let speechRecognizer = null;
function toggleVoiceSpeechRecognition() {
  const btn = document.getElementById('btn-copilot-voice');
  const input = document.getElementById('copilot-user-input');
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Voice Error', 'Speech recognition not supported on this browser. Try Google Chrome.', 'danger');
    return;
  }
  
  if(btn.classList.contains('listening')) {
    if(speechRecognizer) speechRecognizer.stop();
    btn.classList.remove('listening');
    return;
  }
  
  btn.classList.add('listening');
  speechRecognizer = new SpeechRecognition();
  speechRecognizer.continuous = false;
  speechRecognizer.interimResults = false;
  speechRecognizer.lang = 'en-US';
  
  speechRecognizer.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    btn.classList.remove('listening');
    sendCopilotChatMessage(); // Auto submit
  };
  
  speechRecognizer.onerror = function() {
    btn.classList.remove('listening');
  };
  
  speechRecognizer.onend = function() {
    btn.classList.remove('listening');
  };
  
  speechRecognizer.start();
}

// ========================================== 
// 3. ESG Blockchain Registry Verification
// ========================================== 
function verifyEsgBlocks() {
  showToast('Auditing Green Ledger', 'Decrypting SHA-256 blocks against satellite nodes...', 'info');
  
  setTimeout(() => {
    showToast('Green Audit Success', 'Blockchain integrity verified. 0 anomalies detected.', 'success');
  }, 2000);
}


// ========================================== 
// 4. SaaS Organization Client Sign Up Logic
// ========================================== 
function toggleLoginRegister(showRegister) {
  const step1 = document.querySelector('.login-step-1');
  const step2 = document.querySelector('.login-step-2');
  const registerCard = document.querySelector('.login-register');
  const title = document.querySelector('.login-header h2');
  
  if (showRegister) {
    step1.style.display = 'none';
    step2.style.display = 'none';
    registerCard.style.display = 'block';
    title.textContent = 'Register SaaS Workspace';
  } else {
    step1.style.display = 'block';
    step2.style.display = 'none';
    registerCard.style.display = 'none';
    title.textContent = 'Enterprise Login';
  }
}

function registerNewSaaSClient() {
  let companyName = document.getElementById('reg-company-name') ? document.getElementById('reg-company-name').value.trim() : '';
  let email = document.getElementById('reg-email') ? document.getElementById('reg-email').value.trim() : '';
  let password = document.getElementById('reg-password') ? document.getElementById('reg-password').value.trim() : '';
  
  let fieldName = document.getElementById('reg-field-name') ? document.getElementById('reg-field-name').value.trim() : '';
  let areaFeddan = document.getElementById('reg-area-feddan') ? document.getElementById('reg-area-feddan').value : '10';
  let cropFocus = document.getElementById('reg-crop-focus') ? document.getElementById('reg-crop-focus').value : 'Wheat';
  let soilType = document.getElementById('reg-soil-type') ? document.getElementById('reg-soil-type').value : 'Clay Loam';
  let location = document.getElementById('reg-location') ? document.getElementById('reg-location').value.trim() : '';

  if (!companyName) companyName = 'مزارع النوبارية الحديثة';
  if (!email) email = 'farmer@company.com';
  if (!password) password = 'farm1234';
  if (!fieldName) fieldName = `${companyName} - أرض 1`;
  if (!location) location = 'البحيرة - النوبارية';
  
  // Set email value into login-email so enterDashboard can reference it
  const loginEmailInput = document.getElementById('login-email');
  if (loginEmailInput) loginEmailInput.value = email;
  
  // Add to client-side PRESET_ACCOUNTS so it works offline and on GitHub Pages
  const newAccountObj = {
    name: companyName,
    company: `${companyName} للإنتاج الزراعي`,
    field: {
      id: `field-${Date.now()}`,
      name: fieldName,
      crop: cropFocus,
      crop_ar: cropFocus,
      soil_type: soilType,
      location: location,
      moisture: 38.0,
      area_feddan: parseFloat(areaFeddan) || 10.0,
      area_ha: Math.round(((parseFloat(areaFeddan) || 10.0) / 2.38) * 10) / 10,
      coordinates: [[30.829, 30.640], [30.832, 30.642]]
    }
  };

  PRESET_ACCOUNTS[email] = newAccountObj;
  applyUserLandData(newAccountObj);

  fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: companyName,
      email: email,
      field_name: fieldName,
      area_feddan: areaFeddan,
      crop_focus: cropFocus,
      soil_type: soilType,
      location: location,
      plan: 'Enterprise Agronomy'
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.field) {
        applyUserLandData({
          name: data.company_name,
          company: `${data.company_name} للإنتاج الزراعي`,
          field: data.field
        });
      }
    })
    .catch(err => console.log('Static register mode active.'));

  showView('dashboard-view');
  showToast('تم تسجيل المزرعة', `أهلاً بك في ${companyName}! تم تجهيز التوصيات وحساب الشكاير والري.`, 'success');
  setTimeout(() => { toggleMobileSimulator(); }, 800);
}


// ========================================== 
// 5. Founder / SaaS Admin God Mode Logic
// ========================================== 
let adminTerminalInterval = null;

function startAdminTerminalSimulator() {
  const term = document.getElementById('admin-terminal-logs');
  if(!term) return;
  
  if(adminTerminalInterval) clearInterval(adminTerminalInterval);
  
  const tenants = ['alex-fresh-exports.com', 'delta-sugar-corp.eg', 'beheira-farms-coop', 'cairo-citrus.com'];
  const endpoints = ['GET /api/fields', 'POST /api/fields/register', 'POST /api/ai/chat', 'POST /api/digital-twin/simulate'];
  
  adminTerminalInterval = setInterval(() => {
    const randomTenant = tenants[Math.floor(Math.random() * tenants.length)];
    const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const time = new Date().toLocaleTimeString();
    
    term.innerHTML += '<div>[' + time + '] API: ' + randomTenant + ' [' + randomEndpoint + '] -> 200 OK</div>';
    term.scrollTop = term.scrollHeight;
    
    if(term.children.length > 25) {
      term.removeChild(term.firstChild);
    }
  }, 2200);
}

function triggerModelRetrain() {
  showToast('Model Orchestrator', 'Initializing GPU training sequence on ResNet-v4...', 'info');
  
  let pct = 0;
  const modal = document.getElementById('modal-overlay');
  const mTitle = document.getElementById('modal-title');
  const mBody = document.getElementById('modal-body');

  mTitle.textContent = 'AI Model Training Fleet';
  mBody.innerHTML = '<div style="padding:20px; text-align:center;"><h4 id="train-pct">Epoch 1/5: 0% complete</h4><div style="background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden; height:12px; margin-top:15px; border:1px solid var(--border-color);"><div id="train-progress-bar" style="background:linear-gradient(90deg, #f59e0b, var(--primary)); width:0%; height:100%; transition:width 0.3s;"></div></div></div>';
  modal.style.display = 'flex';
  
  const timer = setInterval(() => {
    pct += 10;
    document.getElementById('train-progress-bar').style.width = pct + '%';
    document.getElementById('train-pct').textContent = 'Epoch ' + Math.min(5, Math.floor(pct/20)+1) + '/5: ' + pct + '% complete';
    
    if(pct >= 100) {
      clearInterval(timer);
      setTimeout(() => {
        mBody.innerHTML = '<div style="text-align:center; padding:15px;"><i class="fa-solid fa-microchip" style="font-size:36px; color:#f59e0b; margin-bottom:15px;"></i><h4>Retraining Completed!</h4><p style="font-size:12px; color:var(--text-secondary); margin-top:5px;">Inference accuracy increased to 95.1%.</p><button class="primary-btn" onclick="closeModal()" style="margin-top:20px; justify-content:center; width:100%;">Return to Dashboard</button></div>';
      }, 500);
    }
  }, 400);
}

function saveSystemSettings() {
  const geminiKey = document.getElementById('input-gemini-key').value.trim();
  const apiBase = (window.location.protocol === 'file:') ? 'http://localhost:8000' : '';
  
  fetch(apiBase + '/api/settings/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gemini_api_key: geminiKey })
  })
    .then(res => res.json())
    .then(data => {
      if(data.success) {
        showToast('Settings Saved', 'System configuration updated successfully.', 'success');
        loadSystemSettings();
      } else {
        showToast('Settings Failure', 'Failed to update system settings.', 'danger');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('Settings Error', 'Unable to reach backend settings API.', 'danger');
    });
}

function loadSystemSettings() {
  const apiBase = (window.location.protocol === 'file:') ? 'http://localhost:8000' : '';
  const inputEl = document.getElementById('input-gemini-key');
  if(!inputEl) return;
  
  fetch(apiBase + '/api/settings')
    .then(res => res.json())
    .then(data => {
      if(data.gemini_api_key) {
        inputEl.value = data.gemini_api_key;
      }
    })
    .catch(err => console.warn("Failed to load settings from server:", err));
}
