const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;

const botToken = '7781785682:AAG7bE8-PeWb6PKuMSEzJLGHlLlXSzqDU78';
const chatId = '-1002299701125';
const serverUrl = 'http://localhost:3000'; // Adjust this if your server is running on a different URL

const bot = new TelegramBot(botToken, { polling: false });

let lastAlertState = null;
let lastMessageId = null;
const CHECK_INTERVAL = 1000; // Check every 1 second

let citiesData = {};

async function loadCitiesData() {
    try {
        const data = await fs.readFile('./data/cities.json', 'utf8');
        const cities = JSON.parse(data);
        cities.forEach(city => {
            citiesData[city.name] = city;
        });
        console.log('Cities data loaded successfully.');
    } catch (error) {
        console.error('Error loading cities data:', error);
    }
}

async function fetchAlert() {
    const response = await axios.get(`${serverUrl}/api/alert`);
    return response.data;
}

async function fetchAlertHistory() {
    const response = await axios.get(`${serverUrl}/api/alert-history`);
    return response.data;
}

function alertHasChanged(currentAlert, lastAlert) {
    if (!lastAlert) return true;
    if (currentAlert.id !== lastAlert.id) return true;
    if (currentAlert.type !== lastAlert.type) return true;
    if (JSON.stringify(currentAlert.cities.sort()) !== JSON.stringify(lastAlert.cities.sort())) return true;
    return false;
}

function groupAndDeduplicateHistory(history, alertId) {
    const relevantHistory = history.filter(entry => entry.id === alertId);
    const groupedHistory = {};

    relevantHistory.forEach(entry => {
        if (!groupedHistory[entry.timestamp]) {
            groupedHistory[entry.timestamp] = {
                type: entry.type,
                cities: new Set(entry.cities),
                simulated: entry.simulated
            };
        } else {
            entry.cities.forEach(city => groupedHistory[entry.timestamp].cities.add(city));
        }
    });

    return Object.entries(groupedHistory).map(([timestamp, data]) => ({
        timestamp,
        type: data.type,
        cities: Array.from(data.cities),
        simulated: data.simulated
    }));
}

function sortAndGroupCities(cities) {
    const sortedCities = cities
        .filter(city => citiesData[city]) // Filter out cities not in the JSON
        .sort((a, b) => {
            const zoneA = citiesData[a].zone;
            const zoneB = citiesData[b].zone;
            if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);
            return citiesData[a].countdown - citiesData[b].countdown;
        });

    const groupedCities = [];
    let currentZone = '';
    let currentCountdown = null;
    let cityGroup = [];

    sortedCities.forEach(city => {
        const cityData = citiesData[city];
        if (cityData.zone !== currentZone || cityData.countdown !== currentCountdown) {
            if (cityGroup.length > 0) {
                groupedCities.push({
                    zone: currentZone,
                    countdown: currentCountdown,
                    cities: cityGroup
                });
            }
            currentZone = cityData.zone;
            currentCountdown = cityData.countdown;
            cityGroup = [city];
        } else {
            cityGroup.push(city);
        }
    });

    if (cityGroup.length > 0) {
        groupedCities.push({
            zone: currentZone,
            countdown: currentCountdown,
            cities: cityGroup
        });
    }

    return groupedCities;
}

let lastMessageIds = {};

async function sendAlertMessage(alert, history) {
    const groupedHistory = groupAndDeduplicateHistory(history, alert.id);
    
    const currentDate = new Date().toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Determine the alert type and emoji for the title
    let alertTypeEmoji = '';
    let alertTypeText = '';
    let includeCountdown = false;
    switch (alert.type) {
        case 'hostileAircraftIntrusion':
            alertTypeEmoji = '✈️';
            alertTypeText = 'חדירת כלי טיס עוין';
            break;
        case 'missiles':
            alertTypeEmoji = '🚀';
            alertTypeText = 'התראת צבע אדום';
            includeCountdown = true;
            break;
        case 'simulated':
            alertTypeEmoji = '🔵';
            alertTypeText = 'סימולציה';
            includeCountdown = true;
            break;
        default:
            alertTypeEmoji = '🚨';
            alertTypeText = alert.type;
    }
    
    let message = `${alertTypeEmoji} ${alertTypeText} - ${currentDate} ${alertTypeEmoji}\n\n`;
    message += `מזהה התרעה: ${alert.id}\n\n`;

    const timeGroupedHistory = {};
    let lastCitiesSet = new Set();

    groupedHistory.forEach(entry => {
        const timestamp = new Date(entry.timestamp);
        const timeString = timestamp.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        const currentCitiesSet = new Set(entry.cities);
        
        if (!setsAreEqual(currentCitiesSet, lastCitiesSet)) {
            if (!timeGroupedHistory[timeString]) {
                timeGroupedHistory[timeString] = {};
            }
            
            entry.cities.forEach(city => {
                const zone = citiesData[city]?.zone || 'לא ידוע';
                const countdown = citiesData[city]?.countdown || 'לא ידוע';
                if (!timeGroupedHistory[timeString][zone]) {
                    timeGroupedHistory[timeString][zone] = {};
                }
                if (!timeGroupedHistory[timeString][zone][countdown]) {
                    timeGroupedHistory[timeString][zone][countdown] = [];
                }
                timeGroupedHistory[timeString][zone][countdown].push(city);
            });
            
            lastCitiesSet = currentCitiesSet;
        }
    });

    // Sort times
    const sortedTimes = Object.keys(timeGroupedHistory).sort();

    sortedTimes.forEach(time => {
        message += `\n${time}:\n`;
        const zones = Object.keys(timeGroupedHistory[time]).sort();
        zones.forEach(zone => {
            message += `• *${zone}:*`;
            const countdowns = Object.keys(timeGroupedHistory[time][zone]).sort((a, b) => parseInt(a) - parseInt(b));
            countdowns.forEach(countdown => {
                const cities = timeGroupedHistory[time][zone][countdown];
                const citiesString = cities.join(', ');
                if (includeCountdown) {
                    const countdownUrl = `https://t.me/AlertsOfIsrael`;
                    let countdownText;
                    if (countdown === '0' || countdown === 0) {
                        countdownText = 'מיידי';
                    } else if (countdown !== 'לא ידוע') {
                        countdownText = `${countdown} שניות`;
                    } else {
                        countdownText = '';
                    }
                    
                    if (countdownText) {
                        message += `${citiesString} [(${countdownText})](${countdownUrl})`;
                    } else {
                        message += `${citiesString}`;
                    }
                } else {
                    message += `${citiesString}`;
                }
            });
            message += '\n';
        });
    });

    // Split the message into parts if it's too long
    const MAX_MESSAGE_LENGTH = 4000; // Leave some buffer for Telegram's limit
    let messageParts = [];
    let currentPart = message;

    while (currentPart.length > MAX_MESSAGE_LENGTH) {
        let splitIndex = currentPart.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
        if (splitIndex === -1 || splitIndex > MAX_MESSAGE_LENGTH) {
            splitIndex = MAX_MESSAGE_LENGTH;
        }
        messageParts.push(currentPart.substring(0, splitIndex));
        currentPart = currentPart.substring(splitIndex);
    }
    messageParts.push(currentPart);

    // Delete previous messages with the same alert ID
    if (lastMessageIds[alert.id]) {
        for (const messageId of lastMessageIds[alert.id]) {
            try {
                await bot.deleteMessage(chatId, messageId);
            } catch (error) {
                console.error('Error deleting previous message:', error.message);
            }
        }
    }

    // Send each part of the message and store their IDs
    lastMessageIds[alert.id] = [];
    for (let i = 0; i < messageParts.length; i++) {
        const partMessage = `${alertTypeEmoji} ${alertTypeText} - Part ${i + 1}/${messageParts.length} ${alertTypeEmoji}\n\n${messageParts[i]}`;
        const sentMessage = await bot.sendMessage(chatId, partMessage, { parse_mode: 'Markdown' });
        lastMessageIds[alert.id].push(sentMessage.message_id);
    }

    console.log(`Alert history update sent to Telegram group in ${messageParts.length} parts.`);
}

// Helper function to compare sets
function setsAreEqual(a, b) {
    if (a.size !== b.size) return false;
    for (let item of a) if (!b.has(item)) return false;
    return true;
}

async function checkAndSendAlert() {
    try {
        const currentAlert = await fetchAlert();

        if (currentAlert.type === 'none' || !currentAlert.id) {
            if (lastAlertState && lastAlertState.type !== 'none') {
                // Send an "Alert has ended" message without deleting the last alert message
                await bot.sendMessage(chatId, '⚠️ Alert has ended ⚠️');
                console.log('Alert ended notification sent.');
                lastMessageId = null; // Reset lastMessageId so we don't try to delete it next time
            }
            lastAlertState = currentAlert;
            return;
        }

        if (alertHasChanged(currentAlert, lastAlertState)) {
            const fullHistory = await fetchAlertHistory();
            await sendAlertMessage(currentAlert, fullHistory);
            lastAlertState = JSON.parse(JSON.stringify(currentAlert)); // Deep copy
        }
    } catch (error) {
        console.error('Error checking and sending alert:', error.message);
    }
}

// Load cities data before starting the main loop
loadCitiesData().then(() => {
    // Run the check frequently
    setInterval(checkAndSendAlert, CHECK_INTERVAL);
    console.log('Telegram Alert Tracker with Sorted Cities and Countdown is running...');
});

// Optional: Implement a simple health check
setInterval(async () => {
    try {
        await axios.get(`${serverUrl}/api/alert`);
        console.log('Health check: OK');
    } catch (error) {
        console.error('Health check failed:', error.message);
    }
}, 60000); // Every minute
