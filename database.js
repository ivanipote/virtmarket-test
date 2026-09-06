const { Pool } = require('pg');
require('dotenv').config();

// ============================================================
// CONNEXION À POSTGRESQL
// ============================================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
});

// ============================================================
// INITIALISATION DES TABLES
// ============================================================
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ============================================================
        // TABLE PAYMENTS_JEKO
        // ============================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS payments_jeko (
                id SERIAL PRIMARY KEY,
                transaction_id TEXT UNIQUE NOT NULL,
                amount INTEGER NOT NULL,
                currency TEXT DEFAULT 'XOF',
                status TEXT DEFAULT 'pending',
                counterpart_phone TEXT,
                payment_method TEXT,
                store_id TEXT,
                store_name TEXT,
                payment_link_id TEXT,
                executed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                flex1 TEXT DEFAULT NULL,
                flex2 TEXT DEFAULT NULL,
                flex3 TEXT DEFAULT NULL,
                flex4 TEXT DEFAULT NULL,
                flex5 TEXT DEFAULT NULL,
                flex6 TEXT DEFAULT NULL,
                flex7 TEXT DEFAULT NULL,
                flex8 TEXT DEFAULT NULL
            )
        `);
        console.log('✅ Table payments_jeko créée');

        // ============================================================
        // TABLE USERS
        // ============================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                flex1 TEXT DEFAULT NULL,
                flex2 TEXT DEFAULT NULL,
                flex3 TEXT DEFAULT NULL,
                flex4 TEXT DEFAULT NULL,
                flex5 TEXT DEFAULT NULL,
                flex6 TEXT DEFAULT NULL,
                flex7 TEXT DEFAULT NULL,
                flex8 TEXT DEFAULT NULL
            )
        `);
        console.log('✅ Table users créée');

        // ============================================================
        // TABLE SOUTIENS
        // ============================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS soutiens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                payment_id INTEGER REFERENCES payments_jeko(id) ON DELETE SET NULL,
                amount INTEGER NOT NULL,
                message TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                flex1 TEXT DEFAULT NULL,
                flex2 TEXT DEFAULT NULL,
                flex3 TEXT DEFAULT NULL,
                flex4 TEXT DEFAULT NULL,
                flex5 TEXT DEFAULT NULL,
                flex6 TEXT DEFAULT NULL,
                flex7 TEXT DEFAULT NULL,
                flex8 TEXT DEFAULT NULL
            )
        `);
        console.log('✅ Table soutiens créée');

        // ============================================================
        // INDEX
        // ============================================================
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_transaction_id ON payments_jeko(transaction_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_status ON payments_jeko(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_created_at ON payments_jeko(created_at)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_flex1 ON payments_jeko(flex1)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_flex2 ON payments_jeko(flex2)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_soutiens_user_id ON soutiens(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_soutiens_status ON soutiens(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_flex5 ON users(flex5)`);

        await client.query('COMMIT');
        console.log('✅ Toutes les tables créées avec succès');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur création tables:', error);
        throw error;
    } finally {
        client.release();
    }
}

// ============================================================
// CRÉER OU RÉCUPÉRER UN UTILISATEUR
// ============================================================
async function getOrCreateUser(name, email) {
    try {
        // Vérifier si l'utilisateur existe
        let user = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (user.rows.length > 0) {
            // Mettre à jour le nom si différent
            if (user.rows[0].name !== name) {
                await pool.query(
                    'UPDATE users SET name = $1, updated_at = NOW() WHERE email = $2',
                    [name, email]
                );
                user.rows[0].name = name;
            }
            console.log(`👤 Utilisateur existant : ${name} (${email})`);
            return user.rows[0];
        }

        // Créer un nouvel utilisateur
        const result = await pool.query(
            `INSERT INTO users (name, email) 
             VALUES ($1, $2) 
             RETURNING *`,
            [name, email]
        );
        console.log(`✅ Nouvel utilisateur créé : ${name} (${email})`);
        return result.rows[0];
    } catch (error) {
        console.error('❌ Erreur getOrCreateUser:', error);
        return null;
    }
}

// ============================================================
// METTRE À JOUR LE STATUT UTILISATEUR (flex5)
// ============================================================
async function updateUserStatus(email, userStatus) {
    try {
        const result = await pool.query(
            `UPDATE users 
             SET flex5 = $1, updated_at = NOW() 
             WHERE email = $2 
             RETURNING id, name, email, flex5 as user_status`,
            [userStatus, email]
        );
        if (result.rowCount > 0) {
            console.log(`✅ Statut utilisateur mis à jour : ${userStatus} (${email})`);
        }
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erreur updateUserStatus:', error);
        return null;
    }
}

// ============================================================
// SAUVEGARDER UN PAIEMENT JEKO
// ============================================================
async function saveJekoPayment(data) {
    const query = `
        INSERT INTO payments_jeko (
            transaction_id, amount, currency, status,
            counterpart_phone, payment_method, store_id,
            store_name, payment_link_id, executed_at,
            flex1, flex2, flex3, flex4, flex5
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (transaction_id) DO NOTHING
        RETURNING id
    `;

    const values = [
        data.id,
        data.amount?.amount || 0,
        data.amount?.currency || 'XOF',
        data.status || 'pending',
        data.counterpartIdentifier || null,
        data.paymentMethod || null,
        data.storeId || null,
        data.storeName || null,
        data.transactionDetails?.paymentLinkId || null,
        data.executedAt ? new Date(data.executedAt) : null,
        data.flex1 || null,
        data.flex2 || null,
        data.flex3 || null,
        data.flex4 || null,
        data.flex5 || 'visiteur'
    ];

    try {
        const result = await pool.query(query, values);
        if (result.rowCount > 0) {
            console.log(`✅ Paiement Jèko ${data.id} enregistré (ID: ${result.rows[0].id})`);
        } else {
            console.log(`ℹ️ Paiement Jèko ${data.id} déjà existant`);
        }
        return result.rows[0]?.id || null;
    } catch (error) {
        console.error('❌ Erreur sauvegarde paiement Jèko:', error);
        return null;
    }
}

// ============================================================
// METTRE À JOUR LE STATUT D'UN PAIEMENT
// ============================================================
async function updatePaymentStatus(transactionId, status) {
    try {
        const result = await pool.query(
            'UPDATE payments_jeko SET status = $1, updated_at = NOW() WHERE transaction_id = $2 RETURNING id',
            [status, transactionId]
        );
        return result.rows[0]?.id || null;
    } catch (error) {
        console.error('❌ Erreur mise à jour statut:', error);
        return null;
    }
}

// ============================================================
// RÉCUPÉRER TOUS LES PAIEMENTS
// ============================================================
async function getJekoPayments() {
    try {
        const result = await pool.query(`
            SELECT 
                p.*,
                u.name as user_name,
                u.email as user_email,
                u.flex5 as user_status
            FROM payments_jeko p
            LEFT JOIN users u ON u.email = p.flex2
            ORDER BY p.created_at DESC
        `);
        return result.rows;
    } catch (error) {
        console.error('❌ Erreur récupération paiements Jèko:', error);
        return [];
    }
}

// ============================================================
// RÉCUPÉRER UN PAIEMENT PAR ID
// ============================================================
async function getPaymentById(id) {
    try {
        const result = await pool.query(
            'SELECT * FROM payments_jeko WHERE id = $1 OR transaction_id = $1',
            [id]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erreur récupération paiement:', error);
        return null;
    }
}

// ============================================================
// NETTOYER LES PAIEMENTS PENDING ORPHELINS (15min)
// ============================================================
async function cleanPendingPayments() {
    try {
        const result = await pool.query(`
            DELETE FROM payments_jeko
            WHERE status = 'pending'
            AND created_at < NOW() - INTERVAL '15 minutes'
        `);
        if (result.rowCount > 0) {
            console.log(`🧹 ${result.rowCount} paiement(s) pending supprimés`);
        }
        return result.rowCount;
    } catch (error) {
        console.error('❌ Erreur nettoyage:', error);
        return 0;
    }
}

// ============================================================
// EXPORT
// ============================================================
module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    get: (text, params) => pool.query(text, params).then(res => res.rows[0]),
    all: (text, params) => pool.query(text, params).then(res => res.rows),
    run: (text, params) => pool.query(text, params),
    initialize: initializeDatabase,
    getOrCreateUser,
    updateUserStatus,
    saveJekoPayment,
    updatePaymentStatus,
    getJekoPayments,
    getPaymentById,
    cleanPendingPayments
};