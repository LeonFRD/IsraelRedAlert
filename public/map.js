import { createSimulationBox, selectedCities, updateButtonStyles } from './simulationBox.js';

let map;
let citiesData;
let polygonsData;
let currentPolygons = [];

async function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 31.0461, lng: 34.8516 }, // Center of Israel
        zoom: 8
    });

    await loadJSONData();
    createSimulationBox(citiesData, simulateSelectedCities, clearMap);
}

async function loadJSONData() {
    try {
        const [citiesResponse, polygonsResponse] = await Promise.all([
            fetch('data/cities.json'),
            fetch('data/polygons.json')
        ]);
        citiesData = await citiesResponse.json();
        polygonsData = await polygonsResponse.json();
        console.log('Data loaded successfully');
    } catch (error) {
        console.error('Error loading JSON data:', error);
    }
}

function simulateSelectedCities() {
    clearMap();
    selectedCities.forEach(cityName => {
        displayPolygonForCity(cityName);
    });
    adjustMapView();
}

function displayPolygonForCity(cityName) {
    const city = citiesData.find(city => city.name === cityName);
    if (!city) {
        console.log(`City not found: ${cityName}`);
        return;
    }

    const polygonCoords = polygonsData[city.id];
    if (!polygonCoords) {
        console.log(`Polygon not found for city: ${cityName}`);
        return;
    }

    const newPolygon = new google.maps.Polygon({
        paths: polygonCoords.map(coord => ({ lat: coord[0], lng: coord[1] })),
        strokeColor: "#FF0000",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#FF0000",
        fillOpacity: 0.35
    });

    newPolygon.setMap(map);
    currentPolygons.push({ cityId: city.id, polygon: newPolygon });

    // Adjust map view after adding the polygon
    adjustMapView();
}

function adjustMapView() {
    if (currentPolygons.length === 0) {
        map.setCenter({ lat: 31.0461, lng: 34.8516 });
        map.setZoom(8);
    } else {
        const bounds = new google.maps.LatLngBounds();
        currentPolygons.forEach(polygonObj => {
            polygonObj.polygon.getPath().forEach(latLng => bounds.extend(latLng));
        });
        map.fitBounds(bounds);

        // Add some padding to the bounds
        const padding = { top: 50, right: 50, bottom: 50, left: 50 };
        const newBounds = map.getBounds();
        const ne = newBounds.getNorthEast();
        const sw = newBounds.getSouthWest();
        const topRightLat = ne.lat() + (ne.lat() - sw.lat()) * padding.top / 100;
        const topRightLng = ne.lng() + (ne.lng() - sw.lng()) * padding.right / 100;
        const bottomLeftLat = sw.lat() - (ne.lat() - sw.lat()) * padding.bottom / 100;
        const bottomLeftLng = sw.lng() - (ne.lng() - sw.lng()) * padding.left / 100;
        const paddedBounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(bottomLeftLat, bottomLeftLng),
            new google.maps.LatLng(topRightLat, topRightLng)
        );
        map.fitBounds(paddedBounds);
    }
}

function clearMap() {
    currentPolygons.forEach(polygonObj => {
        polygonObj.polygon.setMap(null);
    });
    currentPolygons = [];

    // Update button styles
    updateButtonStyles();

    // Reset map view
    map.setCenter({ lat: 31.0461, lng: 34.8516 });
    map.setZoom(8);
}

window.initMap = initMap;
window.clearMap = clearMap;
window.displayPolygonForCity = displayPolygonForCity;