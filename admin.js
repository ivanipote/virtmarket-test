// ================================================================
// admin.js - Logique du tableau de bord admin
// VERSION : 4.0 - Avec Gold et Premium
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
    const countGold = document.getElementById('countGold');
    const countPremium = document.getElementById('countPremium');

    const sidebarCount = document.getElementById('sidebarCount');
    const filterBtns = document.querySelectorAll('.filter-btn');

    let allUsers = [];
    let selectedId = null;
    let currentFilter = 'all';
    let allOrders = [];

    const statusColors = {
        'visiteur': '#eab308',
        'participant': '#3b82f6',
        'donateur': '#22c55e',
        'gold': '#a855f7',
        'premium': '#f97316'
    };

    const statusLabels = {
        'visiteur': { label: '🟡 Visiteur', class: 'visiteur' },
        'participant': { label: '🔵 Participant', class: 'participant' },
        'donateur': { label: '🟢 Donateur', class: 'donateur' },
        'gold': { label: '🟣 Gold', class: 'gold' },
        'premium': { label: '🟠 Premium', class: 'premium' }
    };

    // ============================================================
    // CHARGER LES DONNÉES
    // ============================================================

    async function loadData() {
        try {
            const usersRes = await fetch('/api/users');
            const usersData = await usersRes.json();

            const ordersRes = await fetch('/api/paylist');
            const ordersData = await ordersRes.json();

            if (usersData.success && usersData.users) {
                allUsers = usersData.users;
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
        const totalAmount = allUsers.reduce((sum, u) => {
            const payments = u.success_payments || 0;
            return sum + payments;
        }, 0);
        statTotal.textContent = totalAmount + ' FCFA';
    }

    // ============================================================
    // FILTRES
    // ============================================================

    function renderFilters() {
        const visiteurs = allUsers.filter(u => u.calculated_status === 'visiteur');
        const participants = allUsers.filter(u => u.calculated_status === 'participant');
        const donateurs = allUsers.filter(u => ['donateur', 'gold', 'premium'].includes(u.calculated_status));
        const golds = allUsers.filter(u => u.calculated_status === 'gold');
        const premiums = allUsers.filter(u => u.calculated_status === 'premium');

        countAll.textContent = allUsers.length;
        countVisiteur.textContent = visiteurs.length;
        countParticipant.textContent = participants.length;
        countDonateur.textContent = donateurs.length;
        countGold.textContent = golds.length;
        countPremium.textContent = premiums.length;
    }

    // ============================================================
    // AFFICHER LES UTILISATEURS
    // ============================================================

    function renderUsers() {
        let filtered = allUsers;

        if (currentFilter !== 'all') {
            filtered = filtered.filter(u => u.calculated_status === currentFilter);
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
            const status = u.calculated_status || 'visiteur';
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
    // RÉCUPÉRER LES COMMANDES D'UN UTILISATEUR
    // ============================================================

    function getOrdersByEmail(email) {
        return allOrders.filter(o => o.email === email);
    }

    // ============================================================
    // AFFICHER LE DÉTAIL D'UN UTILISATEUR
    // ============================================================

    async function renderDetail(id) {
        const user = allUsers.find(u => u.id === id);
        if (!user) {
            emptyDetail.style.display = 'flex';
            detailContainer.style.display = 'none';
            return;
        }

        emptyDetail.style.display = 'none';
        detailContainer.style.display = 'block';

        const status = user.calculated_status || 'visiteur';
        const name = user.name || 'Anonyme';
        const email = user.email || 'Non renseigné';
        const createdAt = user.created_at ? new Date(user.created_at) : null;
        const updatedAt = user.updated_at ? new Date(user.updated_at) : null;

        // Intention (flex3)
        const intention = user.flex3 || null;

        const statusInfo = statusLabels[status] || statusLabels.visiteur;

        // Récupérer les commandes
        const userOrders = getOrdersByEmail(email);
        const pendingOrders = userOrders.filter(o => o.status === 'pending');
        const successOrders = userOrders.filter(o => o.status === 'success');

        const formatDate = (date) => {
            if (!date) return '-';
            return new Date(date).toLocaleDateString('fr-FR') + ' ' + 
                   new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        };

        // ===== COMMANDES HTML =====
        let ordersHtml = '';
        if (userOrders.length > 0) {
            ordersHtml = `
                <div style="margin-top:16px;padding-top:12px;border-top:2px solid #f0f2f5;">
                    <div class="payment-history-title">
                        <span class="title">📦 Historique des commandes (${userOrders.length})</span>
                        <span class="total">Total : ${userOrders.reduce((sum, o) => sum + (o.amount || 0), 0)} FCFA</span>
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
                                ${userOrders.map((o, index) => {
                                    const statusClass = o.status === 'success' ? 'status-success' : 'status-pending';
                                    const statusIcon = o.status === 'success' ? '✅' : '⏳';
                                    return `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td class="amount-cell">${o.amount || 0} FCFA</td>
                                            <td class="${statusClass}">${statusIcon} ${o.status || 'pending'}</td>
                                            <td>${formatDate(o.created_at)}</td>
                                            <td class="ref-cell">${o.reference || '-'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        // ===== STATUS FOOTER =====
        let statusFooterHtml = '';
        if (status === 'visiteur') {
            statusFooterHtml = `
                <div class="status-item">
                    <span class="status-label"><i class="fas fa-clock" style="color:#eab308;"></i> En attente</span>
                    <span class="status-time pending">
                        ${formatDate(createdAt)}
                        <span class="badge pending">⏳ En attente</span>
                    </span>
                </div>
                ${intention ? `
                    <div class="status-item" style="border-top:1px solid #f0f2f5;padding-top:6px;margin-top:4px;">
                        <span class="status-label"><i class="fas fa-money-bill-wave" style="color:#eab308;"></i> Intention</span>
                        <span class="status-time" style="color:#156FE6;font-weight:700;">${intention} FCFA</span>
                    </div>
                ` : ''}
            `;
        } else if (status === 'participant') {
            statusFooterHtml = `
                <div class="status-item">
                    <span class="status-label"><i class="fas fa-link" style="color:#3b82f6;"></i> Lien généré</span>
                    <span class="status-time pending">
                        ${formatDate(updatedAt)}
                        <span class="badge pending">⏳ En attente</span>
                    </span>
                </div>
                ${pendingOrders.length > 0 ? `
                    <div class="status-item" style="border-top:1px solid #f0f2f5;padding-top:6px;margin-top:4px;">
                        <span class="status-label"><i class="fas fa-money-bill-wave" style="color:#3b82f6;"></i> Montant</span>
                        <span class="status-time" style="color:#156FE6;font-weight:700;">${pendingOrders[0].amount || 0} FCFA</span>
                    </div>
                ` : ''}
                ${intention ? `
                    <div class="status-item" style="border-top:1px solid #f0f2f5;padding-top:6px;margin-top:4px;">
                        <span class="status-label"><i class="fas fa-lightbulb" style="color:#3b82f6;"></i> Intention</span>
                        <span class="status-time" style="color:#6b7280;font-weight:400;">${intention} FCFA</span>
                    </div>
                ` : ''}
            `;
        } else if (status === 'donateur' || status === 'gold' || status === 'premium') {
            const statusIcon = status === 'gold' ? '🟣' : status === 'premium' ? '🟠' : '🟢';
            const statusName = status === 'gold' ? 'Gold' : status === 'premium' ? 'Premium' : 'Donateur';
            statusFooterHtml = `
                <div class="status-item">
                    <span class="status-label"><i class="fas fa-check-circle" style="color:${statusColors[status]};"></i> ${statusIcon} ${statusName}</span>
                    <span class="status-time success">
                        ${formatDate(updatedAt)}
                        <span class="badge success">✅ Succès</span>
                    </span>
                </div>
                ${successOrders.length > 0 ? `
                    <div class="status-item" style="border-top:1px solid #f0f2f5;padding-top:6px;margin-top:4px;">
                        <span class="status-label"><i class="fas fa-money-bill-wave" style="color:#22c55e;"></i> Total payé</span>
                        <span class="status-time" style="color:#156FE6;font-weight:700;">
                            ${successOrders.reduce((sum, o) => sum + (o.amount || 0), 0)} FCFA
                        </span>
                    </div>
                ` : ''}
                ${intention ? `
                    <div class="status-item" style="border-top:1px solid #f0f2f5;padding-top:6px;margin-top:4px;">
                        <span class="status-label"><i class="fas fa-lightbulb" style="color:#6b7280;"></i> Intention initiale</span>
                        <span class="status-time" style="color:#6b7280;font-weight:400;">${intention} FCFA</span>
                    </div>
                ` : ''}
            `;
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

                <!-- STATUS FOOTER -->
                <div class="detail-status-footer">
                    ${statusFooterHtml}
                </div>

                <!-- HISTORIQUE DES COMMANDES -->
                ${ordersHtml}

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