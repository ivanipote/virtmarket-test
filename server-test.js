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
        const count = await db.cleanPendingPaymentsOld();
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
        if (user.flex5 !== 'visiteur') {
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
// ROUTE : CRÉER UNE COMMANDE (avec stockage en base)
// ============================================================
app.post('/api/create-order', async (req, res) => {
    const { name, email, amount } = req.body;

    console.log('\n' + '='.repeat(80));
    console.log('📝 CRÉATION D\'UNE COMMANDE');
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
        // ===== 1️⃣ ENREGISTRER L'UTILISATEUR (visiteur) =====
        const user = await db.getOrCreateUser(name, email);
        if (user.flex5 !== 'visiteur') {
            await db.updateUserStatus(email, 'visiteur');
        }
        console.log(`   ✅ Utilisateur enregistré: ${name} (${email}) - visiteur`);

        // ===== 2️⃣ CRÉER LA RÉFÉRENCE UNIQUE =====
        const reference = `VM-${email}-${Date.now()}`;
        console.log(`   🔗 Référence générée: ${reference}`);

        // ===== 3️⃣ STOCKER EN BASE (pending) =====
        const pending = await db.createPendingPayment({
            reference,
            email,
            name,
            amount: amount,
            status: 'pending'
        });

        if (!pending) {
            throw new Error('Erreur lors de la création de la commande en base');
        }
        console.log(`   ✅ Commande enregistrée en base (ID: ${pending.id}) - statut: pending`);

        // ===== 4️⃣ METTRE À JOUR LE STATUT UTILISATEUR (participant) =====
        await db.updateUserStatus(email, 'participant');
        console.log(`   ✅ Statut mis à jour: ${email} → participant`);

        // ===== 5️⃣ CRÉER LE LIEN DE PAIEMENT JEKO =====
        const amountInCentimes = Math.round(amount * 100);
        console.log(`   💰 Montant: ${amount} FCFA → ${amountInCentimes} centimes`);

        const response = await fetch('https://api.jeko.africa/partner_api/payment_requests', {
            method: 'POST',
            headers: {
                'X-API-KEY': process.env.JEKO_API_KEY,
                'X-API-KEY-ID': process.env.JEKO_API_KEY_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                storeId: process.env.JEKO_BUSINESS_ID,
                title: `Commande - ${name}`,
                amountCents: amountInCentimes,
                currency: 'XOF',
                reference: reference,
                email: email,
                customerId: name,
                description: `Commande de ${name} (${email}) - ${amount} FCFA`,
                paymentDetails: {
                    type: 'redirect',
                    data: {
                        paymentMethod: 'wave',
                        successUrl: 'https://virtmarket-test.onrender.com/verify',
                        errorUrl: 'https://virtmarket-test.onrender.com/virtmak.html'
                    }
                }
            })
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
            console.error('   ❌ Aucune URL de redirection reçue');
            return res.status(500).json({ error: 'Aucune URL de paiement reçue' });
        }

        // ===== 6️⃣ METTRE À JOUR LE PAYMENT_LINK_ID =====
        if (data.id) {
            await db.updatePendingPaymentLinkId(reference, data.id);
            console.log(`   ✅ Payment Link ID: ${data.id}`);
        }

        console.log(`   ✅ URL de redirection générée: ${data.redirectUrl}`);
        console.log('='.repeat(80) + '\n');

        res.json({
            success: true,
            checkout_url: data.redirectUrl,
            reference: reference,
            payment_id: pending.id
        });

    } catch (error) {
        console.error('❌ Erreur création commande:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ROUTE : METTRE À JOUR LE STATUT UTILISATEUR
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
// ROUTE : CRÉER UN LIEN DE PAIEMENT JEKO - VERSION PRINCIPALE
// ============================================================
app.post('/create-payment-link', async (req, res) => {
    const { name, email, amount, reference } = req.body;

    console.log('\n' + '='.repeat(80));
    console.log('💳 CRÉATION D\'UN LIEN DE PAIEMENT');
    console.log('='.repeat(80));
    console.log(`   👤 Nom: ${name}`);
    console.log(`   📧 Email: ${email}`);
    console.log(`   💰 Montant: ${amount} FCFA`);
    console.log(`   🔗 Référence reçue: ${reference || 'NON FOURNIE'}`);

    if (!name || !email || !amount) {
        return res.status(400).json({ error: 'Nom, email et montant requis' });
    }

    if (amount < 1) {
        return res.status(400).json({ error: 'Le montant minimum est de 1 FCFA' });
    }

    // ✅ Utiliser la référence reçue ou en créer une nouvelle
    const finalReference = reference || `VM-${email}-${Date.now()}`;
    console.log(`   🔗 Référence finale: ${finalReference}`);

    const amountInCentimes = Math.round(amount * 100);
    console.log(`   💰 Montant: ${amount} FCFA → ${amountInCentimes} centimes`);

    try {
        // ✅ Construire la requête avec la référence
        const requestBody = {
            storeId: process.env.JEKO_BUSINESS_ID,
            title: `Commande - ${name}`,
            amountCents: amountInCentimes,
            currency: 'XOF',
            reference: finalReference,
            email: email,
            customerId: name,
            description: `Commande de ${name} (${email}) - ${amount} FCFA`,
            paymentDetails: {
                type: 'redirect',
                data: {
                    paymentMethod: 'wave',
                    successUrl: 'https://virtmarket-test.onrender.com/verify',
                    errorUrl: 'https://virtmarket-test.onrender.com/virtmak.html'
                }
            }
        };

        console.log(`\n📤 REQUÊTE ENVOYÉE À JÈKO:`);
        console.log('-'.repeat(40));
        console.log(JSON.stringify(requestBody, null, 2));

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
            console.error('❌ Erreur Jèko:', data);
            return res.status(response.status).json({
                error: data.message || 'Erreur API Jèko',
                details: data
            });
        }

        // ============================================================
        // 📋 AFFICHER TOUTES LES INFOS RETOURNÉES PAR JÈKO
        // ============================================================
        console.log(`\n📥 RÉPONSE COMPLÈTE DE JÈKO:`);
        console.log('-'.repeat(40));
        console.log(JSON.stringify(data, null, 2));

        console.log(`\n📊 DÉTAILS DU PAIEMENT GÉNÉRÉ:`);
        console.log('-'.repeat(40));
        console.log(`   🆔 ID du lien: ${data.id || 'N/A'}`);
        console.log(`   🔗 Référence: ${data.reference || 'N/A'}`);
        console.log(`   💰 Montant: ${data.amountCents ? data.amountCents / 100 : amount} FCFA`);
        console.log(`   📊 Statut: ${data.status || 'pending'}`);
        console.log(`   📅 Créé le: ${data.createdAt || 'N/A'}`);
        console.log(`   🔗 URL de paiement: ${data.redirectUrl || 'N/A'}`);
        console.log(`   🏪 Store: ${data.storeName || 'N/A'}`);
        console.log(`   📧 Email: ${data.email || 'N/A'}`);
        console.log(`   🆔 Customer ID: ${data.customerId || 'N/A'}`);
        console.log(`   📝 Description: ${data.description || 'N/A'}`);

        // Vérifier si data.redirectUrl existe
        if (!data.redirectUrl) {
            console.error('❌ Aucune URL de redirection reçue');
            return res.status(500).json({ error: 'Aucune URL de paiement reçue' });
        }

        console.log(`\n✅ URL de redirection générée: ${data.redirectUrl}`);
        console.log('='.repeat(80) + '\n');

        // ✅ Retourner la réponse
        res.json({ 
            checkout_url: data.redirectUrl,
            payment_id: data.id,
            reference: data.reference || finalReference
        });

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ROUTE : RÉCUPÉRER LES UTILISATEURS
// ============================================================
app.get('/api/users', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, count: result.rows.length, users: result.rows });
    } catch (error) {
        console.error('❌ Erreur récupération utilisateurs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ROUTE : RÉCUPÉRER TOUS LES PAIEMENTS
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
// ROUTE : RÉCUPÉRER TOUTES LES COMMANDES (pending_payments)
// ============================================================
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await db.getPendingPayments();
        res.json({ success: true, count: orders.length, orders });
    } catch (error) {
        console.error('❌ Erreur récupération commandes:', error);
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
// WEBHOOK JEKO - AVEC STOCKAGE EN BASE
// ============================================================
app.post('/webhook', async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log('🔔 WEBHOOK REÇU');
    console.log('='.repeat(80));

    try {
        // ===== 1️⃣ VÉRIFIER LA SIGNATURE =====
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

        // ===== 2️⃣ AFFICHER LE CORPS DU WEBHOOK =====
        console.log('\n📦 CORPS DU WEBHOOK:');
        console.log('-'.repeat(40));
        console.log(JSON.stringify(req.body, null, 2));

        const body = req.body;

        // ===== 3️⃣ EXTRAIRE LA RÉFÉRENCE =====
        const reference = body.transactionDetails?.reference || body.reference || null;
        console.log(`\n🔗 Référence reçue: ${reference || 'NON FOURNIE'}`);

        if (!reference) {
            console.log('❌ Aucune référence trouvée dans le webhook');
            return res.status(400).send('Reference not found');
        }

        // ===== 4️⃣ CHERCHER LA COMMANDE EN BASE =====
        console.log('\n🔍 Recherche de la commande en base...');
        const pending = await db.getPendingPaymentByReference(reference);

        if (!pending) {
            console.log(`❌ Commande non trouvée pour la référence: ${reference}`);
            return res.status(404).send('Order not found');
        }

        console.log(`✅ Commande trouvée:`);
        console.log(`   - ID: ${pending.id}`);
        console.log(`   - Email: ${pending.email}`);
        console.log(`   - Nom: ${pending.name}`);
        console.log(`   - Montant: ${pending.amount} FCFA`);
        console.log(`   - Statut actuel: ${pending.status}`);

        // ===== 5️⃣ VÉRIFIER SI DÉJÀ TRAITÉ =====
        if (pending.status === 'success') {
            console.log(`ℹ️ Commande déjà traitée (success) - Ignoré`);
            return res.sendStatus(200);
        }

        // ===== 6️⃣ METTRE À JOUR LE STATUT DE LA COMMANDE =====
        console.log('\n💾 Mise à jour de la commande...');
        const updated = await db.updatePendingPaymentStatus(
            reference,
            'success',
            body.id
        );

        if (updated) {
            console.log(`✅ Commande mise à jour: ${reference} → success`);
            console.log(`   - Transaction ID: ${body.id}`);
        } else {
            console.log(`❌ Erreur lors de la mise à jour de la commande`);
        }

        // ===== 7️⃣ METTRE À JOUR LE STATUT DE L'UTILISATEUR =====
        console.log('\n👤 Mise à jour du statut utilisateur...');
        
        if (pending.email) {
            const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [pending.email]);
            
            if (userCheck.rows.length > 0) {
                console.log(`   ✅ Utilisateur trouvé: ${userCheck.rows[0].name}`);
                await db.updateUserStatus(pending.email, 'donateur');
                console.log(`   ✅ Statut mis à jour: ${pending.email} → donateur`);
            } else {
                console.log(`   ⚠️ Utilisateur non trouvé, création...`);
                const newUser = await db.getOrCreateUser(pending.name, pending.email);
                if (newUser) {
                    await db.updateUserStatus(pending.email, 'donateur');
                    console.log(`   ✅ Nouvel utilisateur créé: ${pending.email} → donateur`);
                }
            }
        }

        // ===== 8️⃣ ENREGISTRER LE PAIEMENT DANS payments_jeko =====
        console.log('\n💾 Enregistrement du paiement dans payments_jeko...');
        body.flex1 = pending.name;
        body.flex2 = pending.email;
        body.flex5 = 'donateur';
        
        const savedId = await db.saveJekoPayment(body);
        if (savedId) {
            console.log(`   ✅ Paiement enregistré en base (ID: ${savedId})`);
        } else {
            console.log(`   ℹ️ Paiement déjà existant ou erreur`);
        }

        // ===== 9️⃣ RÉSUMÉ FINAL =====
        console.log('\n📋 RÉSUMÉ DU TRAITEMENT:');
        console.log('-'.repeat(40));
        console.log(`   ✅ Signature: OK`);
        console.log(`   ✅ Commande trouvée: ${pending.id}`);
        console.log(`   ✅ Statut commande: pending → success`);
        console.log(`   ✅ Utilisateur: ${pending.email} → donateur`);
        console.log(`   ✅ Paiement enregistré: ${savedId ? 'OK' : 'Déjà existant'}`);
        console.log('='.repeat(80) + '\n');

        res.sendStatus(200);

    } catch (error) {
        console.error('\n❌ ERREUR WEBHOOK:');
        console.error('-'.repeat(40));
        console.error(error);
        console.error('='.repeat(80) + '\n');
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
    console.log(`📋 API Payments: https://virtmarket-test.onrender.com/api/payments`);
    console.log(`📋 API Orders: https://virtmarket-test.onrender.com/api/orders`);
    console.log(`👥 API Users: https://virtmarket-test.onrender.com/api/users`);
});