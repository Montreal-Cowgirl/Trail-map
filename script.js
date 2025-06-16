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
let trailData;
let trailGraph = {};

fetch('map.geojson')
  .then(res => res.json())
  .then(data => {
    trailData = data;
    L.geoJSON(data, { style: { color: '#444' } }).addTo(map);
    buildGraph(data);
  });

function buildGraph(geojson) {
  geojson.features.forEach(feature => {
    const coords = feature.geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i];
      const b = coords[i + 1];
      const keyA = a.join(',');
      const keyB = b.join(',');

      if (!trailGraph[keyA]) trailGraph[keyA] = [];
      if (!trailGraph[keyB]) trailGraph[keyB] = [];

      const dist = turf.distance(turf.point(a), turf.point(b));
      trailGraph[keyA].push({ node: keyB, weight: dist });
      trailGraph[keyB].push({ node: keyA, weight: dist });
    }
  });
}

function findShortestPath(start, end) {
  const startKey = snapToGraph(start);
  const endKey = snapToGraph(end);
  if (!startKey || !endKey) return [];

  const openSet = new Set([startKey]);
  const cameFrom = {};
  const gScore = { [startKey]: 0 };
  const fScore = { [startKey]: turf.distance(turf.point(start), turf.point(end)) };

  while (openSet.size > 0) {
    let current = [...openSet].reduce((a, b) =>
      (fScore[a] || Infinity) < (fScore[b] || Infinity) ? a : b
    );

    if (current === endKey) return reconstructPath(cameFrom, current);

    openSet.delete(current);
    for (let neighbor of trailGraph[current]) {
      const tentativeG = gScore[current] + neighbor.weight;
      if (tentativeG < (gScore[neighbor.node] || Infinity)) {
        cameFrom[neighbor.node] = current;
        gScore[neighbor.node] = tentativeG;
        fScore[neighbor.node] = tentativeG + turf.distance(turf.point(parseCoord(neighbor.node)), turf.point(parseCoord(endKey)));
        openSet.add(neighbor.node);
      }
    }
  }

  return [];
}

function reconstructPath(cameFrom, current) {
  const totalPath = [current];
  while (cameFrom[current]) {
    current = cameFrom[current];
    totalPath.unshift(current);
  }
  return totalPath.map(parseCoord);
}

function snapToGraph(latlng) {
  let closest = null;
  let minDist = Infinity;
  const pt = [latlng.lng, latlng.lat];

  for (let key in trailGraph) {
    const d = turf.distance(turf.point(pt), turf.point(parseCoord(key)));
    if (d < minDist) {
      minDist = d;
      closest = key;
    }
  }
  return closest;
}

function parseCoord(str) {
  const [x, y] = str.split(',').map(Number);
  return [y, x];
}

let activeRoute = null;

function selectRoute(latlngs, color) {
  if (activeRoute) map.removeLayer(activeRoute);

  activeRoute = L.polyline(latlngs, { color: color, weight: 6, dashArray: '10,5' }).addTo(map);

  document.getElementById('directions').innerHTML = `
    <strong>Route selected</strong><br>
    <button onclick="generateDirections(${JSON.stringify(latlngs)})">Show Directions</button>
  `;
}

let routeLayers = [];

function generateRoutes(startLatLng, endLatLng) {
  // Clear old routes
  routeLayers.forEach(r => map.removeLayer(r));
  routeLayers = [];

  const baseRoute = findShortestPath(startLatLng, endLatLng);
  if (baseRoute.length === 0) return;

  const colors = ['blue', 'orange', 'purple'];
  const routes = [baseRoute];

  for (let attempt = 0; routes.length < 3 && attempt < 10; attempt++) {
    const altRoute = findShortestPath(startLatLng, endLatLng);

    if (
      altRoute.length > 0 &&
      !routes.some(r => areRoutesTooSimilar(r, altRoute))
    ) {
      routes.push(altRoute);
    }
  }

  routes.forEach((route, i) => {
    const latlngs = route.map(([lat, lng]) => [lat, lng]);
    const layer = L.polyline(latlngs, { color: colors[i], weight: 5 }).addTo(map);
    layer.on('click', () => selectRoute(latlngs, colors[i]));
    routeLayers.push(layer);
  });
}

function areRoutesTooSimilar(r1, r2) {
  const shared = r1.filter(pt1 =>
    r2.some(pt2 => turf.distance(turf.point([pt1[1], pt1[0]]), turf.point([pt2[1], pt2[0]])) < 0.01)
  );
  return shared.length / Math.min(r1.length, r2.length) > 0.7;
}
