const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Replace with your bot token and chat ID
const botToken = '7781785682:AAG7bE8-PeWb6PKuMSEzJLGHlLlXSzqDU78';
const chatId = '-1002299701125';

// Create a bot instance
const bot = new TelegramBot(botToken);

// Set the polling interval (in milliseconds)
const pollingInterval = 5000;

// Keep track of the last alert to avoid sending duplicate messages
let lastAlert = null;

async function checkAndSendAlert() {
    try {
        const response = await axios.get('http://localhost:3000/api/alert');
        const alert = response.data;

        if (alert.type !== 'none' && JSON.stringify(alert) !== JSON.stringify(lastAlert)) {
            // Format the message
            const message = formatAlertMessage(alert);

            // Send the message to the Telegram group
            try {
                await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                console.log('Alert sent to Telegram group');
                lastAlert = alert;
            } catch (telegramError) {
                console.error('Error sending message to Telegram:', telegramError.message);
                if (telegramError.message.includes('chat not found')) {
                    console.log('Please check if the bot is added to the chat and the chat ID is correct.');
                }
            }
        } else if (alert.type === 'none' && lastAlert !== null) {
            try {
                await bot.sendMessage(chatId, 'All clear. No active alerts at this time.');
                console.log('All clear message sent to Telegram group');
                lastAlert = null;
            } catch (telegramError) {
                console.error('Error sending all clear message to Telegram:', telegramError.message);
            }
        }
    } catch (error) {
        console.error('Error checking or sending alert:', error.message);
    }
}

function formatAlertMessage(alert) {
    let message = `🚨 *Alert Type: ${alert.type}*\n\n`;
    message += `Affected Cities:\n`;
    alert.cities.forEach(city => {
        message += `- ${city}\n`;
    });
    message += `\nStay safe and follow local instructions.`;
    return message;
}

// Start the polling process
function startPolling() {
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
