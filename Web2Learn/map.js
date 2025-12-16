// ** CONFIGURATION: Hardcoded Locations with REAL IDs **
// This ensures markers appear instantly without API errors.
const sensors = [
    {
        id: 19225, // REAL ID
        name: "Web2Learn-gym-Moudros",
        city: "Moudros",
        country: "Greece",
        lat: 39.87703, // Coordinates from your JSON
        lon: 25.27187
    },
    {
        id: 19226, // REAL ID
        name: "Web2Learn-Lyk-Myrina",
        city: "Myrina",
        country: "Greece",
        lat: 39.874, // Approximate coords for Myrina (based on your old code)
        lon: 25.062
    }
];

document.addEventListener("DOMContentLoaded", () => {

    // 1. Initialize Map
    const map = L.map('map').setView([39.0, 23.0], 7.4); // Center on Lemnos

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    const markersById = {};
    const dropdown = document.getElementById("sensorSelect");

    // 2. Create Markers & Dropdown Options
    sensors.forEach(sensor => {
        // A. Add Marker to Map
        const marker = L.marker([sensor.lat, sensor.lon]).addTo(map);

        marker.bindPopup(`
            <b>${sensor.name}</b><br>
            ${sensor.city}<br><br>
            <button onclick="openDashboard(${sensor.id})">
                Weather Dashboard
            </button>
        `);

        markersById[sensor.id] = marker;

        // B. Add Option to Dropdown
        if (dropdown) {
            const opt = document.createElement("option");
            opt.value = sensor.id;
            opt.textContent = sensor.name;
            dropdown.appendChild(opt);
        }
    });

    // 3. Dropdown Selection Logic
    if (dropdown) {
        dropdown.addEventListener("change", () => {
            const id = Number(dropdown.value);
            if (!id) return;

            const sensor = sensors.find(s => s.id === id);
            const marker = markersById[id];

            if (sensor && marker) {
                // Zoom to the sensor
                map.setView([sensor.lat, sensor.lon], 12);
                // Open the popup
                marker.openPopup();
            }
        });
    }
});

// ** Dashboard Redirect Function **
function openDashboard(id) {
    const sensor = sensors.find(s => s.id === id);
    if (!sensor) return;

    // This sends the REAL ID (e.g., 19225) to the next page
    const url =
        `Web2Learn.html` +
        `?id=${sensor.id}` +
        `&name=${encodeURIComponent(sensor.name)}` +
        `&city=${encodeURIComponent(sensor.city)}` +
        `&country=${encodeURIComponent(sensor.country || "Greece")}` +
        `&lat=${sensor.lat}` +
        `&lon=${sensor.lon}`;

    window.location.href = url;
}