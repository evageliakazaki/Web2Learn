document.addEventListener("DOMContentLoaded", () => {

    /* -------------------- HIGHLIGHTS COLORS -------------------- */
    const cards = document.querySelectorAll(".highlights .card");

    cards.forEach(card => {
        const type = card.dataset.type;
        const valueElement = card.querySelector(".value");
        if (!type || !valueElement) return;

        const rawValue = valueElement.dataset.value;
        if (!rawValue) return;

        const value = parseFloat(rawValue);
        if (isNaN(value)) return;

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

            case "pressure":
                if (value < 1000) card.classList.add("card-blue");
                else if (value <= 1020) card.classList.add("card-orange");
                else card.classList.add("card-red");
                break;

            case "uv":
                if (value < 3) card.classList.add("card-blue");
                else if (value <= 6) card.classList.add("card-orange");
                else card.classList.add("card-red");
                break;
        }
    });


    /* -------------------- WEATHER ICON SWITCH -------------------- */
    const condition = document.querySelector(".condition");

    if (condition){
        const weather = condition.dataset.weather;
        const imgEl = condition.querySelector("img");

        if (weather && imgEl){
            const weatherIcons = {
                rain: "weather images/rain_cloud.png",
                storm:"weather images/thunder_cloud_and_rain.png",
                snow: "weather images/snowflake.png",
                mist: "weather images/fog.png",
                clear:"weather images/sunny.png"
            };

            imgEl.src = weatherIcons[weather] || imgEl.src;
        }
    }


    /* -------------------- TODAY / HISTORY SWITCH -------------------- */
    const todayBox = document.querySelector(".today-panel");
    const titleToggles = todayBox.querySelectorAll(".title-toggle");

    titleToggles.forEach(toggle => {
        toggle.addEventListener("click", () => {

            // ενεργό styling
            titleToggles.forEach(t => t.classList.remove("title-toggle-active"));
            toggle.classList.add("title-toggle-active");

            const view = toggle.dataset.view;
            if (view === "history") {
                todayBox.classList.add("show-history");
            } else {
                todayBox.classList.remove("show-history");
            }
        });
    });


    /* -------------------- SENSOR LABEL -------------------- */
    const params = new URLSearchParams(window.location.search);

    const id = params.get("id");
    const name = params.get("name");
    const city = params.get("city");
    const country = params.get("country");
    const lat = params.get("lat");
    const lon = params.get("lon");

    const labelEl = document.getElementById("sensorLabel");

    if (labelEl) {
        const parts = [];

        if (city) parts.push(city);
        if (country) parts.push(country);
        if (name) parts.push(name);
        if (id) parts.push(`ID ${id}`);
        
        // Αν θέλεις να φαίνεται και η τοποθεσία:
        if (lat && lon) parts.push(`(${lat}, ${lon})`);

        labelEl.textContent = parts.length
            ? parts.join(" - ")
            : "No sensor selected";
    }



    /* ---------------------------------------------------------
       TODAY METRICS: ΚΟΥΜΠΙΑ → Temperature, Humidity, PM2.5, Noise
    --------------------------------------------------------- */

    const metricsData = {
        temperature: {
            statusLabel: "Temperature",
            mainNumber: 22,
            mainUnit: "°C",
            qualityText: "Normal",
            quality: "moderate",
            pm25: "-",
            temp: "22°C",
            condition: "Clear",
            humidity: "25%",
            wind: "5 km/h",
            uv: "1"
        },

        aqi: {
            statusLabel: "Humidity",
            mainNumber: 100,
            mainUnit: "%",
            qualityText: "Very Humid",
            quality: "bad",
            pm25: "8 µg/m³",
            temp: "10°C",
            condition: "Light rain",
            humidity: "100%",
            wind: "6 km/h",
            uv: "0"
        },

        pm25: {
            statusLabel: "PM2.5",
            mainNumber: 8,
            mainUnit: "µg/m³",
            qualityText: "Low",
            quality: "good",
            pm25: "8 µg/m³",
            temp: "10°C",
            condition: "Cloudy",
            humidity: "90%",
            wind: "4 km/h",
            uv: "0"
        },

        "noise-level": {
            statusLabel: "Noise Level",
            mainNumber: 6,
            mainUnit: "dB",
            qualityText: "Normal",
            quality: "moderate",
            pm25: "-",
            temp: "10°C",
            condition: "Cloudy",
            humidity: "80%",
            wind: "5 km/h",
            uv: "0"
        }
    };


    /* -------------------- APPLY METRIC -------------------- */
    function applyMetric(metricKey){
        const data = metricsData[metricKey];
        if (!data) return;

        document.getElementById("today-status-label").textContent = data.statusLabel;
        document.getElementById("today-main-number").textContent  = data.mainNumber;
        document.getElementById("today-main-unit").textContent    = data.mainUnit;

        const qLabel = document.getElementById("today-quality-label");
        qLabel.textContent = data.qualityText;
        qLabel.classList.remove("quality-good","quality-moderate","quality-bad");
        qLabel.classList.add("quality-" + data.quality);

        document.getElementById("today-pm25").textContent = data.pm25;

        document.getElementById("today-temp").textContent      = data.temp;
        document.getElementById("today-condition").textContent = data.condition;
        document.getElementById("today-humidity").textContent  = data.humidity;
        document.getElementById("today-wind").textContent      = data.wind;
        document.getElementById("today-uv").textContent        = data.uv;
    }


    /* -------------------- TAB CLICK HANDLER -------------------- */
    const tabs = document.querySelectorAll(".today-tab");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {

            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const metric = tab.dataset.metric;
            applyMetric(metric);
        });
    });

        // ------------- Expand / Collapse ιστορικού -------------
    const historyEl = document.querySelector(".history");
    const historyBtn = document.getElementById("historyToggleBtn");

    if (historyEl && historyBtn){
        historyBtn.addEventListener("click", () => {
            const expanded = historyEl.classList.toggle("expanded");
            historyBtn.textContent = expanded
                ? "Show fewer days"
                : "Show full month";
        });
    }



    /* -------------------- DEFAULT LOAD -------------------- */
    applyMetric("aqi"); // default Humidity
});
