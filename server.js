const express = require('express');
const pikudHaoref = require('pikud-haoref-api');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let simulatedAlert = null;
let currentAlertId = null;
let alertHistory = [];

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

function getAlertWithRetry(options, retries = 0) {
    return new Promise((resolve, reject) => {
        pikudHaoref.getActiveAlert((err, alert) => {
            if (err) {
                console.error(`Error retrieving alert (attempt ${retries + 1}):`, err);
                if (retries < MAX_RETRIES) {
                    setTimeout(() => {
                        resolve(getAlertWithRetry(options, retries + 1));
                    }, RETRY_DELAY);
                } else {
                    reject(err);
                }
            } else {
                resolve(alert);
            }
        }, options);
    });
}

app.get('/api/alert', async (req, res) => {
    if (simulatedAlert) {
        return res.json(simulatedAlert);
    }

    const options = {
        // If you're outside Israel, you might need to use a proxy
        // proxy: 'http://user:pass@hostname:port/'
    };

    try {
        const alert = await getAlertWithRetry(options);
        
        // Process the alert as before
        if (alert.type === 'none') {
            currentAlertId = null;
            alert.id = null;
        } else if (!currentAlertId) {
            currentAlertId = uuidv4();
        }

        if (alert.type !== 'none') {
            alert.id = currentAlertId;
            const historyEntry = {
                id: alert.id,
                type: alert.type,
                title: alert.title,
                data: alert.data,
                cities: alert.cities || [],
                timestamp: moment().tz('Asia/Jerusalem').format('YYYY-MM-DD HH:mm')
            };
            alertHistory.push(historyEntry);
        }

        res.json(alert);
    } catch (error) {
        console.error('Failed to retrieve alert after multiple attempts:', error);
        res.json({
            type: 'none',
            id: null,
            title: 'No active alerts',
            desc: 'Unable to fetch data from Pikud Ha\'oref after multiple attempts',
            data: [],
            cities: []
        });
    }
});

app.post('/api/simulate', (req, res) => {
    simulatedAlert = req.body;
    if (simulatedAlert.type !== 'none') {
        if (!currentAlertId) {
            currentAlertId = uuidv4();
        }
        simulatedAlert.id = currentAlertId;

        const historyEntry = {
            id: simulatedAlert.id,
            type: simulatedAlert.type,
            title: simulatedAlert.title,
            data: simulatedAlert.data,
            cities: simulatedAlert.cities || [],
            timestamp: moment().tz('Asia/Jerusalem').format('YYYY-MM-DD HH:mm'),
            simulated: true
        };
        alertHistory.push(historyEntry);
    } else {
        currentAlertId = null;
        simulatedAlert.id = null;
    }

    res.json({ message: 'Simulation started', alertId: simulatedAlert.id });
});

app.post('/api/stop-simulation', (req, res) => {
    simulatedAlert = null;
    currentAlertId = null;
    res.json({ message: 'Simulation stopped' });
});

app.get('/api/alert-history', (req, res) => {
    const historyWithTimestamps = alertHistory.map(alert => ({
        ...alert,
        timestamp: moment(alert.timestamp).tz('Asia/Jerusalem').format('YYYY-MM-DD HH:mm:ss')
    }));
    res.json(historyWithTimestamps);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
