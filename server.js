const express = require('express');
const pikudHaoref = require('pikud-haoref-api');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let simulatedAlert = null;
let currentAlertId = null;

app.get('/api/alert', (req, res) => {
    if (simulatedAlert) {
        return res.json(simulatedAlert);
    }

    const options = {
        // If you're outside Israel, you might need to use a proxy
        // proxy: 'http://user:pass@hostname:port/'
    };

    pikudHaoref.getActiveAlert((err, alert) => {
        if (err) {
            console.error('Error retrieving alert:', err);
            return res.status(500).json({ error: 'Failed to retrieve alert' });
        }
        
        if (alert.type === 'none') {
            // Clear the alert ID when there's no active alert
            currentAlertId = null;
            alert.id = null;
        } else if (!currentAlertId) {
            // Assign a new ID only if there isn't a current alert ID
            currentAlertId = uuidv4();
        }

        // Assign the current alert ID to the alert object
        if (alert.type !== 'none') {
            alert.id = currentAlertId;
        }

        res.json(alert);
    }, options);
});

app.post('/api/simulate', (req, res) => {
    simulatedAlert = req.body;
    if (simulatedAlert.type !== 'none') {
        if (!currentAlertId) {
            currentAlertId = uuidv4();
        }
        simulatedAlert.id = currentAlertId;
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});