// ================================================================
// FICHIER : database.js
// DESCRIPTION : Gestion de la base de données PostgreSQL
// VERSION : 3.4 - Ajout reset complet
// ================================================================

const { Pool } = require('pg');
require('dotenv').config();

// ================================================================
// 1. CONNEXION À LA BASE
// ================================================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
});

// ================================================================
// 2. INITIALISATION DES TABLES
// ================================================================

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ---------- 2.1 Table : users ----------
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
        console.log('✅ Table users créée/vérifiée');

        // Migration : ajouter la colonne status si elle n'existe pas
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='users' AND column_name='status') THEN
                    ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'visiteur';
                END IF;
            END $$;
        `);
        console.log('✅ Colonne status ajoutée à users');

        // ---------- 2.2 Table : orders ----------
        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                reference TEXT UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                email TEXT NOT NULL,
                name TEXT NOT NULL,
                amount INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                payment_link_id TEXT,
                transaction_id TEXT,
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
        console.log('✅ Table orders créée/vérifiée');

        // Migration : ajouter la colonne flex4 si elle n'existe pas
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='orders' AND column_name='flex4') THEN
                    ALTER TABLE orders ADD COLUMN flex4 TEXT DEFAULT NULL;
                END IF;
            END $$;
        `);
        console.log('✅ Colonne flex4 ajoutée à orders');

        // Migration : migrer les données depuis pending_payments si elle existe
        await client.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='pending_payments') THEN
                    INSERT INTO orders (reference, email, name, amount, status, payment_link_id, transaction_id, created_at, updated_at)
                    SELECT 
                        reference, 
                        email, 
                        name, 
                        amount, 
                        status, 
                        payment_link_id, 
                        transaction_id, 
                        created_at, 
                        updated_at
                    FROM pending_payments
                    ON CONFLICT (reference) DO NOTHING;
                END IF;
            END $$;
        `);
        console.log('✅ Migration pending_payments → orders effectuée');

        // ---------- 2.3 Table : payments ----------
        await client.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                transaction_id TEXT UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                amount INTEGER NOT NULL,
                currency TEXT DEFAULT 'XOF',
                status TEXT DEFAULT 'pending',
                payment_method TEXT,
                counterpart_phone TEXT,
                store_id TEXT,
                store_name TEXT,
                payment_link_id TEXT,
                reference TEXT,
                executed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table payments créée/vérifiée');

        // Migration : migrer les données depuis payments_jeko si elle existe
        await client.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='payments_jeko') THEN
                    INSERT INTO payments (transaction_id, amount, currency, status, counterpart_phone, payment_method, store_id, store_name, payment_link_id, reference, executed_at, created_at, updated_at)
                    SELECT 
                        transaction_id, 
                        amount, 
                        currency, 
                        status, 
                        counterpart_phone, 
                        payment_method, 
                        store_id, 
                        store_name, 
                        payment_link_id, 
                        NULL as reference, 
                        executed_at, 
                        created_at, 
                        updated_at
                    FROM payments_jeko
                    ON CONFLICT (transaction_id) DO NOTHING;
                END IF;
            END $$;
        `);
        console.log('✅ Migration payments_jeko → payments effectuée');

        // ---------- 2.4 Index ----------
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_flex4 ON orders(flex4)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`);
        console.log('✅ Index créés/vérifiés');

        await client.query('COMMIT');
        console.log('✅ Base de données initialisée avec succès');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur initialisation:', error);
        throw error;
    } finally {
        client.release();
    }
}

// ================================================================
// 3. FONCTIONS UTILISATEURS
// ================================================================

/**
 * Récupère un utilisateur par son email, ou le crée s'il n'existe pas
 */
async function getOrCreateUser(name, email, amount) {
    try {
        let user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length > 0) {
            if (user.rows[0].name !== name) {
                await pool.query('UPDATE users SET name = $1, updated_at = NOW() WHERE email = $2', [name, email]);
                user.rows[0].name = name;
            }
            if (amount && user.rows[0].flex3 !== String(amount)) {
                await pool.query('UPDATE users SET flex3 = $1, updated_at = NOW() WHERE email = $2', [String(amount), email]);
                user.rows[0].flex3 = String(amount);
            }
            return user.rows[0];
        }
        const result = await pool.query(
            `INSERT INTO users (name, email, status, flex3) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [name, email, 'visiteur', String(amount || '')]
        );
        return result.rows[0];
    } catch (error) {
        console.error('❌ getOrCreateUser:', error);
        return null;
    }
}

/**
 * Met à jour le statut d'un utilisateur
 */
async function updateUserStatus(email, status) {
    try {
        const result = await pool.query(
            'UPDATE users SET status = $1, updated_at = NOW() WHERE email = $2 RETURNING *',
            [status, email]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ updateUserStatus:', error);
        return null;
    }
}

/**
 * Met à jour les flex
 */
async function updateUserFlex(email, flex1, flex2) {
    try {
        const result = await pool.query(
            'UPDATE users SET flex1 = $1, flex2 = $2, updated_at = NOW() WHERE email = $3 RETURNING *',
            [flex1, flex2, email]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ updateUserFlex:', error);
        return null;
    }
}

/**
 * Récupère un utilisateur par son ID
 */
async function getUserById(id) {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ getUserById:', error);
        return null;
    }
}

/**
 * Récupère un utilisateur par son email
 */
async function getUserByEmail(email) {
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ getUserByEmail:', error);
        return null;
    }
}

/**
 * Récupère tous les utilisateurs
 */
async function getAllUsers() {
    try {
        const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
        return result.rows;
    } catch (error) {
        console.error('❌ getAllUsers:', error);
        return [];
    }
}

// ================================================================
// 4. FONCTIONS COMMANDES (ORDERS)
// ================================================================

/**
 * Crée une nouvelle commande avec flex4 pour la méthode de paiement
 */
async function createOrder(data) {
    const query = `
        INSERT INTO orders (
            reference, user_id, email, name, amount, status, 
            payment_link_id, transaction_id, flex4
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    `;
    const values = [
        data.reference,
        data.user_id || null,
        data.email,
        data.name,
        data.amount,
        data.status || 'pending',
        data.payment_link_id || null,
        data.transaction_id || null,
        data.flex4 || null
    ];
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('❌ createOrder:', error);
        return null;
    }
}

/**
 * Récupère une commande par sa référence
 */
async function getOrderByReference(reference) {
    try {
        const result = await pool.query('SELECT * FROM orders WHERE reference = $1', [reference]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ getOrderByReference:', error);
        return null;
    }
}

/**
 * Met à jour le statut d'une commande
 */
async function updateOrderStatus(reference, status, transactionId) {
    try {
        const result = await pool.query(
            `UPDATE orders 
             SET status = $1, transaction_id = $2, updated_at = NOW() 
             WHERE reference = $3 
             RETURNING *`,
            [status, transactionId, reference]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ updateOrderStatus:', error);
        return null;
    }
}

/**
 * Met à jour le payment_link_id d'une commande
 */
async function updateOrderPaymentLink(reference, paymentLinkId) {
    try {
        const result = await pool.query(
            'UPDATE orders SET payment_link_id = $1, updated_at = NOW() WHERE reference = $2 RETURNING *',
            [paymentLinkId, reference]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ updateOrderPaymentLink:', error);
        return null;
    }
}

/**
 * Récupère toutes les commandes
 */
async function getAllOrders() {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        return result.rows;
    } catch (error) {
        console.error('❌ getAllOrders:', error);
        return [];
    }
}

/**
 * Récupère les commandes par email
 */
async function getOrdersByEmail(email) {
    try {
        const result = await pool.query(
            'SELECT * FROM orders WHERE email = $1 ORDER BY created_at DESC',
            [email]
        );
        return result.rows;
    } catch (error) {
        console.error('❌ getOrdersByEmail:', error);
        return [];
    }
}

/**
 * Récupère les commandes par statut
 */
async function getOrdersByStatus(status) {
    try {
        const result = await pool.query('SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC', [status]);
        return result.rows;
    } catch (error) {
        console.error('❌ getOrdersByStatus:', error);
        return [];
    }
}

// ================================================================
// 5. FONCTIONS PAIEMENTS
// ================================================================

/**
 * Enregistre un paiement
 */
async function savePayment(data) {
    const query = `
        INSERT INTO payments (
            transaction_id, user_id, amount, currency, status,
            payment_method, counterpart_phone, store_id, store_name,
            payment_link_id, reference, executed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (transaction_id) DO NOTHING
        RETURNING *
    `;
    const values = [
        data.transaction_id,
        data.user_id || null,
        data.amount || 0,
        data.currency || 'XOF',
        data.status || 'success',
        data.payment_method || null,
        data.counterpart_phone || null,
        data.store_id || null,
        data.store_name || null,
        data.payment_link_id || null,
        data.reference || null,
        data.executed_at ? new Date(data.executed_at) : null
    ];
    try {
        const result = await pool.query(query, values);
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ savePayment:', error);
        return null;
    }
}

/**
 * Récupère un paiement par transaction_id
 */
async function getPaymentByTransactionId(transactionId) {
    try {
        const result = await pool.query('SELECT * FROM payments WHERE transaction_id = $1', [transactionId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ getPaymentByTransactionId:', error);
        return null;
    }
}

/**
 * Récupère un paiement par ID
 */
async function getPaymentById(id) {
    try {
        const result = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ getPaymentById:', error);
        return null;
    }
}

/**
 * Récupère tous les paiements
 */
async function getAllPayments() {
    try {
        const result = await pool.query(`
            SELECT p.*, u.name as user_name, u.email as user_email, u.status as user_status
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        `);
        return result.rows;
    } catch (error) {
        console.error('❌ getAllPayments:', error);
        return [];
    }
}

/**
 * Récupère les paiements par email via user_id
 */
async function getPaymentsByEmail(email) {
    try {
        const user = await getUserByEmail(email);
        if (!user) {
            return [];
        }
        const result = await pool.query(
            'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC',
            [user.id]
        );
        return result.rows;
    } catch (error) {
        console.error('❌ getPaymentsByEmail:', error);
        return [];
    }
}

/**
 * Récupère les paiements par statut
 */
async function getPaymentsByStatus(status) {
    try {
        const result = await pool.query(
            'SELECT * FROM payments WHERE status = $1 ORDER BY created_at DESC',
            [status]
        );
        return result.rows;
    } catch (error) {
        console.error('❌ getPaymentsByStatus:', error);
        return [];
    }
}

// ================================================================
// 6. FONCTIONS STATISTIQUES
// ================================================================

/**
 * Récupère les statistiques globales
 */
async function getStats() {
    try {
        const result = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE status = 'visiteur') as total_visiteurs,
                (SELECT COUNT(*) FROM users WHERE status = 'participant') as total_participants,
                (SELECT COUNT(*) FROM users WHERE status = 'donateur') as total_donateurs,
                (SELECT COUNT(*) FROM orders WHERE status = 'pending') as total_commandes_pending,
                (SELECT COUNT(*) FROM orders WHERE status = 'success') as total_commandes_success,
                (SELECT COUNT(*) FROM payments WHERE status = 'success') as total_paiements,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'success') as total_montant
        `);
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ getStats:', error);
        return null;
    }
}

// ================================================================
// 7. FONCTION : RESET COMPLET
// ================================================================

/**
 * ✅ Supprime TOUTES les données de TOUTES les tables
 * Utilisé par reset-data.html
 */
async function resetDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Supprimer toutes les données de toutes les tables
        await client.query(`
            TRUNCATE TABLE 
                payments, 
                orders, 
                users, 
                pending_payments, 
                payments_jeko, 
                soutiens 
            RESTART IDENTITY CASCADE
        `);
        
        await client.query('COMMIT');
        console.log('✅ Base réinitialisée complètement (toutes les tables)');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur reset:', error);
        return false;
    } finally {
        client.release();
    }
}

// ================================================================
// 8. FONCTIONS DE NETTOYAGE (DESACTIVÉES)
// ================================================================

async function cleanOldOrders(minutes = 15) {
    return 0;
}

async function cleanOldPayments(minutes = 15) {
    return 0;
}

// ================================================================
// 9. EXPORT
// ================================================================

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    
    initialize: initializeDatabase,
    resetDatabase,  // ✅ NOUVEAU
    
    getOrCreateUser,
    updateUserStatus,
    updateUserFlex,
    getUserById,
    getUserByEmail,
    getAllUsers,
    
    createOrder,
    getOrderByReference,
    updateOrderStatus,
    updateOrderPaymentLink,
    getAllOrders,
    getOrdersByEmail,
    getOrdersByStatus,
    
    savePayment,
    getPaymentByTransactionId,
    getPaymentById,
    getAllPayments,
    getPaymentsByEmail,
    getPaymentsByStatus,
    
    getStats,
    
    cleanOldOrders,
    cleanOldPayments
};