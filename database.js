const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
});

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

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

        // ===== NOUVELLE TABLE : pending_payments =====
        await client.query(`
            CREATE TABLE IF NOT EXISTS pending_payments (
                id SERIAL PRIMARY KEY,
                reference TEXT UNIQUE NOT NULL,
                email TEXT NOT NULL,
                name TEXT NOT NULL,
                amount INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                payment_link_id TEXT,
                transaction_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table pending_payments créée');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_transaction_id ON payments_jeko(transaction_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_status ON payments_jeko(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_created_at ON payments_jeko(created_at)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_flex1 ON payments_jeko(flex1)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_flex2 ON payments_jeko(flex2)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_soutiens_user_id ON soutiens(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_soutiens_status ON soutiens(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_flex5 ON users(flex5)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_pending_payments_reference ON pending_payments(reference)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_pending_payments_status ON pending_payments(status)`);

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
// FONCTIONS UTILISATEURS
// ============================================================

async function getOrCreateUser(name, email) {
    try {
        let user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length > 0) {
            if (user.rows[0].name !== name) {
                await pool.query('UPDATE users SET name = $1, updated_at = NOW() WHERE email = $2', [name, email]);
                user.rows[0].name = name;
            }
            return user.rows[0];
        }
        const result = await pool.query(
            `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *`,
            [name, email]
        );
        return result.rows[0];
    } catch (error) {
        console.error('❌ Erreur getOrCreateUser:', error);
        return null;
    }
}

async function updateUserStatus(email, userStatus) {
    try {
        const result = await pool.query(
            `UPDATE users SET flex5 = $1, updated_at = NOW() WHERE email = $2 RETURNING id, name, email, flex5 as user_status`,
            [userStatus, email]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erreur updateUserStatus:', error);
        return null;
    }
}

// ============================================================
// FONCTIONS PAIEMENTS JEKO
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
        data.counterpartLabel || null,
        data.paymentMethod || null,
        data.storeId || null,
        data.storeName || null,
        data.transactionDetails?.paymentLinkId || null,
        data.executedAt ? new Date(data.executedAt) : null,
        data.flex1 || null,
        data.flex2 || null,
        data.flex3 || null,
        data.flex4 || null,
        data.flex5 || null
    ];

    try {
        const result = await pool.query(query, values);
        return result.rows[0]?.id || null;
    } catch (error) {
        console.error('❌ Erreur sauvegarde paiement Jèko:', error);
        return null;
    }
}

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

async function getJekoPayments() {
    try {
        const result = await pool.query(`
            SELECT p.*, u.name as user_name, u.email as user_email, u.flex5 as user_status
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

async function getPaymentById(id) {
    try {
        const result = await pool.query('SELECT * FROM payments_jeko WHERE id = $1 OR transaction_id = $1', [id]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erreur récupération paiement:', error);
        return null;
    }
}

async function cleanPendingPayments() {
    try {
        const result = await pool.query(`
            DELETE FROM payments_jeko
            WHERE status = 'pending'
            AND created_at < NOW() - INTERVAL '15 minutes'
        `);
        return result.rowCount;
    } catch (error) {
        console.error('❌ Erreur nettoyage:', error);
        return 0;
    }
}

// ============================================================
// NOUVELLES FONCTIONS : PENDING PAYMENTS
// ============================================================

/**
 * Créer un paiement en attente (pending)
 */
async function createPendingPayment(data) {
    const query = `
        INSERT INTO pending_payments (
            reference, email, name, amount, status, payment_link_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;
    const values = [
        data.reference,
        data.email,
        data.name,
        data.amount,
        'pending',
        data.payment_link_id || null
    ];
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('❌ Erreur createPendingPayment:', error);
        return null;
    }
}

/**
 * Récupérer un paiement en attente par sa référence
 */
async function getPendingPaymentByReference(reference) {
    try {
        const result = await pool.query(
            'SELECT * FROM pending_payments WHERE reference = $1',
            [reference]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erreur getPendingPaymentByReference:', error);
        return null;
    }
}

/**
 * Mettre à jour le statut d'un paiement en attente
 */
async function updatePendingPaymentStatus(reference, status, transactionId) {
    try {
        const result = await pool.query(
            `UPDATE pending_payments 
             SET status = $1, transaction_id = $2, updated_at = NOW() 
             WHERE reference = $3 
             RETURNING *`,
            [status, transactionId, reference]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erreur updatePendingPaymentStatus:', error);
        return null;
    }
}

/**
 * Mettre à jour le payment_link_id d'un paiement en attente
 */
async function updatePendingPaymentLinkId(reference, paymentLinkId) {
    try {
        const result = await pool.query(
            `UPDATE pending_payments 
             SET payment_link_id = $1, updated_at = NOW() 
             WHERE reference = $2 
             RETURNING *`,
            [paymentLinkId, reference]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erreur updatePendingPaymentLinkId:', error);
        return null;
    }
}

/**
 * Récupérer tous les paiements en attente
 */
async function getPendingPayments() {
    try {
        const result = await pool.query(
            'SELECT * FROM pending_payments ORDER BY created_at DESC'
        );
        return result.rows;
    } catch (error) {
        console.error('❌ Erreur getPendingPayments:', error);
        return [];
    }
}

/**
 * Récupérer un paiement en attente par ID
 */
async function getPendingPaymentById(id) {
    try {
        const result = await pool.query(
            'SELECT * FROM pending_payments WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erreur getPendingPaymentById:', error);
        return null;
    }
}

/**
 * Nettoyer les paiements en attente trop anciens (15 min)
 */
async function cleanPendingPaymentsOld() {
    try {
        const result = await pool.query(`
            DELETE FROM pending_payments
            WHERE status = 'pending'
            AND created_at < NOW() - INTERVAL '15 minutes'
        `);
        return result.rowCount;
    } catch (error) {
        console.error('❌ Erreur cleanPendingPaymentsOld:', error);
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
    
    // Utilisateurs
    getOrCreateUser,
    updateUserStatus,
    
    // Paiements Jèko
    saveJekoPayment,
    updatePaymentStatus,
    getJekoPayments,
    getPaymentById,
    cleanPendingPayments,
     // Pending Payments (NOUVEAU)
    createPendingPayment,
    getPendingPaymentByReference,
    updatePendingPaymentStatus,
    updatePendingPaymentLinkId,
    getPendingPayments,
    getPendingPaymentById,
    cleanPendingPaymentsOld
};