require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json());
app.use(express.static('.'));

// ============================================================
// INITIALISATION BASE DE DONNÉES
// ============================================================
(async function initDatabase() {
    try {
        console.log('🔄 Initialisation de la base de données...');
        await db.initialize();
        console.log('✅ Base de données initialisée avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de la base:', error.message);
    }
})();

// ============================================================
// ROUTES PAGES
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/virtmak.html');
});

app.get('/virtmak.html', (req, res) => {
    res.sendFile(__dirname + '/virtmak.html');
});

app.get('/pay.html', (req, res) => {
    res.sendFile(__dirname + '/pay.html');
});

app.get('/verify', (req, res) => {
    res.sendFile(__dirname + '/verifypay.html');
});

app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

// ============================================================
// ROUTE : CRÉER UN LIEN DE PAIEMENT JEKO
// ============================================================
app.post('/create-payment-link', async (req, res) => {
    const { name, amount } = req.body;

    console.log(`📝 Création d'un lien de paiement pour ${name} (${amount} FCFA)`);

    try {
        const response = await fetch('https://api.jeko.africa/partner_api/payment_links', {
            method: 'POST',
            headers: {
                'X-API-KEY': process.env.JEKO_API_KEY,
                'X-API-KEY-ID': process.env.JEKO_API_KEY_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                storeId: process.env.JEKO_BUSINESS_ID,
                amount: amount || 100,
                currency: 'XOF',
                description: `Soutien Virtual Market - ${name || 'Anonyme'}`,
                successUrl: 'https://virtmarket-test.onrender.com/verify',
                cancelUrl: 'https://virtmarket-test.onrender.com/virtmak.html'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Erreur Jèko:', data);
            return res.status(response.status).json({ error: data.message || 'Erreur API Jèko' });
        }

        if (!data.paymentLink) {
            return res.status(500).json({ error: 'Aucun lien de paiement reçu' });
        }

        console.log(`✅ Lien généré : ${data.paymentLink}`);
        res.json({ checkout_url: data.paymentLink });

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ROUTE : RÉCUPÉRER LES PAIEMENTS (API)
// ============================================================
app.get('/api/payments', async (req, res) => {
    try {
        const payments = await db.getJekoPayments();
        res.json({ success: true, count: payments.length, payments });
    } catch (error) {
        console.error('❌ Erreur récupération paiements:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ROUTE : STATUT D'UN PAIEMENT
// ============================================================
app.get('/api/payment/status/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query(
            'SELECT * FROM payments_jeko WHERE transaction_id = $1 OR id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.json({ success: true, found: false });
        }

        res.json({ success: true, found: true, payment: result.rows[0] });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// WEBHOOK JEKO
// ============================================================
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

        // 2️⃣ Extraire le nom depuis counterpartLabel
        const body = req.body;
        const donorName = body.counterpartLabel || null;

        if (donorName && donorName !== '') {
            body.flex1 = donorName;
            console.log(`👤 Donateur : ${donorName}`);
        } else {
            body.flex1 = null;
        }

        // 3️⃣ Sauvegarder en base
        const savedId = await db.saveJekoPayment(body);

        if (savedId) {
            console.log(`✅ Paiement enregistré en base (ID: ${savedId})`);
        } else {
            console.log('ℹ️ Paiement déjà existant');
        }

        res.sendStatus(200);

    } catch (error) {
        console.error('❌ Erreur webhook:', error);
        res.sendStatus(500);
    }
});
// ============================================================
// ROUTE : PAGE ADMIN (HTML) 
// ============================================================
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

// ============================================================
// ROUTE : PAGE D'ACCUEIL (par défaut)
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/virtmak.html');
});

// ============================================================
// DÉMARRAGE
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`🌐 Accès: https://virtmarket-test.onrender.com`);
    console.log(`📊 Admin: https://virtmarket-test.onrender.com/admin`);
});