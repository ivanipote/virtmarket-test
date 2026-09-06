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
// NETTOYAGE AUTO DES PAIEMENTS PENDING ORPHELINS (15min)
// ============================================================
async function cleanPendingPayments() {
    try {
        const count = await db.cleanPendingPayments();
        if (count > 0) {
            console.log(`🧹 ${count} paiement(s) pending supprimés`);
        }
    } catch (error) {
        console.error('❌ Erreur nettoyage:', error);
    }
}

setInterval(cleanPendingPayments, 5 * 60 * 1000);
cleanPendingPayments();

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

app.get('/payviaapi.html', (req, res) => {
    res.sendFile(__dirname + '/payviaapi.html');
});

app.get('/verify', (req, res) => {
    res.sendFile(__dirname + '/verifypay.html');
});

app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

app.get('/testmail.html', (req, res) => {
    res.sendFile(__dirname + '/testmail.html');
});

// ============================================================
// ROUTE : ENREGISTRER UN UTILISATEUR (visiteur)
// ============================================================
app.post('/api/user/register', async (req, res) => {
    const { name, email } = req.body;

    console.log(`📝 Enregistrement utilisateur : ${name} (${email})`);

    if (!name || !email) {
        return res.status(400).json({ error: 'Nom et email requis' });
    }

    try {
        const user = await db.getOrCreateUser(name, email);
        
        // Mettre à jour le statut vers 'visiteur' si différent
        if (user.user_status !== 'visiteur') {
            await db.updateUserStatus(email, 'visiteur');
        }

        console.log(`✅ Utilisateur enregistré : ${name} (${email}) - statut: visiteur`);

        res.json({ 
            success: true, 
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                user_status: 'visiteur'
            }
        });

    } catch (error) {
        console.error('❌ Erreur enregistrement utilisateur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ROUTE : METTRE À JOUR LE STATUT UTILISATEUR (participant / donateur)
// ============================================================
app.post('/api/user/update-status', async (req, res) => {
    const { email, status } = req.body;

    console.log(`📝 Mise à jour statut : ${email} → ${status}`);

    if (!email || !status) {
        return res.status(400).json({ error: 'Email et status requis' });
    }

    const validStatuses = ['visiteur', 'participant', 'donateur'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
    }

    try {
        const user = await db.updateUserStatus(email, status);
        
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        console.log(`✅ Statut mis à jour : ${email} → ${status}`);

        res.json({ 
            success: true, 
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                user_status: status
            }
        });

    } catch (error) {
        console.error('❌ Erreur mise à jour statut:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ROUTE : CRÉER UN LIEN DE PAIEMENT JEKO (API)
// ============================================================
app.post('/create-payment-link', async (req, res) => {
    const { name, email, amount } = req.body;

    // ✅ Convertir le montant en centimes
    const amountInCentimes = Math.round(amount * 100);

    console.log(`📝 Création d'un lien de paiement pour ${name} (${amount} FCFA → ${amountInCentimes} centimes)`);

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
    title: `Soutien Virtual Market - ${name || 'Anonyme'}`,
    amountCents: amountInCentimes,
    currency: 'XOF',
    paymentMethod: 'wave',  // ✅ FORCER WAVE
    successUrl: 'https://virtmarket-test.onrender.com/verify',
    cancelUrl: 'https://virtmarket-test.onrender.com/virtmak.html'
})
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Erreur Jèko:', data);
            return res.status(response.status).json({ 
                error: data.message || 'Erreur API Jèko',
                details: data
            });
        }

        if (!data.link) {
            console.error('❌ Aucun lien reçu:', data);
            return res.status(500).json({ error: 'Aucun lien de paiement reçu' });
        }

        console.log(`✅ Lien généré : ${data.link}`);
        res.json({ checkout_url: data.link });

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
        const payment = await db.getPaymentById(id);
        if (!payment) {
            return res.json({ success: true, found: false });
        }
        res.json({ success: true, found: true, payment });
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

        const body = req.body;

        // 2️⃣ Extraire les données
        const donorName = body.counterpartLabel || null;
        const donorEmail = body.flex2 || null; // Sera envoyé depuis pay.html
        const transactionId = body.id;

        // 3️⃣ Mettre à jour le paiement en base
        body.flex1 = donorName;
        body.flex2 = donorEmail;
        body.flex5 = 'donateur';

        const savedId = await db.saveJekoPayment(body);

        if (savedId) {
            console.log(`✅ Paiement enregistré en base (ID: ${savedId})`);
            
            // 4️⃣ Mettre à jour le statut utilisateur vers 'donateur'
            if (donorEmail) {
                const updated = await db.updateUserStatus(donorEmail, 'donateur');
                if (updated) {
                    console.log(`✅ Utilisateur ${donorEmail} → donateur`);
                }
            }
        } else {
            console.log('ℹ️ Paiement déjà existant');
        }

        // 5️⃣ Envoyer l'email de remerciement (à implémenter)
        // await sendConfirmationEmail(donorName, donorEmail, amount, transactionId);

        res.sendStatus(200);

    } catch (error) {
        console.error('❌ Erreur webhook:', error);
        res.sendStatus(500);
    }
});

// ============================================================
// DÉMARRAGE
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`🌐 Accès: https://virtmarket-test.onrender.com`);
    console.log(`📊 Admin: https://virtmarket-test.onrender.com/admin`);
});