// simulationBox.js
let selectedCities = new Set();
let cityButtons = {};
let zoneTitles = {};
let groupedCities = {};

function createSimulationBox(citiesData, simulateCallback, clearSimulationsCallback) {
    console.debug('Creating simulation box...');
    // Reset global variables
    cityButtons = {};
    zoneTitles = {};
    groupedCities = groupCitiesByZone(citiesData);

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
    simulationBox.style.minWidth = '250px';

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
    const simulateButton = createActionButton('Simulate', '#4CAF50', simulateSelectedCities);
    content.appendChild(simulateButton);

    // Add Clear Simulations button
    const clearButton = createActionButton('Clear Simulations', '#f44336', clearSimulations);
    content.appendChild(clearButton);

    // Add Select All button
    const selectAllButton = createActionButton('Select All', '#2196F3', () => selectAllCities(citiesData));
    content.appendChild(selectAllButton);

    // Add Clear Selections button
    const clearSelectionsButton = createActionButton('Clear Selections', '#FF9800', clearAllSelections);
    content.appendChild(clearSelectionsButton);

    for (const [zone, cities] of Object.entries(groupedCities)) {
        const zoneTitleContainer = document.createElement('div');
        zoneTitleContainer.style.display = 'flex';
        zoneTitleContainer.style.alignItems = 'center';
        zoneTitleContainer.style.marginTop = '10px';
        zoneTitleContainer.style.marginBottom = '5px';
        zoneTitleContainer.style.cursor = 'pointer';

        const zoneCheckbox = document.createElement('input');
        zoneCheckbox.type = 'checkbox';
        zoneCheckbox.style.marginRight = '10px';

        const zoneLabel = document.createElement('h4');
        zoneLabel.textContent = zone;
        zoneLabel.style.margin = '0';

        const collapseButton = document.createElement('button');
        collapseButton.textContent = '▼';
        collapseButton.style.marginLeft = 'auto';
        collapseButton.style.background = 'none';
        collapseButton.style.border = 'none';
        collapseButton.style.fontSize = '16px';
        collapseButton.style.cursor = 'pointer';

        zoneTitleContainer.appendChild(zoneCheckbox);
        zoneTitleContainer.appendChild(zoneLabel);
        zoneTitleContainer.appendChild(collapseButton);

        zoneTitleContainer.addEventListener('click', (e) => {
            if (e.target !== collapseButton) {
                toggleZoneSelection(zone, cities, zoneCheckbox);
            }
        });

        content.appendChild(zoneTitleContainer);

        zoneTitles[zone] = { container: zoneTitleContainer, checkbox: zoneCheckbox, collapseButton };

        const cityContainer = document.createElement('div');
        cityContainer.style.paddingLeft = '20px';

        cities.forEach(city => {
            const container = createCityButton(city.name);
            cityContainer.appendChild(container);
            cityButtons[city.name] = container;
        });

        content.appendChild(cityContainer);

        collapseButton.addEventListener('click', () => toggleZoneCollapse(zone, cityContainer, collapseButton));
    }

    simulationBox.appendChild(content);

    document.body.appendChild(simulationBox);
    console.debug('Simulation box created and appended to the body');
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

function createActionButton(text, backgroundColor, clickHandler) {
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
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.marginBottom = '5px';
    container.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.style.marginRight = '10px';
    checkbox.checked = selectedCities.has(cityName);

    const label = document.createElement('label');
    label.textContent = cityName;
    label.style.flexGrow = '1';

    container.appendChild(checkbox);
    container.appendChild(label);

    container.addEventListener('click', () => toggleCitySelection(cityName, checkbox));

    return container;
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

function toggleCitySelection(cityName, checkbox) {
    if (selectedCities.has(cityName)) {
        selectedCities.delete(cityName);
    } else {
        selectedCities.add(cityName);
    }
    checkbox.checked = selectedCities.has(cityName);
    updateButtonStyles();
}

function toggleZoneSelection(zoneName, cities, zoneCheckbox) {
    const allSelected = cities.every(city => selectedCities.has(city.name));
    if (allSelected) {
        // Deselect all cities in the zone
        cities.forEach(city => selectedCities.delete(city.name));
    } else {
        // Select all cities in the zone
        cities.forEach(city => selectedCities.add(city.name));
    }
    zoneCheckbox.checked = !allSelected;
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
    // Update city button styles
    Object.keys(cityButtons).forEach(cityName => {
        const container = cityButtons[cityName];
        const checkbox = container.querySelector('input[type="checkbox"]');
        checkbox.checked = selectedCities.has(cityName);
    });

    // Update zone title styles
    Object.keys(zoneTitles).forEach(zoneName => {
        const { container, checkbox } = zoneTitles[zoneName];
        const citiesInZone = groupedCities[zoneName];
        const allSelected = citiesInZone.every(city => selectedCities.has(city.name));
        const someSelected = citiesInZone.some(city => selectedCities.has(city.name));

        checkbox.checked = allSelected;

        if (allSelected) {
            container.style.backgroundColor = '#e0e0e0';
        } else if (someSelected) {
            container.style.backgroundColor = '#f0f0f0';
        } else {
            container.style.backgroundColor = '';
        }
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

function toggleZoneCollapse(zoneName, cityContainer, collapseButton) {
    if (cityContainer.style.display === 'none') {
        cityContainer.style.display = 'block';
        collapseButton.textContent = '▼';
    } else {
        cityContainer.style.display = 'none';
        collapseButton.textContent = '▶';
    }
}

export { createSimulationBox, selectedCities, updateButtonStyles, toggleSimulationBox, toggleZoneCollapse };
