const map = L.map('map').setView([45.0, -123.0], 13); // Adjust center coords

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

// Load your GeoJSON trail network
fetch('map.geojson')
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, { style: { color: '#444' } }).addTo(map);
  });

map.locate({ setView: true, maxZoom: 16 });

function onLocationFound(e) {
  const radius = e.accuracy;
  L.marker(e.latlng).addTo(map)
    .bindPopup("You are here").openPopup();
  L.circle(e.latlng, radius).addTo(map);
}

map.on('locationfound', onLocationFound);

let startMarker = null, endMarker = null;

map.on('click', function(e) {
  if (!startMarker) {
    startMarker = L.marker(e.latlng, { title: "Start", icon: L.icon({ iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png' }) }).addTo(map);
  } else if (!endMarker) {
    endMarker = L.marker(e.latlng, { title: "End", icon: L.icon({ iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png' }) }).addTo(map);
    generateRoutes(startMarker.getLatLng(), endMarker.getLatLng());
  }
});
