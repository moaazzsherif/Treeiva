/* Terriva Flutter Mobile App Simulator Logic */

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

window.addEventListener('DOMContentLoaded', () => {
  initMobileSimulator();
});

function initMobileSimulator() {
  setTimeout(() => {
    transitionPhonePage('phone-splash-screen', 'phone-onboard-screen');
  }, 3000);
}

function transitionPhonePage(fromId, toId) {
  const fromPage = document.getElementById(fromId);
  const toPage = document.getElementById(toId);

  if (fromPage && toPage) {
    fromPage.classList.remove('active');
    toPage.classList.add('active');
  }
}

function mobileNextOnboard() {
  transitionPhonePage('phone-onboard-screen', 'phone-login-screen');
}

function mobileLogin() {
  transitionPhonePage('phone-login-screen', 'phone-main-portal');
  showToast('Mobile Device Sync', 'Mobile app linked to cloud workspace successfully.', 'info');
  mobileLoadFields();
}

// Fetch fields from Flask API and render in mobile list
function mobileLoadFields() {
  const listContainer = document.querySelector('#phone-sub-dashboard div:nth-of-type(2)');
  if (!listContainer) return;

  fetch('/api/fields')
    .then(res => res.json())
    .then(fields => {
      listContainer.innerHTML = '';
      fields.forEach(field => {
        listContainer.innerHTML += `
          <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor: pointer; margin-bottom: 8px;" onclick="mobileSelectField('${field.id}')">
            <div>
              <div style="font-size:13px; font-weight:600;">${field.name}</div>
              <div style="font-size:10px; opacity:0.6;">${field.crop} &bull; ${field.soil_type}</div>
            </div>
            <i class="fa-solid fa-chevron-right" style="opacity:0.5; font-size:12px;"></i>
          </div>
        `;
      });
    });
}

function mobileSelectField(fieldId) {
  // Pull info to show sat diagnostics on mobile Sat subpage
  fetch('/api/fields')
    .then(res => res.json())
    .then(fields => {
      const field = fields.find(f => f.id === fieldId);
      if(field) {
        const satSub = document.getElementById('phone-sub-satellite');
        satSub.querySelector('h4').textContent = `${field.name} Diagnostics`;
        satSub.querySelector('p').textContent = `NDVI Index calculated at ${field.ndvi}. Moisture saturation index reads ${field.moisture}% (Optimal target 50%).`;
        switchPhoneSubscreen('satellite');
      }
    });
}

function switchPhoneSubscreen(subpageName) {
  const screens = {
    dashboard: 'phone-sub-dashboard',
    satellite: 'phone-sub-satellite',
    sampler: 'phone-sub-sampler',
    sensor: 'phone-sub-sensor',
    profile: 'phone-sub-profile'
  };

  Object.values(screens).forEach(screenId => {
    const el = document.getElementById(screenId);
    if(el) el.style.display = 'none';
  });

  const activeId = screens[subpageName];
  const activeEl = document.getElementById(activeId);
  if(activeEl) activeEl.style.display = 'block';

  // Toggle navigation item highlights
  const navItems = document.querySelectorAll('.phone-nav-bar .phone-nav-item');
  navItems.forEach(item => {
    item.classList.remove('active');
  });

  if(subpageName === 'dashboard') {
    navItems[0].classList.add('active');
    mobileLoadFields(); // refresh
  }
  else if(subpageName === 'satellite') navItems[1].classList.add('active');
  else if(subpageName === 'sampler') navItems[2].classList.add('active');
  else if(subpageName === 'profile') navItems[3].classList.add('active');
}

// Mobile GPS Sample simulator pins a field boundary directly around user's current GPS location
function simulateGpsLock() {
  const statusLabel = document.getElementById('phone-gps-status');
  statusLabel.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Locating RTK constellation...`;
  
  setTimeout(() => {
    statusLabel.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Resolving precision coords...`;
  }, 1000);

  setTimeout(() => {
    statusLabel.innerHTML = `<span class="text-success" style="color:var(--primary); font-weight:700;"><i class="fa-solid fa-circle-check"></i> Coords Locked (Accuracy: ±2cm)<br>Lat: ${deviceLat.toFixed(4)}, Lng: ${deviceLon.toFixed(4)}</span>`;
    
    // Register drawn field boundary around device coordinates
    const d = 0.001; // ~100m square
    const coordinates = [
      [deviceLat + d, deviceLon - d],
      [deviceLat + d, deviceLon + d],
      [deviceLat - d, deviceLon + d],
      [deviceLat - d, deviceLon - d]
    ];

    fetch('/api/fields/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Mobile Soil Spot ${Math.floor(Math.random() * 900) + 100}`,
        crop: "Alfalfa",
        soil_type: "Silt Loam",
        coordinates: coordinates
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast('Mobile Spot Pinned', 'New boundary synced to main dashboard database.', 'success');
          // Reload dashboard components globally
          loadFieldsTable();
          drawFieldsOnMap();
        }
      });

  }, 2200);
}

// Sync bluetooth sensor NPK inputs
function simulateSensorUpload() {
  const npkVal = document.querySelector('#phone-sub-sensor input').value || "120-45-75";
  const parts = npkVal.split('-');
  const nVal = parseFloat(parts[0]) || 120;
  
  showToast('Bluetooth Soil Probe Synced', `Ingested Telemetry values: N=${parts[0] || 120}, P=${parts[1] || 45}, K=${parts[2] || 75}`, 'success');
  
  // Update a mock boundary field in database to reflect new telemetry moisture
  fetch('/api/fields')
    .then(res => res.json())
    .then(fields => {
      const targetField = fields[0];
      if (targetField) {
        // Register an update by re-registering
        fetch('/api/fields/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: targetField.name,
            crop: targetField.crop,
            soil_type: targetField.soil_type,
            coordinates: targetField.coordinates
          })
        })
          .then(() => {
            loadFieldsTable();
            drawFieldsOnMap();
            switchPhoneSubscreen('dashboard');
          });
      }
    });
}

let offlineActive = false;
function toggleOfflineMode() {
  offlineActive = !offlineActive;
  if(offlineActive) {
    showToast('Offline Mode Enabled', 'Satellite vegetation tiles cached for local work.', 'warning');
  } else {
    showToast('Online Mode Connected', 'Re-synchronized database with main server.', 'success');
  }
}

function phoneLogout() {
  transitionPhonePage('phone-main-portal', 'phone-login-screen');
  showToast('Session Closed', 'Mobile token cleared.', 'info');
}
