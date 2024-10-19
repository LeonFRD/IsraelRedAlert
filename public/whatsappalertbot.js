const { Client, LocalAuth, GroupChat, Chat, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs').promises;

// WhatsApp client setup
const client = new Client({
    authStrategy: new LocalAuth()
});

// QR code generation to authenticate the WhatsApp client
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR code generated, scan it using WhatsApp mobile app.');
});

// Event triggered when WhatsApp client is ready
client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    sendTestMessage(); // Send a test message when client is ready
    startAlertFetch(); // Start fetching alerts once client is ready
});

// Event triggered when an error occurs
client.on('auth_failure', (msg) => {
    console.error('Authentication failure:', msg);
});

// Event to log incoming group messages to find group chat IDs
client.on('message', async (msg) => {
    // Get the Chat object and print its ID
    const chat = await msg.getChat();
    console.log('Message received from chat ID:', chat.id);

    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

// Initialize the WhatsApp client
client.initialize();

let lastAlertId = null;
let lastAlertTimestamp = 0;
let pendingCities = new Set();
let screenshotSent = false;

// Function to format the alert message
async function formatAlertMessage(alert, newCities = null) {
    let title;
    let emoji;
    
    if (alert.type === 'missiles') {
        title = 'צבע אדום';
        emoji = '🚀';
    } else if (alert.type === 'hostileAircraftIntrusion') {
        title = 'חדירת כלי טיס עוין';
        emoji = '✈️';
    } else {
        title = 'סימולציית התרעה';
        emoji = '🚨';
    }

    const citiesData = await getCitiesData();
    const sortedCities = sortCitiesByZone(alert.cities, citiesData);
    let formattedCities = formatCitiesWithCountdown(sortedCities);

    if (newCities) {
        const newCitiesFormatted = newCities.join(', ');
        // formattedCities += `\n\n*ערים חדשות:* ${newCitiesFormatted}`;
    }

    return `${emoji} ${title} ${emoji}
${formattedCities}`;
}

async function getCitiesData() {
    const citiesData = await fs.readFile('./data/cities.json', 'utf8');
    return JSON.parse(citiesData);
}

function sortCitiesByZone(alertCities, citiesData) {
    return alertCities
        .map(cityName => citiesData.find(city => city.name === cityName))
        .filter(city => city !== undefined)
        .sort((a, b) => a.zone.localeCompare(b.zone));
}

function formatCitiesWithCountdown(sortedCities) {
    let formattedCities = '';
    let currentZone = '';
    let currentCountdown = null;
    let citiesWithSameCountdown = [];

    sortedCities.forEach((city, index) => {
        if (city.zone !== currentZone) {
            // Add countdown to the last group of cities if exists
            if (citiesWithSameCountdown.length > 0) {
                formattedCities += addCountdownToLastCity(citiesWithSameCountdown, currentCountdown);
                citiesWithSameCountdown = [];
            }
            if (currentZone !== '') formattedCities += '\n';
            formattedCities += `*${city.zone}*: `;
            currentZone = city.zone;
            currentCountdown = null;
        }

        if (city.countdown !== currentCountdown) {
            if (citiesWithSameCountdown.length > 0) {
                formattedCities += addCountdownToLastCity(citiesWithSameCountdown, currentCountdown);
                citiesWithSameCountdown = [];
            }
            currentCountdown = city.countdown;
        }

        citiesWithSameCountdown.push(city.name);

        if (index === sortedCities.length - 1) {
            formattedCities += addCountdownToLastCity(citiesWithSameCountdown, currentCountdown);
        }
    });

    return formattedCities;
}

function addCountdownToLastCity(cities, countdown) {
    let result = cities.join(', ');
    if (countdown === 0) {
        result += ' (```מיידי```)';
    } else {
        result += ` (\`\`\`${countdown} שניות\`\`\`)`;
    }
    return result + (cities.length > 1 ? '\n' : '');
}

// Function to fetch alerts from API and send to WhatsApp
async function fetchAndSendAlerts() {
    try {
        const response = await axios.get('http://localhost:3000/api/alert');
        const alert = response.data;

        if (alert && alert.id) {
            const currentTime = Math.floor(Date.now() / 1000);

            if (alert.id !== lastAlertId) {
                // New alert, send immediately
                lastAlertId = alert.id;
                lastAlertTimestamp = currentTime;
                pendingCities = new Set(alert.cities);
                screenshotSent = false;
                await sendAlertMessage(alert);
            } else if (alert.cities.some(city => !pendingCities.has(city))) {
                // New cities added, send update immediately
                const newCities = alert.cities.filter(city => !pendingCities.has(city));
                pendingCities = new Set(alert.cities);
                lastAlertTimestamp = currentTime;
                screenshotSent = false;
                await sendAlertMessage(alert, newCities);
            } else if (currentTime - lastAlertTimestamp >= 10 && !screenshotSent) {
                // 10 seconds passed without new cities, send with screenshot
                await sendAlertMessageWithScreenshot(alert);
                lastAlertTimestamp = currentTime;
                screenshotSent = true;
            }
        }
    } catch (error) {
        console.error('Error fetching or sending alert:', error);
    }
}

async function sendAlertMessage(alert, newCities = null) {
    const message = await formatAlertMessage(alert, newCities);
    await sendMessageToWhatsApp(message);
    console.log('Alert sent for cities:', alert.cities.join(', '));
}

async function sendAlertMessageWithScreenshot(alert) {
    const screenshotPath = path.join(__dirname, 'screenshots', `alert-${alert.id}.png`);
    
    try {
        // Wait for the latest screenshot
        await waitForLatestScreenshot(screenshotPath);

        const media = MessageMedia.fromFilePath(screenshotPath);
        await sendMessageToWhatsApp(null, media);
        console.log('Latest screenshot sent for alert ID:', alert.id);
    } catch (error) {
        console.error('Error handling screenshot:', error);
    }
}

async function waitForLatestScreenshot(filePath, timeout = 60000) {
    const startTime = Date.now();
    let lastModifiedTime = 0;

    while (Date.now() - startTime < timeout) {
        try {
            const stats = await fs.stat(filePath);
            const currentModifiedTime = stats.mtime.getTime();

            if (currentModifiedTime > lastModifiedTime) {
                console.log('New or updated screenshot detected');
                lastModifiedTime = currentModifiedTime;
            }

            // Check if the file hasn't been modified in the last second
            if (Date.now() - currentModifiedTime >= 1000) {
                console.log('Screenshot is stable. Sending...');
                return;
            }
        } catch (error) {
            console.log('Waiting for screenshot to be generated...');
        }

        // Wait for 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Timeout waiting for stable screenshot');
}

// Function to compare two arrays of cities
function areCitiesEqual(cities1, cities2) {
    if (cities1.length !== cities2.length) return false;
    return cities1.every((city, index) => city === cities2[index]);
}

// Function to send a message to a WhatsApp group
async function sendMessageToWhatsApp(message, media = null) {
    // Replace with your target group ID
    const targetChatId = '120363350395808244@g.us'; // Example for group chat

    try {
        const chat = await client.getChatById(targetChatId);
        if (media) {
            // Send media without a caption
            await chat.sendMessage(media);
        } else if (message) {
            await chat.sendMessage(message);
        }
        console.log('Message sent successfully to chat ID:', chat.id);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Function to send a test message
async function sendTestMessage() {
    const testMessage = "This is a test message from the WhatsApp Alert Bot.";
    await sendMessageToWhatsApp(testMessage);
    console.log("Test message sent.");
}

// Function to start fetching alerts continuously
function startAlertFetch() {
    // Check for new alerts every 2 seconds
    setInterval(fetchAndSendAlerts, 2000);
}

// Usage instructions
console.log('Starting script to fetch alerts and send them to WhatsApp.');
console.log('Ensure that your WhatsApp Web QR code is scanned for successful connection.');
