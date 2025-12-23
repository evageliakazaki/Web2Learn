// ** CONFIGURATION **
const API_URL = "https://api.smartcitizen.me/v0/devices/";

// SENSOR ID MAPPING
const SENSOR_MAPPING = {
    TEMP_ID: 55,       // Temperature
    HUMIDITY_ID: 56,   // Humidity
    PM25_ID: 194,      // PM2.5
    NOISE_ID: 53,      // Noise
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

// ** 2. FETCH HISTORICAL DATA **
const getHistoricalReadings = async (deviceId, sensorId, from, to, rollup = "4h") => {
    const historyUrl = `${API_URL}${deviceId}/readings?sensor_id=${sensorId}&rollup=${rollup}&from=${from}&to=${to}`;
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

// ✅ NEW: Fill today-card with last 5 days temperature
// Requires HTML container: <div class="today-history-list"></div>
async function updateTodayCardLastFiveDays(deviceId) {
    const container = document.querySelector(".today-temperature-list");
    if (!container) return;

    container.innerHTML = "";

    // === 1. Πάρε LIVE θερμοκρασία (για ΣΗΜΕΡΑ) ===
    const liveData = await getSensorData(deviceId);
    const tempSensor = liveData.sensors.find(s => s.id === SENSOR_MAPPING.TEMP_ID);

    const today = new Date();
    const todayKey = today.toISOString().split("T")[0];

    const todayItem = tempSensor && tempSensor.value !== null
        ? {
            date: todayKey,
            value: tempSensor.value,
            isToday: true
        }
        : null;

    // === 2. Πάρε ΙΣΤΟΡΙΚΟ για τις προηγούμενες μέρες ===
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - 5); // ζητάμε παραπάνω για ασφάλεια

    const isoFrom = fromDate.toISOString().split("T")[0];
    const isoTo = todayKey;

    const tempDaily = await getHistoricalReadings(
        deviceId,
        SENSOR_MAPPING.TEMP_ID,
        isoFrom,
        isoTo,
        "1d"
    );

    // === 3. Καθάρισμα history (ΧΩΡΙΣ τη σημερινή) ===
    const historyItems = tempDaily
        .filter(p => p && p[0] && p[1] !== null)
        .map(p => ({
            date: p[0].split("T")[0],
            value: p[1],
            isToday: false
        }))
        .filter(p => p.date !== todayKey) // ⚠️ κόβουμε το today αν υπάρχει
        .sort((a, b) => b.date.localeCompare(a.date)) // DESC
        .slice(0, 4); // μόνο 4 μέρες

    // === 4. Συνδυασμός: Today + 4 προηγούμενες ===
    const finalList = todayItem
        ? [todayItem, ...historyItems]
        : historyItems.slice(0, 5);

    if (finalList.length === 0) {
        container.innerHTML = "<p style='opacity:.7;'>No temperature history found.</p>";
        return;
    }

    // === 5. Render ===
    finalList.forEach(item => {
        const d = new Date(item.date);

        const dayLabel = item.isToday
            ? "Today"
            : d.toLocaleDateString("en-US", { weekday: "short" });

        const dayNum = d.getDate();

        container.insertAdjacentHTML("beforeend", `
            <div class="today-history-item ${item.isToday ? "today" : ""}">
                <span class="day">${dayLabel} ${dayNum}</span>
                <span class="temp">${Math.round(item.value)}°C</span>
            </div>
        `);
    });
}



// ** 3. UPDATE HIGH / LOW WIDGET (Hero Section) **
async function updateHighLow(deviceId, referenceDateStr, liveTempValue) {
    const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
    const isToday = refDate.toDateString() === new Date().toDateString();

    const fromDate = new Date(refDate);
    fromDate.setUTCHours(0, 0, 0, 0);

    const toDate = new Date(refDate);
    toDate.setDate(toDate.getDate() + 1);

    const isoFrom = fromDate.toISOString().split('T')[0];
    const isoTo = toDate.toISOString().split('T')[0];

    const readings = await getHistoricalReadings(
        deviceId,
        SENSOR_MAPPING.TEMP_ID,
        isoFrom,
        isoTo,
        "4h"
    );

    const highEl = document.querySelector(".high-item .temp");
    const lowEl = document.querySelector(".low-item .temp");

    let values = readings
        .map(r => r[1])
        .filter(v => v !== null && v !== undefined);

    // ✅ ΣΗΜΑΝΤΙΚΟ: Αν είναι σήμερα, πρόσθεσε το live temp
    if (isToday && liveTempValue !== null && liveTempValue !== undefined) {
        values.push(liveTempValue);
    }

    if (values.length === 0) {
        if (highEl) highEl.innerHTML = "--";
        if (lowEl) lowEl.innerHTML = "--";
        return;
    }

    const maxTemp = Math.max(...values);
    const minTemp = Math.min(...values);

    if (highEl) highEl.innerHTML = `${Math.round(maxTemp)}<sup>°C</sup>`;
    if (lowEl) lowEl.innerHTML = `${Math.round(minTemp)}<sup>°C</sup>`;
}


// ** 4. UPDATE HISTORY LIST (THE DAY CARDS) - FIXED LAYOUT **
async function updateHistorySection(deviceId) {
    const historyContainer = document.querySelector(".history");
    if (!historyContainer) return;

    // A. Calculate dates: Today and 30 days ago
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - 30);

    const isoTo = toDate.toISOString().split('T')[0];
    const isoFrom = fromDate.toISOString().split('T')[0];

    // B. Fetch Data
    const [tempData, humData, pm25Data, noiseData] = await Promise.all([
        getHistoricalReadings(deviceId, SENSOR_MAPPING.TEMP_ID, isoFrom, isoTo, "1d"),
        getHistoricalReadings(deviceId, SENSOR_MAPPING.HUMIDITY_ID, isoFrom, isoTo, "1d"),
        getHistoricalReadings(deviceId, SENSOR_MAPPING.PM25_ID, isoFrom, isoTo, "1d"),
        getHistoricalReadings(deviceId, SENSOR_MAPPING.NOISE_ID, isoFrom, isoTo, "1d")
    ]);

    // C. Group Data
    const daysMap = {};
    const processData = (data, key) => {
        if (!data) return;
        data.forEach(point => {
            const dateKey = point[0].split('T')[0];
            if (!daysMap[dateKey]) daysMap[dateKey] = { date: dateKey };
            daysMap[dateKey][key] = point[1];
        });
    };

    processData(tempData, 'temp');
    processData(humData, 'hum');
    processData(pm25Data, 'pm25');
    processData(noiseData, 'noise');

    // D. Sort Newest First
    const sortedDays = Object.values(daysMap).sort((a, b) => b.date.localeCompare(a.date));

    // E. Generate HTML
    historyContainer.innerHTML = "";

    if (sortedDays.length === 0) {
        historyContainer.innerHTML = "<p style='text-align:center;'>No history data found.</p>";
        return;
    }

    const greekMonths = ["ΙΑΝΟΥΑΡΙΟΥ", "ΦΕΒΡΟΥΑΡΙΟΥ", "ΜΑΡΤΙΟΥ", "ΑΠΡΙΛΙΟΥ", "ΜΑΙΟΥ", "ΙΟΥΝΙΟΥ", "ΙΟΥΛΙΟΥ", "ΑΥΓΟΥΣΤΟΥ", "ΣΕΠΤΕΜΒΡΙΟΥ", "ΟΚΤΩΒΡΙΟΥ", "ΝΟΕΜΒΡΙΟΥ", "ΔΕΚΕΜΒΡΙΟΥ"];
    const greekDays = ["ΚΥΡΙΑΚΗ", "ΔΕΥΤΕΡΑ", "ΤΡΙΤΗ", "ΤΕΤΑΡΤΗ", "ΠΕΜΠΤΗ", "ΠΑΡΑΣΚΕΥΗ", "ΣΑΒΒΑΤΟ"];

    sortedDays.forEach(day => {
        if (day.temp === undefined || day.temp === null) return;

        const d = new Date(day.date);
        const dayNum = d.getDate();
        const monthName = greekMonths[d.getMonth()];
        const dayName = greekDays[d.getDay()];

        const avgTemp = Math.round(day.temp);
        const highTemp = avgTemp + 3;
        const lowTemp = avgTemp - 2;
        const hum = day.hum ? Math.round(day.hum) : "-";
        const pm25 = day.pm25 ? Math.round(day.pm25) : "-";
        const noise = day.noise ? Math.round(day.noise) : "-";

        let icon = "weather images/sunny.png";
        if (day.hum > 75) icon = "weather images/rain_cloud.png";
        else if (day.hum > 50) icon = "weather images/cloud.png";

        let tagClass = "tag-green";
        let tagText = "ΚΑΝΟΝΙΚΕΣ ΘΕΡΜΟΚΡΑΣΙΕΣ";

        if (avgTemp > 25) {
            tagClass = "tag-orange";
            tagText = "ΥΨΗΛΕΣ ΘΕΡΜΟΚΡΑΣΙΕΣ";
        } else if (avgTemp < 10) {
            tagClass = "tag-blue";
            tagText = "ΧΑΜΗΛΕΣ ΘΕΡΜΟΚΡΑΣΙΕΣ";
        }

        const html = `
        <div class="day-card">
            <span class="day-number">${dayNum}</span>

            <div class="day-info">
                <span class="month">${monthName}</span>
                <span class="weekday">${dayName}</span>
            </div>

            <p class="sun-times">Ανατολή: 07:20 – Δύση: 17:03</p>

            <div class="day-body">
                <div class="icon-temp"><img src="${icon}" style="width:40px;"></div>
                <div class="temp-box">
                    <span class="temp-high">${highTemp}°C</span>
                    <span class="temp-low">${lowTemp}°C</span>
                </div>
            </div>

            <div class="metrics-row">
                <div class="metric"><span class="metric-label">PM2.5</span><span class="metric-value"> ${pm25} µg/m³</span></div>
                <div class="metric"><span class="metric-label">Humidity</span><span class="metric-value"> ${hum}%</span></div>
                <div class="metric"><span class="metric-label">Noise</span><span class="metric-value"> ${noise} dB</span></div>
            </div>

            <div class="tag ${tagClass}">${tagText}</div>
        </div>
        `;

        historyContainer.insertAdjacentHTML('beforeend', html);
    });
}

// ** 5. UPDATE TEMP BAR WIDGET **
function updateTempWidget(tempValue) {
    const widget = document.querySelector(".temp-bar-widget");
    if (!widget || tempValue === null || tempValue === undefined || isNaN(tempValue)) return;

    const valEl = widget.querySelector(".temp-bar-value");
    if (valEl) valEl.textContent = `${Math.round(tempValue)}°C`;

    const MIN_TEMP = -5;
    const MAX_TEMP = 45;
    let percentage = ((tempValue - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)) * 100;
    percentage = Math.max(0, Math.min(100, percentage));

    const knob = widget.querySelector(".temp-bar-knob");
    if (knob) {
        knob.style.left = `${percentage}%`;
    }
}

// ** 6. UPDATE CONDITION WIDGET **
function updateWeatherCondition(sensorData) {
    const conditionEl = document.querySelector(".condition");
    if (!conditionEl) return;

    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    const textEl = conditionEl.querySelector("p");
    if (textEl) textEl.textContent = `${dayName}, ${timeStr}`;

    const humSensor = sensorData.find(s => s.id === SENSOR_MAPPING.HUMIDITY_ID);
    const imgEl = conditionEl.querySelector("img");

    if (humSensor && imgEl && humSensor.value !== null && humSensor.value !== undefined) {
        const humidity = parseFloat(humSensor.value);
        let iconName = "clear";

        if (humidity >= 75) iconName = "rain";
        else if (humidity >= 50) iconName = "mist";
        else iconName = "clear";

        const weatherIcons = {
            rain: "weather images/rain_cloud.png",
            storm: "weather images/thunder_cloud_and_rain.png",
            mist: "weather images/cloud.png",
            clear: "weather images/sunny.png"
        };

        imgEl.src = weatherIcons[iconName] || "weather images/cloud.png";
    }
}

// ** 7. UPDATE HIGHLIGHT CARDS **
function updateHighlights(sensorData) {
    const cards = document.querySelectorAll(".highlights .card");

    cards.forEach(card => {
        const type = card.dataset.type;
        const valueElement = card.querySelector(".value");
        if (!type || !valueElement) return;

        let sensorId;
        switch (type) {
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
        const displayValue =
            (type === "pm25" || type === "noise-level")
                ? Math.round(value)
                : value.toFixed(1);

        valueElement.textContent = displayValue + (sensor.unit || "");

        // Remove ALL possible color classes first
        card.classList.remove(
            "card-cold", "card-cool", "card-comfortable", "card-warm", "card-hot",
            "card-green", "card-light-green", "card-yellow", "card-orange", "card-red"
        );

        // Apply correct color logic
        switch (type) {
            case "temp":
                if (value <= 10) card.classList.add("card-cold");
                else if (value <= 18) card.classList.add("card-cool");
                else if (value <= 26) card.classList.add("card-comfortable");
                else if (value <= 32) card.classList.add("card-warm");
                else card.classList.add("card-hot");
                break;

            case "humidity":
                if (value >= 40 && value <= 60) card.classList.add("card-green");
                else if ((value >= 30 && value < 40) || (value > 60 && value <= 70)) card.classList.add("card-light-green");
                else if ((value >= 20 && value < 30) || (value > 70 && value <= 80)) card.classList.add("card-yellow");
                else if ((value >= 10 && value < 20) || (value > 80 && value <= 90)) card.classList.add("card-orange");
                else card.classList.add("card-red");
                break;

            case "pm25":
                if (value <= 5) card.classList.add("card-green");
                else if (value <= 15) card.classList.add("card-light-green");
                else if (value <= 25) card.classList.add("card-yellow");
                else if (value <= 50) card.classList.add("card-orange");
                else card.classList.add("card-red");
                break;

            case "noise-level":
                if (value < 40) card.classList.add("card-green");
                else if (value <= 55) card.classList.add("card-light-green");
                else if (value <= 65) card.classList.add("card-yellow");
                else if (value <= 75) card.classList.add("card-orange");
                else card.classList.add("card-red");
                break;
        }
    });
}

// ** 8. UPDATE MAIN METRIC PANEL **
function applyMetric(metricKey, sensorData) {
    let selectedSensor;
    let qualityText = "N/A";
    let qualityClass = "moderate";

    switch (metricKey) {
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
        const status = document.getElementById("today-status-label");
        const num = document.getElementById("today-main-number");
        const unit = document.getElementById("today-main-unit");
        const qLabel = document.getElementById("today-quality-label");
        if (!status || !num || !unit || !qLabel) return;

        status.textContent = selectedSensor.name;
        const displayVal = (metricKey === 'pm25' || metricKey === 'noise-level')
            ? Math.round(selectedSensor.value)
            : parseFloat(selectedSensor.value).toFixed(1);
        num.textContent = displayVal;
        unit.textContent = selectedSensor.unit;

        qLabel.textContent = qualityText;
        qLabel.classList.remove("quality-good", "quality-moderate", "quality-bad", "quality-blue");
        if (qualityClass === 'blue') qLabel.classList.add("quality-good");
        else qLabel.classList.add("quality-" + qualityClass);
    }
}

// ** 9. UPDATE AUXILIARY DATA **
function applyRealtimeData(sensorData) {
    const temp = sensorData.find(s => s.id === SENSOR_MAPPING.TEMP_ID);
    const hum = sensorData.find(s => s.id === SENSOR_MAPPING.HUMIDITY_ID);
    const pm25 = sensorData.find(s => s.id === SENSOR_MAPPING.PM25_ID);
    const noise = sensorData.find(s => s.id === SENSOR_MAPPING.NOISE_ID);

    if (temp && temp.value !== null) {
        const el = document.getElementById("today-temp");
        if (el) el.textContent = Math.round(temp.value) + "°C";
        updateTempWidget(parseFloat(temp.value));
    }
    if (hum && hum.value !== null) {
        const el = document.getElementById("today-humidity");
        if (el) el.textContent = Math.round(hum.value) + "%";
    }
    if (pm25 && pm25.value !== null) {
        const pmEl = document.getElementById("today-pm25");
        if (pmEl) pmEl.textContent = Math.round(pm25.value) + " µg/m³";
    }
    if (noise && noise.value !== null) {
        const uvEl = document.getElementById("today-uv");
        if (uvEl) uvEl.textContent = Math.round(noise.value) + " dB";
    }
}

// ** MAIN RUNNER **
async function updateDashboard() {
    const params = new URLSearchParams(window.location.search);
    const deviceId = params.get("id") || "19225";

    // --- Fetch Live Data ---
    const result = await getSensorData(deviceId);

    const labelEl = document.getElementById("sensorLabel");
    if (labelEl) {
        if (result.info && result.info.name) {
            labelEl.textContent = `${result.info.city} - ${result.info.name} - ${result.info.latitude} - ${result.info.longitude}`;
        } else {
            labelEl.textContent = "Loading...";
        }
    }

    const sensorData = result.sensors;

    if (sensorData.length > 0) {
        updateHighlights(sensorData);
        applyRealtimeData(sensorData);
        updateWeatherCondition(sensorData);

        const tempSensor = sensorData.find(s => s.id === SENSOR_MAPPING.TEMP_ID);
        const lastReading = tempSensor ? tempSensor.timestamp : null;
        const liveTempValue = tempSensor ? parseFloat(tempSensor.value) : null;


        // ✅ SAFE GUARD: today-panel might not exist on some pages
        const todayBox = document.querySelector(".today-panel");
        if (todayBox) {
            const titleToggles = todayBox.querySelectorAll(".title-toggle");
            titleToggles.forEach(toggle => {
                toggle.addEventListener("click", () => {
                    titleToggles.forEach(t => t.classList.remove("title-toggle-active"));
                    toggle.classList.add("title-toggle-active");

                    const view = toggle.dataset.view;
                    if (view === "history") todayBox.classList.add("show-history");
                    else todayBox.classList.remove("show-history");
                });
            });
        }

        const historyBtn = document.getElementById("historyToggleBtn");
        const historyEl = document.querySelector(".history");

        if (historyBtn && historyEl) {
            const newHistoryBtn = historyBtn.cloneNode(true);
            historyBtn.parentNode.replaceChild(newHistoryBtn, historyBtn);

            newHistoryBtn.addEventListener("click", () => {
                const isExpanded = historyEl.classList.toggle("expanded");
                newHistoryBtn.textContent = isExpanded ? "Show fewer days" : "Show full month";
            });
        }

        await updateHighLow(deviceId, lastReading, liveTempValue);
        await updateHistorySection(deviceId);

        // ✅ NEW: Update today-card with last 5 days temperature
        await updateTodayCardLastFiveDays(deviceId);

    } else {
        console.warn("No live sensor data found.");
        if (labelEl) labelEl.textContent = "Sensor Offline or No Data";
    }
}

// ** START **
document.addEventListener("DOMContentLoaded", () => {
    updateDashboard();
});
