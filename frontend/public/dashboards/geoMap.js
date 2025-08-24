import L from 'leaflet';

export function initMap(elementId, coords) {
  const map = L.map(elementId).setView([coords.lat, coords.long], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  L.marker([coords.lat, coords.long]).addTo(map);
  return map;
}

export function addGeofence(map, center, radiusKm) {
  return L.circle([center.lat, center.long], { radius: radiusKm * 1000 }).addTo(map);
}
