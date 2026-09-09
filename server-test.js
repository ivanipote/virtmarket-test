// ================================================================
// FICHIER : server-test.js
// DESCRIPTION : Serveur principal - Virtual Market
// VERSION : 6.6 - Correction des méthodes de paiement Jèko
// ================================================================

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const db = require('./database');
const sgMail = require('@sendgrid/mail');

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
// 3. CONFIGURATION SENDGRID
// ================================================================

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDER_EMAIL = process.env.SENDGRID_MAIL || 'ipoteivan23@gmail.com';
const SENDER_NAME = 'VirtMak';

if (!SENDGRID_API_KEY) {
    console.warn('⚠️ SENDGRID_API_KEY non définie');
} else {
    console.log('✅ SendGrid API Key configurée');
}
if (!SENDER_EMAIL) {
    console.warn('⚠️ SENDGRID_MAIL non définie');
} else {
    console.log(`✅ Email expéditeur: ${SENDER_EMAIL}`);
}

sgMail.setApiKey(SENDGRID_API_KEY);

// ================================================================
// 4. FONCTION : ENVOI EMAIL
// ================================================================

async function sendThankYouEmail(email, name, amount, orderId) {
    try {
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR') + ' ' + 
                        now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        console.log(`📧 Envoi email à ${email} via SendGrid...`);

        const htmlContent = `
            <div style="font-family: 'Segoe UI', system-ui, sans-serif; max-width: 600px; margin: auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e6e8ef; padding: 0;">
                <div style="text-align: center; padding: 24px 20px 8px 20px; background: white;">
                    <div style="font-size: 32px; margin-bottom: 4px;">🙏</div>
                    <div style="font-size: 18px; font-weight: 700; color: #0F1B4D; border-bottom: 2px solid #156FE6; padding-bottom: 12px;">
                        Merci pour votre don
                    </div>
                </div>
                <div style="padding: 0 24px 24px 24px;">
                    <p style="font-size: 15px; font-weight: 600; color: #0F1B4D; margin-bottom: 4px;">
                        Bonjour <span style="color: #156FE6;">${name}</span>,
                    </p>
                    <p style="font-size: 13px; color: #1a1a2e; line-height: 1.6; margin: 6px 0 14px 0;">
                        <strong>Nous vous remercions !!!</strong><br>
                        Votre don de <strong style="color: #156FE6;">${amount} FCFA</strong> nous aide à construire une plateforme ivoirienne innovante et sécurisée.
                    </p>
                    <div style="background: #f8f9fc; border-radius: 12px; padding: 12px 16px; border: 1px solid #e6e8ef; margin: 8px 0 14px 0;">
                        <div style="font-size: 12px; font-weight: 700; color: #0F1B4D; border-bottom: 1px solid #e6e8ef; padding-bottom: 6px; margin-bottom: 6px;">
                            📋 Récapitulatif du don
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px;">
                            <span style="color: #6b7280;">👤 Donateur</span>
                            <span style="font-weight: 600; color: #0F1B4D;">${name}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px;">
                            <span style="color: #6b7280;">📧 Email</span>
                            <span style="font-weight: 600; color: #0F1B4D;">${email}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px;">
                            <span style="color: #6b7280;">💰 Montant</span>
                            <span style="font-weight: 800; color: #156FE6; font-size: 15px;">${amount} FCFA</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px;">
                            <span style="color: #6b7280;">📅 Date et heure</span>
                            <span style="font-weight: 600; color: #0F1B4D;">${dateStr}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; border-bottom: none;">
                            <span style="color: #6b7280;">🔗 Référence</span>
                            <span style="font-weight: 600; color: #0F1B4D;">${orderId}</span>
                        </div>
                    </div>
                    <div style="text-align: center; padding-top: 12px; border-top: 2px solid #f0f2f5; font-size: 12px; color: #6b7280;">
                        <div style="font-weight: 600; color: #0F1B4D;">Avec toute notre gratitude,</div>
                        <div>L'équipe <strong style="color: #156FE6;">VirtMak</strong></div>
                        <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">
                            🔒 Cet email a été envoyé automatiquement.
                        </div>
                    </div>
                </div>
            </div>
        `;

        const msg = {
            to: email,
            from: {
                email: SENDER_EMAIL,
                name: SENDER_NAME
            },
            subject: `🙏 Merci pour votre don de ${amount} FCFA - VirtMak`,
            html: htmlContent
        };

        await sgMail.send(msg);
        console.log(`✅ Email envoyé à ${email}`);
        return { success: true, message: 'Email envoyé avec succès' };

    } catch (error) {
        console.error(`❌ Erreur SendGrid: ${error.message}`);
        if (error.response) {
            console.error(`   ${JSON.stringify(error.response.body)}`);
        }
        return { success: false, message: error.message };
    }
}

// ================================================================
// 5. FONCTION : RÉCUPÉRER LES UTILISATEURS AVEC STATUT ET TOTAL
// ================================================================

async function getUsersWithStatus() {
    const users = await db.getAllUsers();
    const result = [];

    for (const user of users) {
        const orders = await db.getOrdersByEmail(user.email);
        const payments = await db.getPaymentsByEmail(user.email);

        const successCount = payments.filter(p => p.status === 'success').length;
        const pendingCount = orders.filter(o => o.status === 'pending').length;

        const totalAmount = payments
            .filter(p => p.status === 'success')
            .reduce((sum, p) => sum + (p.amount / 100), 0);

        let status = 'visiteur';

        if (successCount >= 1) {
            status = 'donateur';
        } else if (pendingCount >= 1) {
            status = 'participant';
        }

        result.push({
            ...user,
            calculated_status: status,
            success_payments: successCount,
            total_amount: totalAmount,
            pending_orders: pendingCount,
            total_orders: orders.length
        });
    }

    return result;
}

// ================================================================
// 6. ROUTES PAGES STATIQUES
// ================================================================

app.get('/', (req, res) => res.sendFile(__dirname + '/virtmak.html'));
app.get('/virtmak.html', (req, res) => res.sendFile(__dirname + '/virtmak.html'));
app.get('/pay.html', (req, res) => res.sendFile(__dirname + '/pay.html'));
app.get('/admin', (req, res) => res.sendFile(__dirname + '/admin.html'));
app.get('/verify', (req, res) => res.sendFile(__dirname + '/verifypay.html'));
app.get('/payviaapi.html', (req, res) => res.sendFile(__dirname + '/payviaapi.html'));
app.get('/sendgrid-test.html', (req, res) => res.sendFile(__dirname + '/sendgrid-test.html'));
app.get('/testmail.html', (req, res) => res.sendFile(__dirname + '/testmail.html'));
app.get('/reset-data.html', (req, res) => res.sendFile(__dirname + '/reset-data.html'));

// ================================================================
// 7. ROUTE : TEST SENDGRID
// ================================================================

app.post('/api/test-email', async (req, res) => {
    const { email, name, amount } = req.body;

    console.log(`📧 Test SendGrid: ${email} (${name}, ${amount} FCFA)`);

    if (!email) {
        return res.status(400).json({ error: 'Email requis' });
    }

    try {
        const result = await sendThankYouEmail(email, name, amount, 'TEST-' + Date.now());

        if (result.success) {
            res.json({ success: true, message: 'Email envoyé' });
        } else {
            res.status(500).json({ error: result.message });
        }
    } catch (error) {
        console.error('❌ Erreur test:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// 8. API : VISITEUR
// ================================================================

app.post('/api/visiteur', async (req, res) => {
    const { name, email, amount } = req.body;

    console.log(`\n📝 ENREGISTREMENT VISITEUR`);
    console.log('='.repeat(40));
    console.log(`   👤 Nom: ${name}`);
    console.log(`   📧 Email: ${email}`);
    console.log(`   💰 Intention: ${amount} FCFA`);

    if (!name || !email || !amount) {
        return res.status(400).json({ error: 'Nom, email et montant requis' });
    }

    if (amount < 1) {
        return res.status(400).json({ error: 'Le montant minimum est de 1 FCFA' });
    }

    try {
        const existingUser = await db.getUserByEmail(email);

        let user;
        if (existingUser) {
            console.log(`   ℹ️ Utilisateur existant: ${existingUser.name} (email: ${email})`);
            console.log(`   ℹ️ Nom original conservé: ${existingUser.name}`);
            
            if (amount) {
                await db.query(
                    'UPDATE users SET flex3 = $1, updated_at = NOW() WHERE email = $2',
                    [String(amount), email]
                );
                existingUser.flex3 = String(amount);
            }
            user = existingUser;
            
            if (user.status !== 'visiteur') {
                await db.updateUserStatus(email, 'visiteur');
                user.status = 'visiteur';
            }
        } else {
            user = await db.getOrCreateUser(name, email, amount);
            console.log(`   ✅ Nouvel utilisateur créé: ${name}`);
        }

        console.log(`✅ Visiteur enregistré: ${email}`);
        console.log(`   👤 Nom conservé: ${user.name}`);
        console.log(`   💰 Intention: ${user.flex3 || amount} FCFA`);
        console.log('='.repeat(40) + '\n');

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                status: user.status || 'visiteur',
                intention: user.flex3 || amount
            }
        });

    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// ROUTE : ENVOYER UN REÇU PAR EMAIL
// ================================================================

app.post('/api/send-receipt', async (req, res) => {
    const { email, name, amount, reference, date, number } = req.body;

    console.log(`📧 Envoi du reçu à ${email}`);

    if (!email) {
        return res.status(400).json({ error: 'Email requis' });
    }

    try {
        // ✅ Générer le lien de téléchargement
        const downloadLink = `https://virtmarket-test.onrender.com/api/receipt/${reference}`;

        // ✅ Envoyer l'email avec le lien
        const msg = {
            to: email,
            from: {
                email: SENDER_EMAIL,
                name: SENDER_NAME
            },
            subject: `🧾 Votre reçu de paiement - ${reference}`,
            html: `
                <div style="font-family: 'Segoe UI', system-ui, sans-serif; max-width: 600px; margin: auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e6e8ef; padding: 20px;">
                    <div style="text-align: center; padding: 10px 0;">
                        <img src="https://virtmarket-test.onrender.com/logo.png" alt="VirtMak" style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid #156FE6; padding: 4px;" />
                        <div style="font-size: 20px; font-weight: 800; color: #0F1B4D;">Virt<span style="color:#156FE6;">Mak</span></div>
                    </div>
                    <h2 style="text-align:center;color:#0F1B4D;font-size:20px;">🧾 Votre reçu de paiement</h2>
                    <p style="font-size:15px;color:#0F1B4D;">Bonjour <strong>${name}</strong>,</p>
                    <p style="font-size:14px;color:#1a1a2e;">Votre paiement de <strong style="color:#156FE6;">${amount}</strong> a été confirmé.</p>
                    <div style="background:#f8f9fc;border-radius:12px;padding:12px 16px;border:1px solid #e6e8ef;margin:12px 0;">
                        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
                            <span style="color:#6b7280;">Numéro</span>
                            <span style="font-weight:600;">${number}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
                            <span style="color:#6b7280;">Date</span>
                            <span style="font-weight:600;">${date}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
                            <span style="color:#6b7280;">Montant</span>
                            <span style="font-weight:700;color:#156FE6;">${amount}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
                            <span style="color:#6b7280;">Référence</span>
                            <span style="font-weight:600;font-size:12px;">${reference}</span>
                        </div>
                    </div>
                    <div style="text-align:center;margin:16px 0;">
                        <a href="${downloadLink}" style="background:#156FE6;color:white;padding:12px 32px;border-radius:30px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
                            📄 Télécharger mon reçu
                        </a>
                    </div>
                    <div style="text-align:center;padding-top:12px;border-top:2px solid #f0f2f5;font-size:12px;color:#6b7280;">
                        Avec toute notre gratitude,<br>
                        L'équipe <strong style="color:#156FE6;">VirtMak</strong>
                    </div>
                </div>
            `
        };

        await sgMail.send(msg);
        console.log(`✅ Email envoyé à ${email}`);

        res.json({ success: true, message: 'Email envoyé avec succès' });

    } catch (error) {
        console.error('❌ Erreur envoi email:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// ROUTE : TÉLÉCHARGER LE REÇU EN PDF
// ================================================================

app.get('/api/receipt/:reference', async (req, res) => {
    const { reference } = req.params;

    console.log(`📄 Génération du reçu pour: ${reference}`);

    try {
        // ✅ Récupérer les infos du paiement
        const order = await db.getOrderByReference(reference);

        if (!order) {
            return res.status(404).json({ error: 'Commande non trouvée' });
        }

        // ✅ Récupérer le paiement associé
        const payment = await db.getPaymentByTransactionId(order.transaction_id);

        const name = order.name || 'Donateur';
        const email = order.email || 'email@non-renseigne.com';
        const amount = order.amount || 0;
        const date = order.updated_at ? new Date(order.updated_at).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR');
        const number = `REC-${reference.slice(-9)}`;
        const method = payment?.payment_method || order.flex4 || 'wave';
        const status = 'Paiement confirmé ✅';

        // ✅ Mapping des méthodes
        const methodLabels = {
            'wave': 'Wave',
            'orange': 'Orange Money',
            'mtn': 'MTN MoMo',
            'moov': 'Moov Money',
            'mtn_momo': 'MTN MoMo',
            'orange_money': 'Orange Money',
            'moov_money': 'Moov Money'
        };
        const methodName = methodLabels[method] || 'Wave';

        // ✅ Générer le HTML du reçu
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Reçu de paiement</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: white;
                    padding: 40px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }
                .recu {
                    max-width: 500px;
                    width: 100%;
                    background: white;
                    border-radius: 16px;
                    padding: 32px 28px;
                    border: 1px solid #e6e8ef;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
                }
                .recu-header { text-align: center; padding-bottom: 16px; border-bottom: 2px solid #156FE6; margin-bottom: 16px; }
                .recu-header .logo { width: 60px; height: 60px; border-radius: 50%; border: 3px solid #156FE6; padding: 4px; margin: 0 auto 8px auto; background: white; }
                .recu-header .logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 50%; display: block; }
                .recu-header .brand { font-size: 20px; font-weight: 800; color: #0F1B4D; }
                .recu-header .brand span { color: #156FE6; }
                .recu-header .tagline { font-size: 12px; color: #6b7280; }
                .recu-title { text-align: center; font-size: 18px; font-weight: 700; color: #0F1B4D; margin-bottom: 16px; padding: 6px 0; background: #f0f7ff; border-radius: 8px; letter-spacing: 2px; }
                .recu-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #f8f9fc; }
                .recu-row:last-child { border-bottom: none; }
                .recu-row .label { color: #6b7280; font-weight: 500; }
                .recu-row .value { font-weight: 600; color: #0F1B4D; text-align: right; }
                .recu-row .value.amount { color: #156FE6; font-size: 18px; font-weight: 800; }
                .recu-row .value .status-badge { display: inline-block; padding: 2px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background: #e6f7ee; color: #0e7a49; }
                .recu-footer { text-align: center; padding-top: 16px; border-top: 2px solid #f0f2f5; margin-top: 16px; font-size: 13px; color: #6b7280; }
                .recu-footer .thankyou { font-size: 16px; font-weight: 600; color: #0F1B4D; }
                .recu-footer .note { font-size: 11px; color: #9ca3af; margin-top: 4px; }
            </style>
        </head>
        <body>
            <div class="recu">
                <div class="recu-header">
                    <div class="logo"><img src="https://virtmarket-test.onrender.com/logo.png" alt="VirtMak" /></div>
                    <div class="brand">Virt<span>Mak</span></div>
                    <div class="tagline">e-commerce ivoirien</div>
                </div>
                <div class="recu-title">📋 REÇU DE PAIEMENT</div>
                <div class="recu-row"><span class="label">Numéro de reçu</span><span class="value">${number}</span></div>
                <div class="recu-row"><span class="label">Date et heure</span><span class="value">${date}</span></div>
                <div class="recu-row"><span class="label">Donateur</span><span class="value">${name}</span></div>
                <div class="recu-row"><span class="label">Email</span><span class="value">${email}</span></div>
                <div class="recu-row"><span class="label">Montant</span><span class="value amount">${amount} FCFA</span></div>
                <div class="recu-row"><span class="label">Méthode</span><span class="value">${methodName}</span></div>
                <div class="recu-row"><span class="label">Statut</span><span class="value"><span class="status-badge">✅ ${status}</span></span></div>
                <div class="recu-row"><span class="label">Référence</span><span class="value" style="font-size:12px;color:#6b7280;font-family:'Courier New',monospace;">${reference}</span></div>
                <div class="recu-footer">
                    <div class="thankyou">Merci pour votre soutien ! ❤️</div>
                    <div class="note">Ce reçu est généré automatiquement. Il fait office de preuve de paiement.</div>
                </div>
            </div>
        </body>
        </html>
        `;

        // ✅ Envoyer le HTML directement (pour l'instant)
        // Plus tard, on pourra utiliser html2pdf ou puppeteer pour générer un vrai PDF
        res.setHeader('Content-Type', 'text/html');
        res.send(html);

    } catch (error) {
        console.error('❌ Erreur génération reçu:', error);
        res.status(500).json({ error: error.message });
    }
});
// ================================================================
// 9. API : CRÉER UN PAIEMENT (avec mapping Jèko)
// ================================================================

app.post('/api/create-payment', async (req, res) => {
    const { name, email, amount, paymentMethod } = req.body;

    // ✅ Mapping des méthodes pour Jèko
    const methodMapping = {
        'wave': 'wave',
        'orange_money': 'orange',
        'mtn_momo': 'mtn',
        'moov_money': 'moov'
    };
    const jekoMethod = methodMapping[paymentMethod] || 'wave';

    console.log('\n' + '='.repeat(80));
    console.log('💳 CRÉATION D\'UN PAIEMENT');
    console.log('='.repeat(80));
    console.log(`   👤 Nom: ${name}`);
    console.log(`   📧 Email: ${email}`);
    console.log(`   💰 Montant: ${amount} FCFA`);
    console.log(`   💳 Méthode choisie: ${paymentMethod || 'wave'}`);
    console.log(`   💳 Méthode Jèko: ${jekoMethod}`);

    if (!name || !email || !amount) {
        return res.status(400).json({ error: 'Nom, email et montant requis' });
    }

    if (amount < 1) {
        return res.status(400).json({ error: 'Le montant minimum est de 1 FCFA' });
    }

    try {
        const user = await db.getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé. Veuillez d\'abord vous inscrire.' });
        }
        
        const originalName = user.name;
        console.log(`   ✅ Utilisateur: ${originalName} (${user.status})`);
        console.log(`   ℹ️ Nom original conservé: ${originalName}`);
        console.log(`   💰 Intention initiale: ${user.flex3 || 'Non renseignée'} FCFA`);

        const reference = `VM-${email}-${Date.now()}`;
        console.log(`   🔗 Référence: ${reference}`);

        // ✅ Créer la commande avec la méthode
        const order = await db.createOrder({
            reference,
            user_id: user.id,
            email,
            name: originalName,
            amount,
            status: 'pending',
            flex4: paymentMethod || 'wave'
        });

        if (!order) {
            throw new Error('Erreur création commande');
        }
        console.log(`   ✅ Commande créée (ID: ${order.id})`);
        console.log(`   💳 Méthode enregistrée: ${paymentMethod || 'wave'}`);

        await db.updateUserStatus(email, 'participant');
        console.log(`   ✅ Statut mis à jour: participant`);

        const amountInCentimes = Math.round(amount * 100);
        console.log(`   💰 Montant: ${amount} FCFA → ${amountInCentimes} centimes`);

        // ✅ Requête Jèko avec la méthode mappée
        const requestBody = {
            storeId: process.env.JEKO_BUSINESS_ID,
            title: `Donation - ${originalName}`,
            amountCents: amountInCentimes,
            currency: 'XOF',
            reference: reference,
            email: email,
            customerId: originalName,
            description: `Donation de ${originalName} (${email}) - ${amount} FCFA`,
            paymentDetails: {
                type: 'redirect',
                data: {
                    paymentMethod: jekoMethod,  // ✅ Utiliser la valeur Jèko
                    successUrl: 'https://virtmarket-test.onrender.com/verify',
                    errorUrl: 'https://virtmarket-test.onrender.com/virtmak.html'
                }
            }
        };

        console.log(`\n📤 REQUÊTE JÈKO:`);
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
            console.error('   ❌ Erreur Jèko:', data);
            return res.status(response.status).json({
                error: data.message || 'Erreur API Jèko',
                details: data
            });
        }

        if (!data.redirectUrl) {
            throw new Error('Aucune URL de paiement reçue');
        }

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
            order_id: order.id,
            payment_method: paymentMethod || 'wave'
        });

    } catch (error) {
        console.error('❌ Erreur création paiement:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// 10. API : PAYLIST
// ================================================================

app.get('/api/paylist', async (req, res) => {
    try {
        const orders = await db.getAllOrders();
        res.json({ success: true, count: orders.length, orders });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

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
// 11. API : PAIEMENTS
// ================================================================

app.get('/api/payments', async (req, res) => {
    try {
        const payments = await db.getAllPayments();
        res.json({ success: true, count: payments.length, payments });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

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
// 12. API : UTILISATEURS
// ================================================================

app.get('/api/users', async (req, res) => {
    try {
        const users = await getUsersWithStatus();
        res.json({ success: true, count: users.length, users });
    } catch (error) {
        console.error('❌ Erreur récupération utilisateurs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/users/filter/:status', async (req, res) => {
    const { status } = req.params;
    
    const validStatuses = ['visiteur', 'participant', 'donateur'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Statut invalide. Utilisez: visiteur, participant, donateur' 
        });
    }

    try {
        const users = await getUsersWithStatus();
        const filtered = users.filter(u => u.calculated_status === status);
        res.json({ success: true, count: filtered.length, users: filtered });
    } catch (error) {
        console.error('❌ Erreur récupération utilisateurs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/users/donateurs', async (req, res) => {
    try {
        const users = await getUsersWithStatus();
        const donateurs = users.filter(u => u.calculated_status === 'donateur');
        res.json({ success: true, count: donateurs.length, users: donateurs });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/users/participants', async (req, res) => {
    try {
        const users = await getUsersWithStatus();
        const participants = users.filter(u => u.calculated_status === 'participant');
        res.json({ success: true, count: participants.length, users: participants });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/users/visiteurs', async (req, res) => {
    try {
        const users = await getUsersWithStatus();
        const visiteurs = users.filter(u => u.calculated_status === 'visiteur');
        res.json({ success: true, count: visiteurs.length, users: visiteurs });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================================================
// 13. API : USER PAR EMAIL
// ================================================================

app.get('/api/user/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const user = await db.getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
        }
        
        const orders = await db.getOrdersByEmail(email);
        const payments = await db.getPaymentsByEmail(email);
        const successCount = payments.filter(p => p.status === 'success').length;
        const pendingCount = orders.filter(o => o.status === 'pending').length;
        const totalAmount = payments
            .filter(p => p.status === 'success')
            .reduce((sum, p) => sum + (p.amount / 100), 0);
        
        res.json({ 
            success: true, 
            user: {
                ...user,
                success_payments: successCount,
                total_amount: totalAmount,
                pending_orders: pendingCount
            }
        });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// 14. API : STATISTIQUES
// ================================================================

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
// 15. API : UPDATE STATUS
// ================================================================

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
// 16. API : COMMANDES D'UN UTILISATEUR
// ================================================================

app.get('/api/orders/user/:email', async (req, res) => {
    const { email } = req.params;

    console.log(`📝 Récupération des commandes pour: ${email}`);

    if (!email) {
        return res.status(400).json({ error: 'Email requis' });
    }

    try {
        const orders = await db.getOrdersByEmail(email);
        console.log(`✅ ${orders.length} commande(s) trouvée(s) pour ${email}`);
        res.json({ success: true, count: orders.length, orders });
    } catch (error) {
        console.error('❌ Erreur récupération commandes:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// 17. ROUTE ADMIN : VÉRIFIER LES IDENTIFIANTS
// ================================================================

app.post('/api/admin/verify', async (req, res) => {
    const { username, password } = req.body;

    const ADMIN_USER = process.env.ADMIN_USER || 'virtmakadmin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ipote233@database';

    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Authentification réussie' });
    } else {
        res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }
});

// ================================================================
// 18. ROUTE ADMIN : RÉINITIALISER LA BASE
// ================================================================

// ================================================================
// ROUTE ADMIN : RÉINITIALISER LA BASE
// ================================================================

app.post('/api/admin/reset-database', async (req, res) => {
    const { password } = req.body;

    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ipote233@database';

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
    }

    console.log('\n' + '='.repeat(80));
    console.log('🔄 RÉINITIALISATION DE LA BASE');
    console.log('='.repeat(80));
    console.log('⚠️ Toutes les données vont être supprimées !');

    try {
        // ✅ Appeler la nouvelle fonction resetDatabase()
        const result = await db.resetDatabase();

        if (result) {
            console.log('✅ Base réinitialisée avec succès');
            console.log('='.repeat(80) + '\n');
            res.json({ success: true, message: 'Base réinitialisée avec succès' });
        } else {
            throw new Error('Erreur lors de la réinitialisation');
        }
    } catch (error) {
        console.error('❌ Erreur réinitialisation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ================================================================
// 19. WEBHOOK JEKO
// ================================================================

app.post('/webhook', async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log('🔔 WEBHOOK REÇU');
    console.log('='.repeat(80));

    try {
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

        const body = req.body;
        console.log('📦 Webhook reçu');

        const reference = body.transactionDetails?.reference || body.reference || null;
        console.log(`🔗 Référence: ${reference || 'NON FOURNIE'}`);

        if (!reference) {
            console.log('❌ Référence manquante');
            return res.status(400).send('Reference not found');
        }

        console.log('🔍 Recherche de la commande...');
        const order = await db.getOrderByReference(reference);

        if (!order) {
            console.log(`❌ Commande non trouvée: ${reference}`);
            return res.status(404).send('Order not found');
        }

        console.log(`✅ Commande trouvée: ID ${order.id}, statut: ${order.status}`);
        console.log(`   💳 Méthode enregistrée: ${order.flex4 || 'Non renseignée'}`);

        if (order.status === 'success') {
            console.log('ℹ️ Déjà traité, ignoré');
            return res.sendStatus(200);
        }

        console.log('💾 Mise à jour de la commande...');
        await db.updateOrderStatus(reference, 'success', body.id);
        console.log(`✅ Commande mise à jour: ${reference} → success`);

        console.log('👤 Mise à jour de l\'utilisateur...');
        const user = await db.updateUserStatus(order.email, 'donateur');
        if (user) {
            console.log(`✅ Utilisateur mis à jour: ${order.email} → donateur`);
        }

        console.log('💾 Enregistrement du paiement...');
        const paymentData = {
            transaction_id: body.id,
            user_id: order.user_id,
            amount: body.amount?.amount || order.amount,
            currency: body.amount?.currency || 'XOF',
            status: 'success',
            payment_method: order.flex4 || body.paymentMethod || 'wave',
            counterpart_phone: body.counterpartLabel || null,
            store_id: body.storeId || null,
            store_name: body.storeName || null,
            payment_link_id: body.transactionDetails?.paymentLinkId || null,
            reference: reference,
            executed_at: body.executedAt || null
        };
        const savedPayment = await db.savePayment(paymentData);
        console.log(`✅ Paiement enregistré: ${savedPayment ? 'OK' : 'Déjà existant'}`);
        console.log(`   💳 Méthode: ${paymentData.payment_method}`);

        // ============================================================
        // 🔥 ENVOI DE L'EMAIL DE REMERCIEMENT
        // ============================================================
        console.log('\n📧 ENVOI DE L\'EMAIL DE REMERCIEMENT');
        console.log('-'.repeat(40));

        let emailStatus = 'echec';
        let emailMessage = '';

        if (order.email) {
            const emailResult = await sendThankYouEmail(
                order.email,
                order.name,
                order.amount,
                reference
            );

            if (emailResult.success) {
                emailStatus = 'succes';
                emailMessage = 'Email envoyé avec succès';
                console.log(`✅ ${emailMessage} via SendGrid`);
            } else {
                emailStatus = 'echec';
                emailMessage = emailResult.message;
                console.error(`❌ ${emailMessage}`);
            }
        } else {
            emailStatus = 'echec';
            emailMessage = 'Aucun email fourni pour le donateur';
            console.warn(`⚠️ ${emailMessage}`);
        }

        // Mettre à jour le statut de l'envoi
        try {
            await db.query(
                'UPDATE users SET flex1 = $1, flex2 = $2 WHERE email = $3',
                [emailStatus, emailMessage, order.email]
            );
            console.log(`✅ Statut email enregistré: ${emailStatus} - ${emailMessage}`);
        } catch (error) {
            console.error('❌ Erreur enregistrement statut email:', error);
        }

        // ============================================================
        // RÉSUMÉ FINAL
        // ============================================================
        console.log('\n📋 RÉSUMÉ DU TRAITEMENT:');
        console.log('-'.repeat(40));
        console.log(`   ✅ Signature: OK`);
        console.log(`   ✅ Commande: pending → success`);
        console.log(`   ✅ Utilisateur: ${order.email} → donateur`);
        console.log(`   ✅ Paiement: ${savedPayment ? 'OK' : 'Déjà existant'}`);
        console.log(`   💳 Méthode: ${order.flex4 || 'wave'}`);
        console.log(`   📧 Email: ${emailStatus} - ${emailMessage}`);
        console.log(`   📧 Expéditeur: ${SENDER_EMAIL}`);
        console.log(`   📧 Service: SendGrid`);
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

// ================================================================
// 20. DÉMARRAGE
// ================================================================

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`🌐 https://virtmarket-test.onrender.com`);
    console.log(`📊 Admin: /admin`);
    console.log(`📧 Email expéditeur: ${SENDER_EMAIL}`);
    console.log(`📧 Service: SendGrid`);
    console.log(`\n📋 API disponibles:`);
    console.log(`   POST /api/visiteur (avec conservation du nom)`);
    console.log(`   POST /api/create-payment (avec méthodes Jèko: wave, orange, mtn, moov)`);
    console.log(`   GET  /api/paylist`);
    console.log(`   GET  /api/paylist/:reference`);
    console.log(`   GET  /api/payments`);
    console.log(`   GET  /api/payment/:id`);
    console.log(`   GET  /api/users (3 statuts + total_amount)`);
    console.log(`   GET  /api/users/filter/:status`);
    console.log(`   GET  /api/users/donateurs`);
    console.log(`   GET  /api/users/participants`);
    console.log(`   GET  /api/users/visiteurs`);
    console.log(`   GET  /api/user/:email`);
    console.log(`   GET  /api/stats`);
    console.log(`   POST /api/update-status`);
    console.log(`   POST /webhook`);
});