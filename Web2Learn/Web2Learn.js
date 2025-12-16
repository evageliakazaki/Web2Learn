// ** CONFIGURATION **
const API_URL = "https://api.smartcitizen.me/v0/devices/";

// SENSOR ID MAPPING 
const SENSOR_MAPPING = {
    TEMP_ID: 55,       // Sensirion SHT31 - Temperature
    HUMIDITY_ID: 56,   // Sensirion SHT31 - Humidity
    PM25_ID: 194,      // Sensirion SEN5X - PM2.5
    NOISE_ID: 53,      // TDK ICS43432 - Noise Level
    PRESSURE_ID: 58,   // NXP MPL3115A2 - Barometric Pressure
    UV_ID: 214         // AMS AS7731 - UVA
};

// ** 1. FETCH LIVE DATA **
const getSensorData = async (deviceId) => {
    try {
        const response = await fetch(API_URL + deviceId);
        if (!response.ok) throw new Error(`Response Error: ${response.status}`);
        const device = await response.json();
        
        const targetIds = Object.values(SENSOR_MAPPING);
        const selected = device.data.sensors
            .filter(sensor => targetIds.includes(sensor.id))
            .map(sensor => ({
                id: sensor.id,
                name: sensor.name, 
                value: sensor.value ?? null,
                unit: sensor.unit,
                timestamp: sensor.last_reading_at
            }));

        const locationInfo = {
            name: device.name,
            city: device.location?.city || "Unknown City",
            country: device.location?.country || "Greece",
            id: device.id,
            latitude: device.location?.latitude,
            longitude: device.location?.longitude
        };

        return { sensors: selected, info: locationInfo };

    } catch (error) {
        console.error("Live Data Error:", error.message);
        return { sensors: [], info: null };
    }
};

// ** 2. FETCH HISTORICAL DATA (Matches your URL exactly) **
const getHistoricalReadings = async (deviceId, sensorId, from, to, rollup = "4h") => {
    // URL Structure: .../readings?sensor_id=55&rollup=4h&from=2025-11-25&to=2025-11-30
    const historyUrl = `${API_URL}${deviceId}/readings?sensor_id=${sensorId}&rollup=${rollup}&from=${from}&to=${to}`;
    console.log("Fetching History:", historyUrl); 

    try {
        const response = await fetch(historyUrl);
        if (!response.ok) throw new Error(`Historical Error: ${response.status}`);
        const data = await response.json();
        return data.readings;
    } catch (error) {
        console.error("History Fetch Failed:", error.message);
        return [];
    }
};

// ** 3. UPDATE HIGH / LOW WIDGET **
async function updateHighLow(deviceId, referenceDateStr) {
    // 1. Determine the Date Range
    // If we have a last reading date (e.g. 2025-11-29), use that. Otherwise use today.
    const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
    
    // Create "from" date (start of that day)
    const fromDate = new Date(refDate);
    // Format to YYYY-MM-DD
    const fromStr = fromDate.toISOString().split('T')[0];
    
    // Create "to" date (the next day, to ensure we get the full 24h of the "from" day)
    const toDate = new Date(refDate);
    toDate.setDate(toDate.getDate() + 1);
    const toStr = toDate.toISOString().split('T')[0];

    // 2. Fetch History using your specific settings (Rollup 4h)
    const readings = await getHistoricalReadings(deviceId, SENSOR_MAPPING.TEMP_ID, fromStr, toStr, "4h");

    if (!readings || readings.length === 0) {
        console.warn("No historical data found.");
        document.querySelector(".high-item .temp").innerHTML = "--";
        document.querySelector(".low-item .temp").innerHTML = "--";
        return;
    }

    // 3. Process Data
    const values = readings.map(r => r[1]).filter(v => v !== null);

    if (values.length > 0) {
        const maxTemp = Math.max(...values);
        const minTemp = Math.min(...values);

        const highEl = document.querySelector(".high-item .temp");
        const lowEl = document.querySelector(".low-item .temp");

        if (highEl) highEl.innerHTML = `${Math.round(maxTemp)}<sup>°C</sup>`;
        if (lowEl) lowEl.innerHTML = `${Math.round(minTemp)}<sup>°C</sup>`;
    }
}

// ** 4. UPDATE HIGHLIGHT CARDS **
function updateHighlights(sensorData) {
    const cards = document.querySelectorAll(".highlights .card");

    cards.forEach(card => {
        const type = card.dataset.type;
        const valueElement = card.querySelector(".value");
        if (!type || !valueElement) return;

        let sensorId;
        switch(type) {
            case "temp": sensorId = SENSOR_MAPPING.TEMP_ID; break;
            case "humidity": sensorId = SENSOR_MAPPING.HUMIDITY_ID; break;
            case "pm25": sensorId = SENSOR_MAPPING.PM25_ID; break;
            case "noise-level": sensorId = SENSOR_MAPPING.NOISE_ID; break;
            default: return;
        }

        const sensor = sensorData.find(s => s.id === sensorId);
        if (!sensor || sensor.value === null) {
            valueElement.textContent = "--";
            return;
        }

        const value = parseFloat(sensor.value);
        const displayValue = (type === 'pm25' || type === 'noise-level') 
            ? Math.round(value) 
            : value.toFixed(1);

        valueElement.textContent = displayValue + (sensor.unit || "");
        valueElement.dataset.value = value;

        card.classList.remove("card-blue", "card-orange", "card-red");
        switch(type){
            case "temp":
                if (value <= 10) card.classList.add("card-blue");
                else if (value < 25) card.classList.add("card-orange");
                else card.classList.add("card-red");
                break;
            case "humidity":
                if (value < 30) card.classList.add("card-blue");
                else if (value <= 60) card.classList.add("card-orange");
                else card.classList.add("card-red");
                break;
            case "pm25": 
                if (value <= 12) card.classList.add("card-blue");
                else if (value <= 35) card.classList.add("card-orange");
                else card.classList.add("card-red");
                break;
            case "noise-level": 
                if (value < 40) card.classList.add("card-blue");
                else if (value <= 70) card.classList.add("card-orange");
                else card.classList.add("card-red");
                break;
        }
    });
}

// ** 5. UPDATE MAIN METRIC PANEL **
function applyMetric(metricKey, sensorData) {
    let selectedSensor;
    let qualityText = "N/A";
    let qualityClass = "moderate"; 

    switch(metricKey) {
        case "temperature": 
            selectedSensor = sensorData.find(s => s.id === SENSOR_MAPPING.TEMP_ID);
            if (selectedSensor) {
                const val = parseFloat(selectedSensor.value);
                if (val <= 10) { qualityText = "Cold"; qualityClass = "blue"; } 
                else if (val < 25) { qualityText = "Normal"; qualityClass = "good"; }
                else { qualityText = "Hot"; qualityClass = "bad"; }
            }
            break;

        case "aqi": 
            selectedSensor = sensorData.find(s => s.id === SENSOR_MAPPING.HUMIDITY_ID);
            if (selectedSensor) {
                const val = parseFloat(selectedSensor.value);
                if (val < 30) { qualityText = "Dry"; qualityClass = "moderate"; }
                else if (val <= 60) { qualityText = "Ideal"; qualityClass = "good"; }
                else { qualityText = "Humid"; qualityClass = "bad"; }
            }
            break;

        case "pm25": 
            selectedSensor = sensorData.find(s => s.id === SENSOR_MAPPING.PM25_ID);
            if (selectedSensor) {
                const val = parseFloat(selectedSensor.value);
                if (val <= 12) { qualityText = "Good"; qualityClass = "good"; }
                else if (val <= 35.4) { qualityText = "Moderate"; qualityClass = "moderate"; }
                else { qualityText = "Unhealthy"; qualityClass = "bad"; }
            }
            break;

        case "noise-level": 
            selectedSensor = sensorData.find(s => s.id === SENSOR_MAPPING.NOISE_ID);
            if (selectedSensor) {
                const val = parseFloat(selectedSensor.value);
                if (val < 40) { qualityText = "Quiet"; qualityClass = "good"; }
                else if (val <= 70) { qualityText = "Normal"; qualityClass = "moderate"; }
                else { qualityText = "Loud"; qualityClass = "bad"; }
            }
            break;
            
        default: return;
    }

    if (selectedSensor) {
        document.getElementById("today-status-label").textContent = selectedSensor.name;
        
        const displayVal = (metricKey === 'pm25' || metricKey === 'noise-level') 
            ? Math.round(selectedSensor.value) 
            : parseFloat(selectedSensor.value).toFixed(1);

        document.getElementById("today-main-number").textContent = displayVal;
        document.getElementById("today-main-unit").textContent = selectedSensor.unit;

        const qLabel = document.getElementById("today-quality-label");
        qLabel.textContent = qualityText;
        qLabel.classList.remove("quality-good","quality-moderate","quality-bad", "quality-blue");
        
        if(qualityClass === 'blue') qLabel.classList.add("quality-good"); 
        else qLabel.classList.add("quality-" + qualityClass);
    }
}

// ** 6. UPDATE AUXILIARY DATA **
function applyRealtimeData(sensorData) {
    const temp = sensorData.find(s => s.id === SENSOR_MAPPING.TEMP_ID);
    const hum = sensorData.find(s => s.id === SENSOR_MAPPING.HUMIDITY_ID);
    const pm25 = sensorData.find(s => s.id === SENSOR_MAPPING.PM25_ID);
    const noise = sensorData.find(s => s.id === SENSOR_MAPPING.NOISE_ID);

    if (temp) document.getElementById("today-temp").textContent = Math.round(temp.value) + "°C";
    if (hum) document.getElementById("today-humidity").textContent = Math.round(hum.value) + "%";
    if (pm25) {
        const pmEl = document.getElementById("today-pm25"); 
        if(pmEl) pmEl.textContent = Math.round(pm25.value) + " µg/m³";
    }
    if (noise) {
         const uvEl = document.getElementById("today-uv"); 
         if(uvEl) uvEl.textContent = Math.round(noise.value) + " dB";
    }
}

// ** MAIN RUNNER **
async function updateDashboard() {
    const params = new URLSearchParams(window.location.search);
    const deviceId = params.get("id") || "19225"; 

    // --- 1. Fetch Live Data ---
    const result = await getSensorData(deviceId);
    
    const labelEl = document.getElementById("sensorLabel");
    if (labelEl) {
        if(result.info && result.info.name) {
            labelEl.textContent = `${result.info.city} - ${result.info.name}`;
        } else {
            labelEl.textContent = "Loading...";
        }
    }

    const sensorData = result.sensors;

    if (sensorData.length > 0) {
        updateHighlights(sensorData);
        applyRealtimeData(sensorData);

        // Get Timestamp of last reading to ensure High/Low works even if sensor is offline
        const tempSensor = sensorData.find(s => s.id === SENSOR_MAPPING.TEMP_ID);
        const lastReading = tempSensor ? tempSensor.timestamp : null;

        // Initialize Tabs
        const tabs = document.querySelectorAll(".today-tab");
        tabs.forEach(tab => {
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);

            newTab.addEventListener("click", () => {
                document.querySelectorAll(".today-tab").forEach(t => t.classList.remove("active"));
                newTab.classList.add("active");
                applyMetric(newTab.dataset.metric, sensorData);
            });
        });

        // Trigger Default Tab
        const defaultTab = document.querySelector('.today-tab.active') || document.querySelector('.today-tab');
        if (defaultTab) {
            applyMetric(defaultTab.dataset.metric, sensorData);
        }

        // --- 2. Update High/Low using Last Reading Date ---
        await updateHighLow(deviceId, lastReading);

    } else {
        console.warn("No live sensor data found.");
        if(labelEl) labelEl.textContent = "Sensor Offline or No Data";
    }
}

// ** START **
document.addEventListener("DOMContentLoaded", () => {
    updateDashboard();
});