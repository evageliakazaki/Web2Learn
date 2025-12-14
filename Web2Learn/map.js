const sensors = [
    {
        id: 1,
        name: "Web2learn-gym- Moundros",
        city: "Λήμνος - Μούδρος",
        country: "Greece",
        lat: 39.76,
        lon: 25.28
    },
    {
        id: 2,
        name: "Web2learn-Lyk-Moundros",
        city: "Λήμνος - Μύρινα",
        country: "Greece",
        lat: 39.88,
        lon: 25.06
    },
    {
        id: 3,
        name: "Web2learn01",
        city: "Λήμνος - Πλατύ",
        country: "Greece",
        lat: 39.86,
        lon: 25.17
    }
];


document.addEventListener("DOMContentLoaded", () => {

    // Χάρτης → Ελλάδα (λίγο πιο ζουμ)
    const map = L.map('map').setView([39.0, 23.0], 7.4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    const markersById = {};

    // Δημιουργία markers
    sensors.forEach(sensor => {
        const marker = L.marker([sensor.lat, sensor.lon]).addTo(map);

        marker.bindPopup(`
            <b>${sensor.name}</b><br>
            ${sensor.city}<br><br>
            <button onclick="openDashboard(${sensor.id})">
                Weather Dashboard
            </button>
        `);

        markersById[sensor.id] = marker;
    });

    // ===== DROPDOWN =====
    const dropdown = document.getElementById("sensorSelect");

    // Γέμισμα dropdown
    sensors.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.name;
        dropdown.appendChild(opt);
    });

    // Όταν επιλεγεί sensor
    dropdown.addEventListener("change", () => {
        const id = Number(dropdown.value);
        if (!id) return;

        const sensor = sensors.find(s => s.id === id);
        const marker = markersById[id];

        // Zoom στο σημείο του sensor
        map.setView([sensor.lat, sensor.lon], 12);

        // Άνοιγμα popup
        marker.openPopup();
    });
});

function openDashboard(id) {
    const sensor = sensors.find(s => s.id === id);
    if (!sensor) return;

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

