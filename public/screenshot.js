// screenshot.js
const puppeteer = require('puppeteer');

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

    // Log the page content
    const pageContent = await page.content();
    console.log('Page content:', pageContent);

    // Function to check for active alert and take screenshot
    async function checkForAlert() {
        try {
            const alertInfo = await page.evaluate(() => {
                console.log('Current polygonsDisplayed value:', window.polygonsDisplayed);
                return {
                    isActive: window.polygonsDisplayed,
                    cities: window.alertedCities || []
                };
            });

            console.log('Alert info:', alertInfo);

            if (alertInfo.isActive) {
                console.log('Alert is active!');
                
                // Check if there are new cities
                const newCities = alertInfo.cities.filter(city => !previousCities.includes(city));
                
                if (newCities.length > 0) {
                    console.log('New cities detected:', newCities);
                    console.log('Waiting 5 seconds before taking screenshot...');
                    
                    // Delay for 5 seconds
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    console.log('Taking screenshot now...');
                    const mapElement = await page.$('#map');

                    if (mapElement) {
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        await mapElement.screenshot({ path: `alert-map-${timestamp}.png` });
                        console.log(`Screenshot saved as alert-map-${timestamp}.png`);
                        
                        // Update the previous cities list
                        previousCities = alertInfo.cities;
                    } else {
                        console.log('Map element not found!');
                    }
                } else {
                    console.log('No new cities in alert. Skipping screenshot.');
                }
            } else {
                console.log('No active alert.');
                // Reset previous cities when there's no active alert
                previousCities = [];
            }
        } catch (error) {
            console.error('Error checking for alert:', error);
        }
    }

    // Initialize previousCities array
    let previousCities = [];

    // Periodically check for alert
    setInterval(checkForAlert, 5000); // Check every 5 seconds

    // Keep the script running
    // If you want to stop the script after some time, you can add a timeout
})();
