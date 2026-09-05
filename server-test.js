require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('.'));

// ✅ INITIALISATION DE LA BASE DE DONNÉES
(async function initDatabase() {
    try {
        console.log('🔄 Initialisation de la base de données...');
        await db.initialize();
        console.log('✅ Base de données initialisée avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de la base:', error.message);
    }
})();

// Route principale → pay.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/pay.html');
});

// Route pour créer un paiement
app.post('/create-payment', async (req, res) => {
    try {
        console.log('📝 Redirection vers le lien Jèko...');
        const paymentLink = 'https://pay.jeko.africa/pl/1892f9ee-ab1f-4859-929b-dd9985e94b9e?amount=1';
        res.json({ checkout_url: paymentLink });
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Route de vérification
app.get('/verify', (req, res) => {
    res.sendFile(__dirname + '/verifypay.html');
});

// Webhook Jèko
app.post('/webhook', async (req, res) => {
    console.log('🔔 Webhook reçu');
    try {
        const signature = req.headers['jeko-signature'];
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', process.env.JEKO_WEBHOOK_SECRET)
            .update(payload)
            .digest('hex');

        if (!signature || signature !== expectedSignature) {
            console.log('❌ Signature invalide !');
            return res.status(401).send('Invalid signature');
        }

        console.log('✅ Signature valide');
        const savedId = await db.saveJekoPayment(req.body);
        if (savedId) {
            console.log(`✅ Paiement enregistré en base (ID: ${savedId})`);
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Erreur webhook:', error);
        res.sendStatus(500);
    }
});

// Route admin pour voir les paiements
app.get('/admin/payments', async (req, res) => {
    try {
        const payments = await db.getJekoPayments();
        res.json({ success: true, count: payments.length, payments });
    } catch (error) {
        console.error('❌ Erreur récupération paiements:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});