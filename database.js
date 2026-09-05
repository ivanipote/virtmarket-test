const { Pool } = require('pg');

// Configuration de la base de données
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Création de la table des paiements
async function initDatabase() {
    try {
        await pool.query(`
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table payments_jeko créée');
    } catch (error) {
        console.error('❌ Erreur création table:', error);
    }
}

// Sauvegarder un paiement
async function savePayment(data) {
    const query = `
        INSERT INTO payments_jeko (
            transaction_id, amount, currency, status,
            counterpart_phone, payment_method, store_id,
            store_name, payment_link_id, executed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (transaction_id) DO NOTHING
        RETURNING id
    `;

    const values = [
        data.id,
        data.amount.amount,
        data.amount.currency,
        data.status,
        data.counterpartIdentifier || null,
        data.paymentMethod || null,
        data.storeId || null,
        data.storeName || null,
        data.transactionDetails?.paymentLinkId || null,
        data.executedAt ? new Date(data.executedAt) : null
    ];

    try {
        const result = await pool.query(query, values);
        console.log(`✅ Paiement ${data.id} enregistré (ID: ${result.rows[0]?.id || 'existant'})`);
        return result.rows[0]?.id || null;
    } catch (error) {
        console.error('❌ Erreur sauvegarde paiement:', error);
        return null;
    }
}

// Récupérer tous les paiements
async function getPayments() {
    try {
        const result = await pool.query(
            'SELECT * FROM payments_jeko ORDER BY created_at DESC'
        );
        return result.rows;
    } catch (error) {
        console.error('❌ Erreur récupération paiements:', error);
        return [];
    }
}

module.exports = {
    pool,
    initDatabase,
    savePayment,
    getPayments
};