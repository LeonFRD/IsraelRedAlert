let map;
let citiesData;
let polygonsData;
let currentPolygons = [];
let currentMarkers = [];

async function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 31.0461, lng: 34.8516 }, // Center of Israel
        zoom: 8
    });

    await loadJSONData();
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

    // Add a marker for the city
    const marker = new google.maps.Marker({
        position: { lat: city.lat, lng: city.lng },
        map: map,
        title: city.name
    });
    currentMarkers.push(marker);

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

        // Fit the map to the bounds
        map.fitBounds(bounds);

        // Calculate the area of the bounds
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const boundsArea = (ne.lat() - sw.lat()) * (ne.lng() - sw.lng());

        // Adjust zoom based on the area
        const currentZoom = map.getZoom();
        let zoomAdjustment = 0;

        if (boundsArea > 100) {
            zoomAdjustment = -100; // Zoom out for very large areas
        } else if (boundsArea < 0.01) {
            zoomAdjustment = -2; // Zoom in for very small areas
        }

        // Apply the zoom adjustment
        map.setZoom(currentZoom + zoomAdjustment);
    }
}

function clearMap() {
    currentPolygons.forEach(polygonObj => {
        polygonObj.polygon.setMap(null);
    });
    currentPolygons = [];

    // Clear markers
    currentMarkers.forEach(marker => {
        marker.setMap(null);
    });
    currentMarkers = [];

    map.setCenter({ lat: 31.0461, lng: 34.8516 });
    map.setZoom(8);
}

window.initMap = initMap;
window.clearMap = clearMap;
window.displayPolygonForCity = displayPolygonForCity;
