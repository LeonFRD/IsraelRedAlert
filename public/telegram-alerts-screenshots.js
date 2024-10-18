const fs = require('fs').promises;
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const botToken = '7781785682:AAG7bE8-PeWb6PKuMSEzJLGHlLlXSzqDU78';
const chatId = '-1002299701125';
const serverUrl = 'http://localhost:3000';
const screenshotsDir = './screenshots';

const bot = new TelegramBot(botToken, { polling: false });

let lastProcessedTimestamp = 0;
let currentAlertId = null;
let lastSentMessageId = null;
let isProcessing = false;
let lastCities = null;
let lastAlertTime = 0;
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 3000;
const SCREENSHOT_DELAY = 5000; // 5 seconds delay before sending screenshot
const NEW_ALERT_COOLDOWN = 10000; // 10 seconds cooldown after a new alert
let lastAlertJSON = null;

async function fetchCurrentAlert() {
    const response = await axios.get(`${serverUrl}/api/alert`);
    return response.data;
}

async function fetchAlertHistory(alertId) {
    const response = await axios.get(`${serverUrl}/api/alert-history`);
    return response.data.filter(alert => alert.id === alertId);
}

async function findLatestScreenshot(alertId) {
    const files = await fs.readdir(screenshotsDir);
    const pattern = new RegExp(`^alert-${alertId}\\.png$`);
    const matchingFile = files.find(file => pattern.test(file));
    
    return matchingFile || null;
}

async function isScreenshotReady(filename) {
    const screenshotPath = path.join(screenshotsDir, filename);
    try {
        const stats = await fs.stat(screenshotPath);
        const currentTime = new Date().getTime();
        const fileAge = (currentTime - stats.mtime.getTime()) / 1000;
        return fileAge >= 2;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

async function deleteLastMessage() {
    if (lastSentMessageId) {
        try {
            await bot.deleteMessage(chatId, lastSentMessageId);
            console.log(`Deleted previous message: ${lastSentMessageId}`);
            lastSentMessageId = null;
        } catch (deleteError) {
            console.error('Error deleting previous message:', deleteError.message);
        }
    }
}

async function sendScreenshot(alertId, retryCount = 0) {
    if (retryCount >= MAX_RETRIES) {
        console.error(`Max retries reached for alert ${alertId}. Screenshot not sent.`);
        isProcessing = false;
        return;
    }

    const latestScreenshot = await findLatestScreenshot(alertId);
    if (!latestScreenshot) {
        console.log(`No screenshot found for alert ${alertId}. Retrying in ${RETRY_INTERVAL / 1000} seconds...`);
        setTimeout(() => sendScreenshot(alertId, retryCount + 1), RETRY_INTERVAL);
        return;
    }

    const screenshotPath = path.join(screenshotsDir, latestScreenshot);

    try {
        if (await isScreenshotReady(latestScreenshot)) {
            // Send the new screenshot
            const sentMessage = await bot.sendPhoto(chatId, screenshotPath, { caption: `Screenshot for alert ${alertId}` });
            console.log(`Screenshot sent for alert ${alertId}: ${latestScreenshot}`);
            lastSentMessageId = sentMessage.message_id;
        } else {
            console.log(`Screenshot not ready for alert ${alertId}. Retrying in ${RETRY_INTERVAL / 1000} seconds...`);
            setTimeout(() => sendScreenshot(alertId, retryCount + 1), RETRY_INTERVAL);
            return;
        }
    } catch (error) {
        console.error('Error sending screenshot:', error.message);
        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying screenshot send for alert ${alertId} in ${RETRY_INTERVAL / 1000} seconds...`);
            setTimeout(() => sendScreenshot(alertId, retryCount + 1), RETRY_INTERVAL);
            return;
        }
    }
    isProcessing = false;
}

async function checkAndSendScreenshot() {
    try {
        const currentAlert = await fetchCurrentAlert();
        const currentTime = Date.now();

        if (currentAlert.type === 'none' || !currentAlert.id) {
            console.log('No active alert.');
            currentAlertId = null;
            lastSentMessageId = null;
            lastCities = null;
            lastAlertTime = 0;
            lastAlertJSON = null;
            await deleteLastMessage();
            return;
        }

        const citiesChanged = JSON.stringify(currentAlert.cities) !== JSON.stringify(lastCities);
        const currentAlertJSON = JSON.stringify(currentAlert);

        if (currentAlert.id !== currentAlertId || citiesChanged || (currentTime - lastAlertTime > NEW_ALERT_COOLDOWN && currentAlertJSON !== lastAlertJSON)) {
            if (currentAlert.id !== currentAlertId || citiesChanged) {
                console.log(`New alert detected or cities changed: ${currentAlert.id}`);
            } else {
                console.log(`Changes detected for alert ${currentAlertId}.`);
            }

            currentAlertId = currentAlert.id;
            lastCities = currentAlert.cities;
            lastAlertTime = currentTime;
            lastAlertJSON = currentAlertJSON;

            if (!isProcessing) {
                isProcessing = true;
                await deleteLastMessage();
                console.log(`Waiting ${SCREENSHOT_DELAY / 1000} seconds before sending screenshot...`);
                setTimeout(() => sendScreenshot(currentAlertId), SCREENSHOT_DELAY);
            }
        }
    } catch (error) {
        console.error('Error checking and sending screenshot:', error.message);
    }
}

// Run the check every 10 seconds
const CHECK_INTERVAL = 10000;
setInterval(checkAndSendScreenshot, CHECK_INTERVAL);

console.log('Telegram Alert Screenshot Sender is running...');

// Optional: Implement a simple health check
setInterval(async () => {
    try {
        await axios.get(`${serverUrl}/api/alert`);
        console.log('Health check: OK');
    } catch (error) {
        console.error('Health check failed:', error.message);
    }
}, 60000); // Every minute
