const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Replace with your bot token and chat ID
const botToken = '7781785682:AAG7bE8-PeWb6PKuMSEzJLGHlLlXSzqDU78';
const chatId = '-1002299701125';

// Create a bot instance
const bot = new TelegramBot(botToken);

// Set the polling interval (in milliseconds)
const pollingInterval = 5000;

// Keep track of the last alert ID, message ID, and cities
let lastAlertId = null;
let lastMessageIds = [];
let lastAlertCities = null; // New variable to store the last alert's cities
let lastScreenshotId = null;

async function checkAndSendAlert() {
    try {
        const response = await axios.get('http://localhost:3000/api/alert');
        const alert = response.data;

        if (alert.type !== 'none') {
            // Load city data
            const citiesData = await loadCitiesData();
            
            // Check if the cities have changed
            const citiesChanged = !lastAlertCities || 
                !arraysEqual(alert.cities.sort(), lastAlertCities.sort());

            if (alert.id !== lastAlertId || citiesChanged) {
                // Format the message with sorted cities and countdown
                const message = formatAlertMessage(alert, citiesData);

                if (alert.id !== lastAlertId) {
                    // New alert: send a new message
                    await sendNewAlert(message, alert.id);
                } else if (citiesChanged) {
                    // Existing alert with changed cities: update the message
                    await updateAlertMessage(message, alert.id);
                }

                lastAlertId = alert.id;
                lastAlertCities = [...alert.cities]; // Store a copy of the current cities
            }
        } else if (alert.type === 'none' && lastAlertId !== null) {
            // Reset the last alert ID and cities, but don't send an "All clear" message
            lastAlertId = null;
            lastAlertCities = null;
            lastMessageIds = [];
        }
    } catch (error) {
        console.error('Error checking or sending alert:', error.message);
        if (error.code === 'ECONNRESET') {
            console.log('Connection was reset. This might be due to server instability or network issues.');
            console.log('Retrying in 10 seconds...');
            setTimeout(checkAndSendAlert, 10000);
        } else {
            console.error('Full error object:', error);
        }
    }
}

async function sendNewAlert(message, alertId) {
    try {
        // Split and send text messages
        const sentMessages = await sendSplitMessages(message);
        console.log(`New alert text sent to Telegram group. Alert ID: ${alertId}`);
        lastMessageIds = sentMessages.map(msg => msg.message_id);

        // Wait for 3 seconds before sending the screenshot
        await new Promise(resolve => setTimeout(resolve, 6000));

        // Send screenshot if available
        const screenshotPath = await getScreenshotPath(alertId);
        if (screenshotPath) {
            const sentPhoto = await bot.sendPhoto(chatId, screenshotPath);
            console.log(`Screenshot sent for alert ID: ${alertId}`);
            lastScreenshotId = sentPhoto.message_id;
        }
    } catch (telegramError) {
        console.error('Error sending new alert to Telegram:', telegramError.message);
        handleTelegramError(telegramError);
    }
}

async function updateAlertMessage(message, alertId) {
    if (lastMessageIds && lastMessageIds.length > 0) {
        try {
            // Delete all previous text messages
            for (const messageId of lastMessageIds) {
                await bot.deleteMessage(chatId, messageId);
            }
            console.log(`Previous alert messages deleted. Message IDs: ${lastMessageIds.join(', ')}`);
            
            // Delete the previous screenshot if it exists
            if (lastScreenshotId) {
                await bot.deleteMessage(chatId, lastScreenshotId);
                console.log(`Previous screenshot deleted. Message ID: ${lastScreenshotId}`);
            }
            
            // Send new split messages with updated information
            const sentMessages = await sendSplitMessages(message);
            console.log(`Updated alert text sent to Telegram group. Alert ID: ${alertId}`);
            lastMessageIds = sentMessages.map(msg => msg.message_id);

            // Wait for 3 seconds before sending the updated screenshot
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Send updated screenshot if available
            const screenshotPath = await getScreenshotPath(alertId);
            if (screenshotPath) {
                const sentPhoto = await bot.sendPhoto(chatId, screenshotPath);
                console.log(`Updated screenshot sent for alert ID: ${alertId}`);
                lastScreenshotId = sentPhoto.message_id;
            } else {
                lastScreenshotId = null;
            }
        } catch (telegramError) {
            console.error('Error updating alert in Telegram:', telegramError.message);
            handleTelegramError(telegramError);
        }
    } else {
        // If for some reason we don't have the last message IDs, just send a new message
        await sendNewAlert(message, alertId);
    }
}

function handleTelegramError(error) {
    if (error.message.includes('chat not found')) {
        console.log('Please check if the bot is added to the chat and the chat ID is correct.');
    }
}

async function loadCitiesData() {
    try {
        const response = await axios.get('http://localhost:3000/data/cities.json');
        return response.data;
    } catch (error) {
        console.error('Error loading cities data:', error.message);
        return [];
    }
}

function formatAlertMessage(alert, citiesData) {
    const now = new Date();
    const timestamp = now.toLocaleString('he-IL', { 
        timeZone: 'Asia/Jerusalem', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
    });
    
    let message = `🚨 *Alert Type: ${alert.type}* (${timestamp})\n`;
    message += `Alert ID: ${alert.id}\n\n`;
    
    // Group cities by zone
    const cityGroups = {};
    alert.cities.forEach(cityName => {
        const cityData = citiesData.find(city => city.name === cityName || city.name_en === cityName);
        if (cityData) {
            const zone = cityData.zone || 'Unknown Zone';
            if (!cityGroups[zone]) {
                cityGroups[zone] = [];
            }
            cityGroups[zone].push({ name: cityName, countdown: cityData.countdown });
        }
    });

    // Sort zones and cities within each zone
    Object.keys(cityGroups).sort().forEach(zone => {
        message += `*${zone}:*\n`;
        const sortedCities = cityGroups[zone].sort((a, b) => a.countdown - b.countdown);
        
        let currentCountdown = null;
        let citiesWithSameCountdown = [];
        let zoneMessage = '';

        sortedCities.forEach((city, index) => {
            if (city.countdown !== currentCountdown) {
                if (citiesWithSameCountdown.length > 0) {
                    zoneMessage += `${citiesWithSameCountdown.join(', ')} (${currentCountdown} דקות), `;
                    citiesWithSameCountdown = [];
                }
                currentCountdown = city.countdown;
            }
            citiesWithSameCountdown.push(city.name);

            if (index === sortedCities.length - 1) {
                zoneMessage += `${citiesWithSameCountdown.join(', ')} (${currentCountdown} דקות)`;
            }
        });

        message += `${zoneMessage}\n\n`;
    });

    message += `\nStay safe and follow local instructions.`;
    return message;
}

// Start the polling process
function startPolling() {
    checkAndSendAlert(); // Initial check
    setInterval(checkAndSendAlert, pollingInterval);
    console.log('Telegram alert system started');
}

// Test the bot connection
bot.getMe().then((botInfo) => {
    console.log('Bot connected successfully. Bot username:', botInfo.username);
}).catch((error) => {
    console.error('Error connecting to bot:', error.message);
});

startPolling();

// Helper function to compare arrays
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

async function getScreenshotPath(alertId) {
    const screenshotFileName = `alert-${alertId}.png`;
    const screenshotPath = path.join('C:', 'Users', 'danie', 'OneDrive', 'Desktop', 'zevaAdomNew', 'newredalert', 'public', 'screenshots', screenshotFileName);
    
    try {
        await fs.access(screenshotPath);
        console.log(`Screenshot found for alert ID: ${alertId} at path: ${screenshotPath}`);
        return screenshotPath;
    } catch (error) {
        console.error(`Screenshot not found for alert ID: ${alertId}`);
        console.error(`Attempted path: ${screenshotPath}`);
        return null;
    }
}

async function sendSplitMessages(message) {
    const maxLength = 4096; // Telegram's maximum message length
    const messages = [];

    while (message.length > 0) {
        let chunk = message.slice(0, maxLength);
        
        // If the chunk ends in the middle of a line, find the last newline
        const lastNewline = chunk.lastIndexOf('\n');
        if (lastNewline > 0 && chunk.length === maxLength) {
            chunk = chunk.slice(0, lastNewline);
        }

        messages.push(chunk);
        message = message.slice(chunk.length);
    }

    const sentMessages = [];
    for (const chunk of messages) {
        const sentMessage = await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
        sentMessages.push(sentMessage);
    }

    return sentMessages;
}
