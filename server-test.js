require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('.'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/pay.html');
});

app.post('/create-payment', async (req, res) => {
    try {
        console.log('📝 Création d\'un paiement Jèko...');

        const response = await fetch('https://api.jeko.africa/partner_api/payment_links', {
            method: 'POST',
            headers: {
                'X-API-KEY': process.env.JEKO_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                storeId: process.env.JEKO_BUSINESS_ID,
                amount: 2,
                currency: 'XOF',
                description: 'Chaussure Nike',
                successUrl: 'https://virtmarket-test.onrender.com/verify',
                cancelUrl: 'https://virtmarket-test.onrender.com/'
            })
        });

        const data = await response.json();
        console.log('📦 Réponse Jèko :', data);

        if (!response.ok) {
            throw new Error(data.message || 'Erreur API Jèko');
        }

        if (!data.paymentLink) {
            throw new Error('Aucun lien de paiement reçu');
        }

        res.json({ checkout_url: data.paymentLink });

    } catch (error) {
        console.error('❌ Erreur :', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/webhook', (req, res) => {
    console.log('🔔 Webhook reçu :', req.body);
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});