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
        console.log('📝 Création d\'un paiement Jèko...');

        const response = await fetch('https://api.jeko.africa/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.JEKO_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: 200, // 200 centimes = 2 FCFA
                currency: 'XOF',
                success_url: 'https://virtmarket-test.onrender.com/verify',
                cancel_url: 'https://virtmarket-test.onrender.com/',
                metadata: {
                    product: 'Chaussure Nike',
                    price: 2
                }
            })
        });

        const data = await response.json();
        console.log('📦 Réponse Jèko :', data);

        if (!response.ok) {
            throw new Error(data.message || 'Erreur API Jèko');
        }

        if (!data.checkout_url) {
            throw new Error('Aucune URL de paiement reçue');
        }

        res.json({ checkout_url: data.checkout_url });

    } catch (error) {
        console.error('❌ Erreur :', error.message);
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