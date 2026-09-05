require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('.'));

// Route principale → pay.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/pay.html');
});

// Route pour créer un paiement Jèko
app.post('/create-payment', async (req, res) => {
    try {
        const response = await fetch('https://api.jeko.africa/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.JEKO_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: 2,
                currency: 'XOF',
                success_url: 'http://localhost:3000/verify',
                cancel_url: 'http://localhost:3000/',
                metadata: {
                    product: 'Chaussure Nike',
                    price: 2
                }
            })
        });

        const data = await response.json();
        res.json({ checkout_url: data.checkout_url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook Jèko
app.post('/webhook', (req, res) => {
    console.log('🔔 Webhook reçu :', req.body);
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});