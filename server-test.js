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
// ROUTE : CRÉER UN LIEN DE PAIEMENT JEKO (API)
// ============================================================
app.post('/create-payment-link', async (req, res) => {
    const { name, email, amount } = req.body;

    // ✅ Convertir le montant en centimes (minimum 100 = 1 FCFA)
    const amountInCentimes = Math.round(amount * 100);

    console.log(`📝 Création d'une demande de paiement pour ${name} (${email})`);
    console.log(`💰 Montant: ${amount} FCFA → ${amountInCentimes} centimes`);

    try {
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
                reference: `VM-${Date.now()}`,
                email: email,                    // ✅ Champ personnalisé
                customerId: `user_${Date.now()}`, // ✅ Champ personnalisé
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
            console.error('❌ Erreur Jèko:', data);
            return res.status(response.status).json({ 
                error: data.message || 'Erreur API Jèko',
                details: data
            });
        }

        if (!data.redirectUrl) {
            console.error('❌ Aucune URL de redirection reçue:', data);
            return res.status(500).json({ error: 'Aucune URL de paiement reçue' });
        }

        console.log(`✅ URL de redirection générée : ${data.redirectUrl}`);
        res.json({ checkout_url: data.redirectUrl });

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
// WEBHOOK JEKO - AVEC LOGS DÉTAILLÉS
// ============================================================
app.post('/webhook', async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log('🔔 WEBHOOK REÇU');
    console.log('='.repeat(80));

    try {
        // ===== 1️⃣ AFFICHER TOUS LES HEADERS =====
        console.log('\n📋 HEADERS REÇUS:');
        console.log('-'.repeat(40));
        const headers = req.headers;
        Object.keys(headers).forEach(key => {
            if (key.startsWith('jeko-')) {
                console.log(`   ${key}: ${headers[key]}`);
            }
        });
        console.log('   content-type:', headers['content-type']);
        console.log('   user-agent:', headers['user-agent']);
        console.log('   content-length:', headers['content-length']);

        // ===== 2️⃣ VÉRIFIER LA SIGNATURE =====
        const signature = req.headers['jeko-signature'];
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', process.env.JEKO_WEBHOOK_SECRET)
            .update(payload)
            .digest('hex');

        if (!signature || signature !== expectedSignature) {
            console.log('❌ Signature invalide !');
            console.log(`   Reçu: ${signature}`);
            console.log(`   Attendu: ${expectedSignature}`);
            return res.status(401).send('Invalid signature');
        }

        console.log('✅ Signature valide');

        // ===== 3️⃣ AFFICHER TOUT LE CORPS DU WEBHOOK =====
        console.log('\n📦 CORPS DU WEBHOOK (COMPLET):');
        console.log('-'.repeat(40));
        console.log(JSON.stringify(req.body, null, 2));

        // ===== 4️⃣ EXTRAIRE TOUTES LES INFOS IMPORTANTES =====
        console.log('\n📊 INFORMATIONS EXTRAITES:');
        console.log('-'.repeat(40));

        const body = req.body;

        // ID Transaction
        const transactionId = body.id || 'N/A';
        console.log(`   🆔 Transaction ID: ${transactionId}`);

        // Montant
        const amount = body.amount?.amount || 'N/A';
        const currency = body.amount?.currency || 'XOF';
        console.log(`   💰 Montant: ${amount} ${currency} (${amount/100} FCFA)`);

        // Statut
        const status = body.status || 'N/A';
        console.log(`   📊 Statut: ${status}`);

        // Méthode de paiement
        const paymentMethod = body.paymentMethod || 'N/A';
        console.log(`   💳 Méthode: ${paymentMethod}`);

        // Téléphone du payeur
        const counterpartLabel = body.counterpartLabel || 'N/A';
        console.log(`   📱 Téléphone: ${counterpartLabel}`);

        // === CHAMPS PERSONNALISÉS ===
        const email = body.email || body.flex2 || null;
        console.log(`   📧 Email (champ personnalisé): ${email || 'NON FOURNI'}`);

        const customerId = body.customerId || body.flex1 || null;
        console.log(`   🆔 Customer ID: ${customerId || 'NON FOURNI'}`);

        const title = body.title || 'N/A';
        console.log(`   📝 Titre: ${title}`);

        const description = body.description || 'N/A';
        console.log(`   📄 Description: ${description}`);

        // Reference
        const reference = body.transactionDetails?.reference || body.reference || 'N/A';
        console.log(`   🔗 Référence: ${reference}`);

        // Payment Link ID
        const paymentLinkId = body.transactionDetails?.paymentLinkId || body.paymentLinkId || 'N/A';
        console.log(`   🔗 Payment Link ID: ${paymentLinkId}`);

        // Date d'exécution
        const executedAt = body.executedAt || 'N/A';
        console.log(`   📅 Exécuté le: ${executedAt}`);

        // Store
        const storeName = body.storeName || 'N/A';
        const storeId = body.storeId || 'N/A';
        console.log(`   🏪 Store: ${storeName} (${storeId})`);

        // Wallet balance
        const walletBalance = body.walletAvailableBalance?.amount || 'N/A';
        console.log(`   💰 Solde wallet: ${walletBalance} ${currency}`);

        // ===== 5️⃣ ENREGISTRER LE PAIEMENT EN BASE =====
        console.log('\n💾 ENREGISTREMENT EN BASE:');
        console.log('-'.repeat(40));

        // Ajouter les champs personnalisés pour la base
        body.flex1 = customerId || null;
        body.flex2 = email || null;
        body.flex5 = 'donateur';

        const savedId = await db.saveJekoPayment(body);

        if (savedId) {
            console.log(`   ✅ Paiement enregistré en base (ID: ${savedId})`);
        } else {
            console.log(`   ℹ️ Paiement déjà existant ou erreur`);
        }

        // ===== 6️⃣ METTRE À JOUR LE STATUT UTILISATEUR =====
        console.log('\n👤 MISE À JOUR STATUT UTILISATEUR:');
        console.log('-'.repeat(40));

        if (email) {
            console.log(`   📧 Email trouvé: ${email}`);
            
            // Vérifier si l'utilisateur existe
            const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            
            if (userCheck.rows.length > 0) {
                console.log(`   ✅ Utilisateur trouvé: ${userCheck.rows[0].name}`);
                
                // Mettre à jour le statut vers donateur
                const updated = await db.updateUserStatus(email, 'donateur');
                
                if (updated) {
                    console.log(`   ✅ Statut mis à jour: ${email} → donateur`);
                } else {
                    console.log(`   ❌ Erreur lors de la mise à jour du statut`);
                }
            } else {
                console.log(`   ⚠️ Utilisateur non trouvé pour l'email: ${email}`);
                console.log(`   💡 Création d'un nouvel utilisateur...`);
                
                // Créer l'utilisateur s'il n'existe pas
                const newUser = await db.getOrCreateUser(
                    title?.replace('Commande - ', '') || 'Donateur',
                    email
                );
                
                if (newUser) {
                    console.log(`   ✅ Nouvel utilisateur créé: ${newUser.name}`);
                    await db.updateUserStatus(email, 'donateur');
                    console.log(`   ✅ Statut mis à jour: ${email} → donateur`);
                }
            }
        } else {
            console.log(`   ⚠️ Aucun email trouvé dans le webhook !`);
            console.log(`   💡 Impossible de mettre à jour le statut utilisateur`);
        }

        // ===== 7️⃣ RÉSUMÉ FINAL =====
        console.log('\n📋 RÉSUMÉ DU TRAITEMENT:');
        console.log('-'.repeat(40));
        console.log(`   ✅ Signature: OK`);
        console.log(`   ✅ Paiement: ${status}`);
        console.log(`   ✅ Enregistrement: ${savedId ? 'OK' : 'Déjà existant'}`);
        console.log(`   ✅ Statut utilisateur: ${email ? 'Mise à jour effectuée' : 'Non disponible'}`);
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
    console.log(`👥 API Users: https://virtmarket-test.onrender.com/api/users`);
});