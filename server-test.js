// ================================================================
// FICHIER : server.js
// DESCRIPTION : Serveur principal - Virtual Market
// VERSION : 3.0 - Structure propre et routes nommées
// ================================================================

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ================================================================
// 1. MIDDLEWARE
// ================================================================

app.use(express.json());
app.use(express.static('.'));

// ================================================================
// 2. INITIALISATION
// ================================================================

(async function init() {
    try {
        console.log('🔄 Initialisation de la base de données...');
        await db.initialize();
        console.log('✅ Base de données initialisée');
    } catch (error) {
        console.error('❌ Erreur initialisation:', error.message);
    }
})();

// ================================================================
// 3. NETTOYAGE AUTO
// ================================================================

async function autoClean() {
    try {
        const orders = await db.cleanOldOrders(15);
        const payments = await db.cleanOldPayments(15);
        if (orders > 0 || payments > 0) {
            console.log(`🧹 Nettoyage: ${orders} commandes, ${payments} paiements supprimés`);
        }
    } catch (error) {
        console.error('❌ Erreur nettoyage:', error);
    }
}

setInterval(autoClean, 5 * 60 * 1000);
autoClean();

// ================================================================
// 4. ROUTES PAGES STATIQUES
// ================================================================

app.get('/', (req, res) => res.sendFile(__dirname + '/virtmak.html'));
app.get('/virtmak.html', (req, res) => res.sendFile(__dirname + '/virtmak.html'));
app.get('/pay.html', (req, res) => res.sendFile(__dirname + '/pay.html'));
app.get('/admin', (req, res) => res.sendFile(__dirname + '/admin.html'));
app.get('/verify', (req, res) => res.sendFile(__dirname + '/verifypay.html'));
app.get('/payviaapi.html', (req, res) => res.sendFile(__dirname + '/payviaapi.html'));
app.get('/testmail.html', (req, res) => res.sendFile(__dirname + '/testmail.html'));

// ================================================================
// 5. API : VISITEUR
// ================================================================

/**
 * POST /api/visiteur
 * Crée un utilisateur avec le statut 'visiteur'
 */
app.post('/api/visiteur', async (req, res) => {
    const { name, email } = req.body;

    console.log(`📝 Enregistrement visiteur: ${name} (${email})`);

    if (!name || !email) {
        return res.status(400).json({ error: 'Nom et email requis' });
    }

    try {
        const user = await db.getOrCreateUser(name, email);
        
        if (user.status !== 'visiteur') {
            await db.updateUserStatus(email, 'visiteur');
        }

        console.log(`✅ Visiteur enregistré: ${email}`);
        res.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email, status: 'visiteur' }
        });

    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// 6. API : CRÉER UN PAIEMENT
// ================================================================

/**
 * POST /api/create-payment
 * Crée un paiement, génère la référence, enregistre en base
 */
app.post('/api/create-payment', async (req, res) => {
    const { name, email, amount } = req.body;

    console.log('\n' + '='.repeat(80));
    console.log('💳 CRÉATION D\'UN PAIEMENT');
    console.log('='.repeat(80));
    console.log(`   👤 Nom: ${name}`);
    console.log(`   📧 Email: ${email}`);
    console.log(`   💰 Montant: ${amount} FCFA`);

    if (!name || !email || !amount) {
        return res.status(400).json({ error: 'Nom, email et montant requis' });
    }

    if (amount < 1) {
        return res.status(400).json({ error: 'Le montant minimum est de 1 FCFA' });
    }

    try {
        // 1️⃣ Récupérer ou créer l'utilisateur
        const user = await db.getOrCreateUser(name, email);
        if (user.status !== 'visiteur' && user.status !== 'participant') {
            await db.updateUserStatus(email, 'participant');
        }
        console.log(`   ✅ Utilisateur: ${user.name} (${user.status})`);

        // 2️⃣ Générer la référence
        const reference = `VM-${email}-${Date.now()}`;
        console.log(`   🔗 Référence: ${reference}`);

        // 3️⃣ Créer la commande (orders)
        const order = await db.createOrder({
            reference,
            user_id: user.id,
            email,
            name,
            amount,
            status: 'pending'
        });

        if (!order) {
            throw new Error('Erreur création commande');
        }
        console.log(`   ✅ Commande créée (ID: ${order.id})`);

        // 4️⃣ Mettre à jour le statut utilisateur → participant
        await db.updateUserStatus(email, 'participant');
        console.log(`   ✅ Statut mis à jour: participant`);

        // 5️⃣ Appel API Jèko
        const amountInCentimes = Math.round(amount * 100);
        console.log(`   💰 Montant: ${amount} FCFA → ${amountInCentimes} centimes`);

        const requestBody = {
            storeId: process.env.JEKO_BUSINESS_ID,
            title: `Donation - ${name}`,
            amountCents: amountInCentimes,
            currency: 'XOF',
            reference: reference,
            email: email,
            customerId: name,
            description: `Donation de ${name} (${email}) - ${amount} FCFA`,
            paymentDetails: {
                type: 'redirect',
                data: {
                    paymentMethod: 'wave',
                    successUrl: 'https://virtmarket-test.onrender.com/verify',
                    errorUrl: 'https://virtmarket-test.onrender.com/virtmak.html'
                }
            }
        };

        const response = await fetch('https://api.jeko.africa/partner_api/payment_requests', {
            method: 'POST',
            headers: {
                'X-API-KEY': process.env.JEKO_API_KEY,
                'X-API-KEY-ID': process.env.JEKO_API_KEY_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('   ❌ Erreur Jèko:', data);
            return res.status(response.status).json({
                error: data.message || 'Erreur API Jèko',
                details: data
            });
        }

        if (!data.redirectUrl) {
            throw new Error('Aucune URL de paiement reçue');
        }

        // 6️⃣ Mettre à jour le payment_link_id
        if (data.id) {
            await db.updateOrderPaymentLink(reference, data.id);
            console.log(`   ✅ Payment Link ID: ${data.id}`);
        }

        console.log(`   ✅ URL: ${data.redirectUrl}`);
        console.log('='.repeat(80) + '\n');

        res.json({
            success: true,
            checkout_url: data.redirectUrl,
            reference: reference,
            order_id: order.id
        });

    } catch (error) {
        console.error('❌ Erreur création paiement:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// 7. API : PAYLIST (commandes de paiement)
// ================================================================

/**
 * GET /api/paylist
 * Liste toutes les commandes de paiement
 */
app.get('/api/paylist', async (req, res) => {
    try {
        const orders = await db.getAllOrders();
        res.json({ success: true, count: orders.length, orders });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/paylist/:reference
 * Détail d'une commande par référence
 */
app.get('/api/paylist/:reference', async (req, res) => {
    const { reference } = req.params;
    try {
        const order = await db.getOrderByReference(reference);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Commande non trouvée' });
        }
        res.json({ success: true, order });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// 8. API : PAIEMENTS CONFIRMÉS
// ================================================================

/**
 * GET /api/payments
 * Liste tous les paiements confirmés
 */
app.get('/api/payments', async (req, res) => {
    try {
        const payments = await db.getAllPayments();
        res.json({ success: true, count: payments.length, payments });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/payment/:id
 * Détail d'un paiement par ID
 */
app.get('/api/payment/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const payment = await db.getPaymentById(parseInt(id));
        if (!payment) {
            return res.status(404).json({ success: false, error: 'Paiement non trouvé' });
        }
        res.json({ success: true, payment });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// 9. API : UTILISATEURS
// ================================================================

/**
 * GET /api/users
 * Liste tous les utilisateurs
 */
app.get('/api/users', async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.json({ success: true, count: users.length, users });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/user/:email
 * Détail d'un utilisateur par email + envoi email de remerciement
 */
app.get('/api/user/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const user = await db.getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
        }
        res.json({ success: true, user });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// 10. API : STATISTIQUES
// ================================================================

/**
 * GET /api/stats
 * Statistiques globales pour l'admin
 */
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await db.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// 11. API : UPDATE STATUS (manuel)
// ================================================================

/**
 * POST /api/update-status
 * Mise à jour manuelle du statut utilisateur
 */
app.post('/api/update-status', async (req, res) => {
    const { email, status } = req.body;

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
        console.log(`✅ Statut mis à jour: ${email} → ${status}`);
        res.json({ success: true, user });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// 12. WEBHOOK JEKO
// ================================================================

/**
 * POST /webhook
 * Réception du webhook Jèko
 */
app.post('/webhook', async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log('🔔 WEBHOOK REÇU');
    console.log('='.repeat(80));

    try {
        // 1️⃣ Vérifier la signature
        const signature = req.headers['jeko-signature'];
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', process.env.JEKO_WEBHOOK_SECRET)
            .update(payload)
            .digest('hex');

        if (!signature || signature !== expectedSignature) {
            console.log('❌ Signature invalide');
            return res.status(401).send('Invalid signature');
        }
        console.log('✅ Signature valide');

        // 2️⃣ Extraire les données
        const body = req.body;
        console.log('📦 Webhook reçu');

        const reference = body.transactionDetails?.reference || body.reference || null;
        console.log(`🔗 Référence: ${reference || 'NON FOURNIE'}`);

        if (!reference) {
            console.log('❌ Référence manquante');
            return res.status(400).send('Reference not found');
        }

        // 3️⃣ Chercher la commande
        console.log('🔍 Recherche de la commande...');
        const order = await db.getOrderByReference(reference);

        if (!order) {
            console.log(`❌ Commande non trouvée: ${reference}`);
            return res.status(404).send('Order not found');
        }

        console.log(`✅ Commande trouvée: ID ${order.id}, statut: ${order.status}`);

        // 4️⃣ Vérifier si déjà traité
        if (order.status === 'success') {
            console.log('ℹ️ Déjà traité, ignoré');
            return res.sendStatus(200);
        }

        // 5️⃣ Mettre à jour la commande
        console.log('💾 Mise à jour de la commande...');
        const updatedOrder = await db.updateOrderStatus(reference, 'success', body.id);
        console.log(`✅ Commande mise à jour: ${reference} → success`);

        // 6️⃣ Mettre à jour l'utilisateur
        console.log('👤 Mise à jour de l\'utilisateur...');
        const user = await db.updateUserStatus(order.email, 'donateur');
        if (user) {
            console.log(`✅ Utilisateur mis à jour: ${order.email} → donateur`);
        }

        // 7️⃣ Enregistrer le paiement
        console.log('💾 Enregistrement du paiement...');
        const paymentData = {
            transaction_id: body.id,
            user_id: order.user_id,
            amount: body.amount?.amount || order.amount,
            currency: body.amount?.currency || 'XOF',
            status: 'success',
            payment_method: body.paymentMethod || 'wave',
            counterpart_phone: body.counterpartLabel || null,
            store_id: body.storeId || null,
            store_name: body.storeName || null,
            payment_link_id: body.transactionDetails?.paymentLinkId || null,
            reference: reference,
            executed_at: body.executedAt || null
        };
        const savedPayment = await db.savePayment(paymentData);
        console.log(`✅ Paiement enregistré: ${savedPayment ? 'OK' : 'Déjà existant'}`);

        // 8️⃣ RÉSUMÉ
        console.log('\n📋 RÉSUMÉ:');
        console.log('   ✅ Signature: OK');
        console.log('   ✅ Commande: pending → success');
        console.log(`   ✅ Utilisateur: ${order.email} → donateur`);
        console.log(`   ✅ Paiement: ${savedPayment ? 'OK' : 'Déjà existant'}`);
        console.log('='.repeat(80) + '\n');

        res.sendStatus(200);

    } catch (error) {
        console.error('❌ Erreur webhook:', error);
        res.sendStatus(500);
    }
});

// ================================================================
// 13. DÉMARRAGE
// ================================================================

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`🌐 https://virtmarket-test.onrender.com`);
    console.log(`📊 Admin: /admin`);
    console.log(`\n📋 API disponibles:`);
    console.log(`   POST /api/visiteur`);
    console.log(`   POST /api/create-payment`);
    console.log(`   GET  /api/paylist`);
    console.log(`   GET  /api/paylist/:reference`);
    console.log(`   GET  /api/payments`);
    console.log(`   GET  /api/payment/:id`);
    console.log(`   GET  /api/users`);
    console.log(`   GET  /api/user/:email`);
    console.log(`   GET  /api/stats`);
    console.log(`   POST /api/update-status`);
    console.log(`   POST /webhook`);
});