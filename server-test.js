require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('.'));

// Initialisation de la base de données
db.initialize().catch(err => console.error('❌ Erreur init DB:', err));

// Route principale → pay.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/pay.html');
});

// Route pour créer un paiement (redirection vers le lien Jèko)
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

// Route de vérification (page de succès)
app.get('/verify', (req, res) => {
    res.sendFile(__dirname + '/verifypay.html');
});

// ✅ Webhook Jèko avec vérification de signature et sauvegarde en base
app.post('/webhook', async (req, res) => {
    console.log('🔔 Webhook reçu');

    try {
        // 1️⃣ Vérifier la signature
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

        // 2️⃣ Sauvegarder le paiement en base
        const savedId = await db.saveJekoPayment(req.body);

        if (savedId) {
            console.log(`✅ Paiement enregistré en base (ID: ${savedId})`);
        } else {
            console.log('ℹ️ Paiement déjà existant ou erreur');
        }

        // 3️⃣ Répondre à Jèko
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