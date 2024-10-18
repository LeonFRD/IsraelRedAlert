// screenshot.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
// If using Node.js version < 18, uncomment the next line:
// const fetch = require('node-fetch');

// Add this helper function at the top of your file, outside of any other function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false }); // Make the browser visible
    const page = await browser.newPage();

    // Set viewport size
    await page.setViewport({ width: 800, height: 800 });

    console.log('Navigating to page...');
    // Navigate to the page
    try {
        await page.goto('http://localhost:3000/index_without_simulation.html', { waitUntil: 'networkidle0', timeout: 60000 });
        console.log('Page loaded successfully.');
    } catch (error) {
        console.error('Error loading page:', error);
        await browser.close();
        return;
    }

    console.log('Page content loaded');

    // Function to fetch alert data from API
    async function fetchAlertData() {
        try {
            const response = await fetch('http://localhost:3000/api/alert');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching alert data:', error);
            return null;
        }
    }

    // Function to check for active alert and take screenshot
    async function checkForAlert() {
        try {
            // Fetch alert data directly in Node.js
            const alertData = await fetchAlertData();
            console.log('Alert data:', alertData);

            if (alertData && alertData.type !== 'none' && alertData.cities && alertData.cities.length > 0) {
                console.log('Alert is active!');
                
                // Check if there are new cities or if it's a new alert ID
                const newCities = alertData.cities.filter(city => !previousCities.includes(city));
                const isNewAlert = alertData.id !== previousAlertId;
                
                if (newCities.length > 0 || isNewAlert) {
                    console.log('New cities detected or new alert. Waiting 5 seconds before taking screenshot...');
                    
                    // Add a 5-second delay
                    await delay(5000);
                    
                    const mapElement = await page.$('#map');

                    if (mapElement) {
                        const screenshotDir = 'screenshots';
                        
                        // Ensure the screenshots directory exists
                        if (!fs.existsSync(screenshotDir)) {
                            fs.mkdirSync(screenshotDir);
                        }

                        const screenshotPath = path.join(screenshotDir, `alert-${alertData.id}.png`);

                        await mapElement.screenshot({ path: screenshotPath });
                        console.log(`Screenshot saved as ${screenshotPath}`);
                        
                        // Update the previous cities list and alert ID
                        previousCities = alertData.cities;
                        previousAlertId = alertData.id;
                    } else {
                        console.log('Map element not found!');
                    }
                } else {
                    console.log('No new cities added and same alert ID. Skipping screenshot.');
                }
            } else {
                console.log('No active alert.');
                // Reset previous cities and alert ID when there's no active alert
                previousCities = [];
                previousAlertId = null;
            }
        } catch (error) {
            console.error('Error checking for alert:', error);
        }
    }

    // Initialize previousCities array and previousAlertId
    let previousCities = [];
    let previousAlertId = null;

    // Periodically check for alert
    setInterval(checkForAlert, 5000); // Check every 5 seconds

    // Keep the script running
    // If you want to stop the script after some time, you can add a timeout
})();
