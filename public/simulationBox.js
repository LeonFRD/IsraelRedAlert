let selectedCities = new Set();

function createSimulationBox(citiesData, simulateCallback, clearSimulationsCallback) {
    const simulationBox = document.createElement('div');
    simulationBox.id = 'simulation-box';
    simulationBox.style.position = 'absolute';
    simulationBox.style.top = '10px';
    simulationBox.style.left = '10px';
    simulationBox.style.backgroundColor = 'white';
    simulationBox.style.padding = '10px';
    simulationBox.style.borderRadius = '5px';
    simulationBox.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    simulationBox.style.maxHeight = '80vh';
    simulationBox.style.overflowY = 'auto';
    simulationBox.style.minWidth = '200px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '10px';

    const title = document.createElement('h3');
    title.textContent = 'Simulation Mode';
    title.style.margin = '0';
    header.appendChild(title);

    const toggleButton = document.createElement('button');
    toggleButton.textContent = '▲';
    toggleButton.style.background = 'none';
    toggleButton.style.border = 'none';
    toggleButton.style.fontSize = '16px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.addEventListener('click', () => toggleSimulationBox(simulationBox, toggleButton));
    header.appendChild(toggleButton);

    simulationBox.appendChild(header);

    const content = document.createElement('div');
    content.id = 'simulation-box-content';

    // Add Simulate button
    const simulateButton = createButton('Simulate', '#4CAF50', simulateSelectedCities);
    content.appendChild(simulateButton);

    // Add Clear Simulations button
    const clearButton = createButton('Clear Simulations', '#f44336', clearSimulations);
    content.appendChild(clearButton);

    // Add Select All button
    const selectAllButton = createButton('Select All', '#2196F3', () => selectAllCities(citiesData));
    content.appendChild(selectAllButton);

    // Add Clear Selections button
    const clearSelectionsButton = createButton('Clear Selections', '#FF9800', clearAllSelections);
    content.appendChild(clearSelectionsButton);

    const groupedCities = groupCitiesByZone(citiesData);

    for (const [zone, cities] of Object.entries(groupedCities)) {
        const zoneTitle = document.createElement('h4');
        zoneTitle.textContent = zone;
        zoneTitle.style.marginTop = '10px';
        zoneTitle.style.marginBottom = '5px';
        content.appendChild(zoneTitle);

        cities.forEach(city => {
            const button = createCityButton(city.name);
            content.appendChild(button);
        });
    }

    simulationBox.appendChild(content);

    document.body.appendChild(simulationBox);
}

function toggleSimulationBox(simulationBox, toggleButton) {
    const content = document.getElementById('simulation-box-content');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggleButton.textContent = '▲';
        simulationBox.style.height = 'auto';
    } else {
        content.style.display = 'none';
        toggleButton.textContent = '▼';
        simulationBox.style.height = 'auto';
    }
}

function createButton(text, backgroundColor, clickHandler) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.marginBottom = '10px';
    button.style.padding = '5px 10px';
    button.style.backgroundColor = backgroundColor;
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '3px';
    button.style.cursor = 'pointer';
    button.style.width = '100%';
    button.addEventListener('click', clickHandler);
    return button;
}

function createCityButton(cityName) {
    const button = document.createElement('button');
    button.textContent = cityName;
    button.style.display = 'block';
    button.style.marginBottom = '5px';
    button.style.width = '100%';
    button.style.textAlign = 'left';
    button.style.padding = '5px';
    button.style.backgroundColor = '#ffffff';
    button.style.border = '1px solid #ddd';
    button.style.borderRadius = '3px';
    button.style.cursor = 'pointer';
    button.addEventListener('click', () => toggleCitySelection(cityName, button));
    return button;
}

function groupCitiesByZone(cities) {
    return cities.reduce((acc, city) => {
        if (!acc[city.zone]) {
            acc[city.zone] = [];
        }
        acc[city.zone].push(city);
        return acc;
    }, {});
}

function toggleCitySelection(cityName, button) {
    if (selectedCities.has(cityName)) {
        selectedCities.delete(cityName);
    } else {
        selectedCities.add(cityName);
    }
    updateButtonStyles();
}

function selectAllCities(citiesData) {
    citiesData.forEach(city => {
        selectedCities.add(city.name);
    });
    updateButtonStyles();
}

function clearAllSelections() {
    selectedCities.clear();
    updateButtonStyles();
}

function updateButtonStyles() {
    const buttons = document.querySelectorAll('#simulation-box button:not(:first-child):not(:nth-child(2)):not(:nth-child(3)):not(:nth-child(4))');
    buttons.forEach(button => {
        button.style.backgroundColor = selectedCities.has(button.textContent) ? '#e0e0e0' : '#ffffff';
    });
}

function simulateSelectedCities() {
    const simulatedAlertData = {
        type: 'simulated',
        cities: Array.from(selectedCities)
    };
    fetch('/api/simulate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(simulatedAlertData),
    })
    .then(response => response.json())
    .then(data => console.log(data.message))
    .catch((error) => console.error('Error:', error));
}

function clearSimulations() {
    fetch('/api/stop-simulation', {
        method: 'POST',
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.message);
        if (typeof window.clearMap === 'function') {
            window.clearMap();
        }
    })
    .catch((error) => console.error('Error:', error));
}

export { createSimulationBox, selectedCities, updateButtonStyles, toggleSimulationBox };
