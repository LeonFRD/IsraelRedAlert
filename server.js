const express = require('express');
const pikudHaoref = require('pikud-haoref-api');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());  // Add this line to parse JSON bodies

let simulatedAlert = null;

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
        res.json(alert);
    }, options);
});

// Add these new routes for simulation
app.post('/api/simulate', (req, res) => {
    simulatedAlert = req.body;
    res.json({ message: 'Simulation started' });
});

app.post('/api/stop-simulation', (req, res) => {
    simulatedAlert = null;
    res.json({ message: 'Simulation stopped' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
