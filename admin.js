// ================================================================
// admin.js - Logique du tableau de bord admin
// VERSION : 3.2 - Avec montant pour les participants
// ================================================================

document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ admin.js chargé');

    // ===== RÉFÉRENCES =====
    const usersList = document.getElementById('usersList');
    const emptyUsers = document.getElementById('emptyUsers');
    const emptyDetail = document.getElementById('emptyDetail');
    const detailContainer = document.getElementById('detailContainer');
    const refreshBtn = document.getElementById('refreshBtn');

    const statTotal = document.getElementById('statTotal');

    const countAll = document.getElementById('countAll');
    const countVisiteur = document.getElementById('countVisiteur');
    const countParticipant = document.getElementById('countParticipant');
    const countDonateur = document.getElementById('countDonateur');

    const sidebarCount = document.getElementById('sidebarCount');
    const filterBtns = document.querySelectorAll('.filter-btn');

    let allUsers = [];
    let selectedId = null;
    let currentFilter = 'all';
    let allPayments = [];
    let allOrders = [];

    const statusColors = {
        'visiteur': '#eab308',    // Jaune
        'participant': '#3b82f6', // Bleu
        'donateur': '#22c55e'     // Vert
    };

    const statusLabels = {
        'visiteur': { label: '🟡 Visiteur', class: 'visiteur' },
        'participant': { label: '🔵 Participant', class: 'participant' },
        'donateur': { label: '🟢 Donateur', class: 'donateur' }
    };

    // ============================================================
    // CHARGER LES DONNÉES
    // ============================================================

    async function loadData() {
        try {
            const usersRes = await fetch('/api/users');
            const usersData = await usersRes.json();

            const paymentsRes = await fetch('/api/payments');
            const paymentsData = await paymentsRes.json();

            const ordersRes = await fetch('/api/paylist');
            const ordersData = await ordersRes.json();

            if (usersData.success && usersData.users) {
                allUsers = usersData.users;
            }

            if (paymentsData.success && paymentsData.payments) {
                allPayments = paymentsData.payments;
            }

            if (ordersData.success && ordersData.orders) {
                allOrders = ordersData.orders;
            }

            renderStats();
            renderFilters();
            renderUsers();

            if (!selectedId && allUsers.length > 0) {
                selectedId = allUsers[0].id;
                renderDetail(selectedId);
            } else if (selectedId) {
                const exists = allUsers.some(u => u.id === selectedId);
                if (!exists && allUsers.length > 0) {
                    selectedId = allUsers[0].id;
                    renderDetail(selectedId);
                } else if (exists) {
                    renderDetail(selectedId);
                }
            }
        } catch (error) {
            console.error('❌ Erreur chargement:', error);
        }
    }

    // ============================================================
    // STATS
    // ============================================================

    function renderStats() {
        const totalAmount = allPayments
            .filter(p => p.status === 'success')
            .reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);
        statTotal.textContent = totalAmount + ' FCFA';
    }

    // ============================================================
    // FILTRES
    // ============================================================

    function renderFilters() {
        const visiteurs = allUsers.filter(u => u.status === 'visiteur');
        const participants = allUsers.filter(u => u.status === 'participant');
        const donateurs = allUsers.filter(u => u.status === 'donateur');

        countAll.textContent = allUsers.length;
        countVisiteur.textContent = visiteurs.length;
        countParticipant.textContent = participants.length;
        countDonateur.textContent = donateurs.length;
    }

    // ============================================================
    // AFFICHER LES UTILISATEURS
    // ============================================================

    function renderUsers() {
        let filtered = allUsers;

        if (currentFilter !== 'all') {
            filtered = filtered.filter(u => u.status === currentFilter);
        }

        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        sidebarCount.textContent = filtered.length;

        if (filtered.length === 0) {
            usersList.innerHTML = `
                <div class="empty-users">
                    <i class="fas fa-inbox"></i>
                    <p>Aucun utilisateur</p>
                </div>
            `;
            return;
        }

        usersList.innerHTML = filtered.map(u => {
            const status = u.status || 'visiteur';
            const name = u.name || 'Anonyme';
            const isActive = u.id === selectedId;
            const initial = name.charAt(0).toUpperCase();

            return `
                <div class="user-item ${isActive ? 'active' : ''}" data-id="${u.id}">
                    <span class="user-avatar" style="background:${statusColors[status] || '#6b7280'};">${initial}</span>
                    <span class="user-status-dot ${status}"></span>
                    <span class="user-name">${name}</span>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                selectedId = id;
                renderUsers();
                renderDetail(id);
            });
        });
    }

    // ============================================================
    // RÉCUPÉRER LES PAIEMENTS D'UN UTILISATEUR
    // ============================================================

    function getPaymentsByUser(userId) {
        return allPayments.filter(p => p.user_id === userId);
    }

    function getPaymentsByEmail(email) {
        return allPayments.filter(p => p.user_email === email || p.email === email);
    }

    // ============================================================
    // RÉCUPÉRER LES COMMANDES D'UN UTILISATEUR
    // ============================================================

    function getOrdersByEmail(email) {
        return allOrders.filter(o => o.email === email);
    }

    // ============================================================
    // AFFICHER LE DÉTAIL D'UN UTILISATEUR
    // ============================================================

    function renderDetail(id) {
        const user = allUsers.find(u => u.id === id);
        if (!user) {
            emptyDetail.style.display = 'flex';
            detailContainer.style.display = 'none';
            return;
        }

        emptyDetail.style.display = 'none';
        detailContainer.style.display = 'block';

        const status = user.status || 'visiteur';
        const name = user.name || 'Anonyme';
        const email = user.email || 'Non renseigné';
        const createdAt = user.created_at ? new Date(user.created_at) : null;
        const updatedAt = user.updated_at ? new Date(user.updated_at) : null;

        const emailStatus = user.flex1 || null;
        const emailMessage = user.flex2 || '';
        const statusInfo = statusLabels[status] || statusLabels.visiteur;

        // ===== RÉCUPÉRER LES PAIEMENTS =====
        const userPayments = getPaymentsByUser(user.id);
        const paymentsByEmail = getPaymentsByEmail(email);
        const allUserPayments = [...userPayments];
        paymentsByEmail.forEach(p => {
            if (!allUserPayments.some(up => up.transaction_id === p.transaction_id)) {
                allUserPayments.push(p);
            }
        });

        allUserPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const totalPayments = allUserPayments.length;
        const successPayments = allUserPayments.filter(p => p.status === 'success');
        const totalAmount = successPayments.reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);

        // ===== RÉCUPÉRER LES COMMANDES EN ATTENTE (participant) =====
        const userOrders = getOrdersByEmail(email);
        const pendingOrders = userOrders.filter(o => o.status === 'pending');

        const formatDate = (date) => {
            if (!date) return '-';
            return new Date(date).toLocaleDateString('fr-FR') + ' ' + 
                   new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        };

        // ===== HTML COMMANDES EN ATTENTE (pour participants) =====
        let ordersHtml = '';
        if (status === 'participant' && pendingOrders.length > 0) {
            ordersHtml = `
                <div style="margin-top:16px;padding-top:12px;border-top:2px solid #f0f2f5;">
                    <div class="payment-history-title">
                        <span class="title">📦 Commandes en attente (${pendingOrders.length})</span>
                        <span class="total">Total : ${pendingOrders.reduce((sum, o) => sum + (o.amount || 0), 0)} FCFA</span>
                    </div>
                    <div class="payment-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Montant</th>
                                    <th>Statut</th>
                                    <th>Date</th>
                                    <th>Référence</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pendingOrders.map((o, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td class="amount-cell">${o.amount || 0} FCFA</td>
                                        <td class="status-pending">⏳ ${o.status || 'pending'}</td>
                                        <td>${formatDate(o.created_at)}</td>
                                        <td class="ref-cell">${o.reference || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else if (status === 'participant' && pendingOrders.length === 0) {
            ordersHtml = `
                <div style="margin-top:16px;padding-top:12px;border-top:2px solid #f0f2f5;text-align:center;color:#9ca3af;font-size:14px;">
                    <i class="fas fa-hourglass-half" style="display:block;font-size:32px;color:#d8dbe4;margin-bottom:8px;"></i>
                    Aucune commande en attente pour ce participant.
                </div>
            `;
        }

        // ===== HTML PAIEMENTS =====
        let paymentsHtml = '';
        if (allUserPayments.length > 0) {
            paymentsHtml = `
                <div style="margin-top:16px;padding-top:12px;border-top:2px solid #f0f2f5;">
                    <div class="payment-history-title">
                        <span class="title">💳 Historique des paiements (${totalPayments})</span>
                        <span class="total">Total : ${totalAmount} FCFA</span>
                    </div>
                    <div class="payment-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Montant</th>
                                    <th>Statut</th>
                                    <th>Date</th>
                                    <th>Référence</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allUserPayments.map((p, index) => {
                                    const statusClass = p.status === 'success' ? '✅' : p.status === 'pending' ? '⏳' : '❌';
                                    const statusColor = p.status === 'success' ? 'status-success' : p.status === 'pending' ? 'status-pending' : 'status-failed';
                                    const amountInFCFA = (p.amount || 0) / 100;
                                    return `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td class="amount-cell">${amountInFCFA} FCFA</td>
                                            <td class="${statusColor}">${statusClass} ${p.status || 'inconnu'}</td>
                                            <td>${formatDate(p.created_at)}</td>
                                            <td class="ref-cell">${p.reference || p.transaction_id || '-'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else if (status === 'donateur' && allUserPayments.length === 0) {
            paymentsHtml = `
                <div style="margin-top:16px;padding-top:12px;border-top:2px solid #f0f2f5;text-align:center;color:#9ca3af;font-size:14px;">
                    <i class="fas fa-credit-card" style="display:block;font-size:32px;color:#d8dbe4;margin-bottom:8px;"></i>
                    Aucun paiement enregistré pour cet utilisateur.
                </div>
            `;
        }

        // ===== MONTANT DU PARTICIPANT DANS LE STATUS FOOTER =====
        let participantAmountHtml = '';
        if (status === 'participant' && pendingOrders.length > 0) {
            participantAmountHtml = `
                <div class="status-item" style="border-top:1px solid #f0f2f5;padding-top:6px;margin-top:4px;">
                    <span class="status-label"><i class="fas fa-money-bill-wave" style="color:#3b82f6;"></i> Montant</span>
                    <span class="status-time" style="color:#156FE6;font-weight:700;">
                        ${pendingOrders[0].amount || 0} FCFA
                    </span>
                </div>
            `;
        }

        // ===== EMAIL STATUS =====
        let emailStatusHtml = '';
        if (emailStatus === 'succes') {
            emailStatusHtml = `<span class="email-status succes">✅ Envoyé</span>`;
        } else if (emailStatus === 'echec') {
            emailStatusHtml = `<span class="email-status echec">❌ Échec</span>`;
        } else {
            emailStatusHtml = `<span class="email-status inconnu">⏳ En attente</span>`;
        }

        // ===== RENDER =====
        detailContainer.innerHTML = `
            <div class="detail-card">
                <div class="detail-header">
                    <span class="detail-title"><i class="fas fa-user"></i> Détail utilisateur</span>
                    <span class="detail-id">#${user.id}</span>
                </div>

                <div class="detail-row">
                    <span class="label">👤 Nom</span>
                    <span class="value">${name}</span>
                </div>
                <div class="detail-row">
                    <span class="label">📧 Email</span>
                    <span class="value">${email}</span>
                </div>
                <div class="detail-row">
                    <span class="label">📊 Statut</span>
                    <span class="value"><span class="status-badge ${statusInfo.class}">${statusInfo.label}</span></span>
                </div>
                <div class="detail-row">
                    <span class="label">📅 Date d'inscription</span>
                    <span class="value">${formatDate(createdAt)}</span>
                </div>
                <div class="detail-row" style="border-bottom: 2px solid #f0f2f5; padding-bottom: 12px; margin-bottom: 4px;">
                    <span class="label">📧 Email de remerciement</span>
                    <span class="value">${emailStatusHtml}</span>
                </div>
                <div class="detail-row" style="border-bottom: none; padding-top: 4px;">
                    <span class="label" style="font-size:12px;color:#9ca3af;">Message</span>
                    <span class="value" style="font-size:12px;font-weight:400;color:#6b7280;max-width:50%;">${emailMessage || '-'}</span>
                </div>

                <!-- STATUS FOOTER -->
                <div class="detail-status-footer">
                    ${status === 'visiteur' ? `
                        <div class="status-item">
                            <span class="status-label"><i class="fas fa-clock" style="color:#eab308;"></i> En attente</span>
                            <span class="status-time pending">
                                ${formatDate(createdAt)}
                                <span class="badge pending">⏳ En attente</span>
                            </span>
                        </div>
                    ` : ''}
                    ${status === 'participant' ? `
                        <div class="status-item">
                            <span class="status-label"><i class="fas fa-link" style="color:#3b82f6;"></i> Lien généré</span>
                            <span class="status-time pending">
                                ${formatDate(updatedAt)}
                                <span class="badge pending">⏳ En attente</span>
                            </span>
                        </div>
                        ${participantAmountHtml}
                    ` : ''}
                    ${status === 'donateur' ? `
                        <div class="status-item">
                            <span class="status-label"><i class="fas fa-check-circle" style="color:#22c55e;"></i> Dernier paiement</span>
                            <span class="status-time success">
                                ${formatDate(updatedAt)}
                                <span class="badge success">✅ Succès</span>
                            </span>
                        </div>
                    ` : ''}
                </div>

                <!-- COMMANDES EN ATTENTE (pour participants) -->
                ${ordersHtml}

                <!-- HISTORIQUE DES PAIEMENTS (pour donateurs) -->
                ${paymentsHtml}

                <!-- ACTIONS -->
                <div class="detail-actions">
                    <button class="copy-btn" data-copy="${email}">
                        <i class="fas fa-copy"></i> Copier l'email
                    </button>
                    <button class="copy-btn" data-copy="${name}">
                        <i class="fas fa-copy"></i> Copier le nom
                    </button>
                    ${user.id ? `
                        <button class="copy-btn" data-copy="#${user.id}">
                            <i class="fas fa-copy"></i> Copier l'ID
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        // ===== COPIE =====
        document.querySelectorAll('.detail-card .copy-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const text = this.dataset.copy;
                navigator.clipboard.writeText(text).then(() => {
                    this.style.background = '#e6f7ee';
                    this.style.color = '#156FE6';
                    this.innerHTML = '<i class="fas fa-check"></i> Copié !';
                    setTimeout(() => {
                        this.style.background = '#f8f9fc';
                        this.style.color = '#6b7280';
                        const label = this.textContent.includes('email') ? "Copier l'email" :
                                     this.textContent.includes('nom') ? "Copier le nom" :
                                     "Copier l'ID";
                        this.innerHTML = `<i class="fas fa-copy"></i> ${label}`;
                    }, 2000);
                }).catch(() => {
                    const input = document.createElement('input');
                    input.value = text;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    this.style.background = '#e6f7ee';
                    this.style.color = '#156FE6';
                    this.innerHTML = '<i class="fas fa-check"></i> Copié !';
                    setTimeout(() => {
                        this.style.background = '#f8f9fc';
                        this.style.color = '#6b7280';
                        const label = this.textContent.includes('email') ? "Copier l'email" :
                                     this.textContent.includes('nom') ? "Copier le nom" :
                                     "Copier l'ID";
                        this.innerHTML = `<i class="fas fa-copy"></i> ${label}`;
                    }, 2000);
                });
            });
        });
    }

    // ============================================================
    // FILTRES
    // ============================================================

    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderUsers();
            const firstUser = document.querySelector('.user-item');
            if (firstUser) {
                const id = parseInt(firstUser.dataset.id);
                selectedId = id;
                renderUsers();
                renderDetail(id);
            } else {
                selectedId = null;
                emptyDetail.style.display = 'flex';
                detailContainer.style.display = 'none';
            }
        });
    });

    // ============================================================
    // RAFRAÎCHIR
    // ============================================================

    refreshBtn.addEventListener('click', function() {
        loadData();
    });

    // ============================================================
    // AUTO-REFRESH
    // ============================================================

    setInterval(loadData, 30000);

    // ============================================================
    // INIT
    // ============================================================

    loadData();

    console.log('✅ admin.js initialisé');

});