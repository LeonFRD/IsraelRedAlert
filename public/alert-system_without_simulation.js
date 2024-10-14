const interval = 5000;

window.polygonsDisplayed = false;
let pollTimeoutId = null;

let pollCount = 0;

// Add a Set to keep track of currently displayed cities
let currentDisplayedCities = new Set();

const poll = function () {
    pollCount++;
    console.log(`\n--- Polling iteration ${pollCount} ---`);
    console.log(`Time: ${new Date().toLocaleTimeString()}`);

    console.log('Fetching active alert...');

    fetch('/api/alert')
        .then(response => response.json())
        .then(handleAlert)
        .catch(error => {
            console.error('Error retrieving active alert:', error);
        })
        .finally(schedulePoll);
}

function handleAlert(alert) {
    console.log('Alert data received:');
    console.log(JSON.stringify(alert, null, 2));

    if (alert.type !== 'none') {
        console.log('Active alert detected!');
        console.log('Affected cities:');
        alert.cities.forEach(city => {
            console.log(`- ${city}`);
            if (typeof window.displayPolygonForCity === 'function' && !currentDisplayedCities.has(city)) {
                window.displayPolygonForCity(city);
                currentDisplayedCities.add(city);
            } else if (currentDisplayedCities.has(city)) {
                console.log(`Polygon for ${city} is already displayed`);
            } else {
                console.log('displayPolygonForCity function not available');
            }
        });
        window.polygonsDisplayed = true;
    } else {
        console.log('No active alerts at this time.');
        if (typeof window.clearMap === 'function') {
            window.clearMap();
            currentDisplayedCities.clear(); // Clear the set when clearing the map
        } else {
            console.log('clearMap function not available');
        }
        window.polygonsDisplayed = false;
    }
}

function schedulePoll() {
    console.log(`Next poll in ${interval / 1000} seconds...`);
    if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
    }
    pollTimeoutId = setTimeout(poll, interval);
}

console.log('Starting alert polling system...');
poll();
