// ================================================================
// admin.js - Logique du tableau de bord admin
// ================================================================

document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ admin.js chargé');

    // ===== RÉFÉRENCES =====
    const usersList = document.getElementById('usersList');
    const emptyUsers = document.getElementById('emptyUsers');
    const emptyDetail = document.getElementById('emptyDetail');
    const detailContainer = document.getElementById('detailContainer');
    const refreshBtn = document.getElementById('refreshBtn');

    const statVisiteur = document.getElementById('statVisiteur');
    const statParticipant = document.getElementById('statParticipant');
    const statDonateur = document.getElementById('statDonateur');
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

    const statusColors = {
        'visiteur': '#a78bfa',
        'participant': '#fbbf24',
        'donateur': '#34d399'
    };

    const statusLabels = {
        'visiteur': { label: '🟣 Visiteur', class: 'visiteur' },
        'participant': { label: '🟠 Participant', class: 'participant' },
        'donateur': { label: '🟢 Donateur', class: 'donateur' }
    };

    // ============================================================
    // CHARGER LES DONNÉES
    // ============================================================

    async function loadData() {
        try {
            // Charger les utilisateurs
            const usersRes = await fetch('/api/users');
            const usersData = await usersRes.json();

            // Charger tous les paiements
            const paymentsRes = await fetch('/api/payments');
            const paymentsData = await paymentsRes.json();

            if (usersData.success && usersData.users) {
                allUsers = usersData.users;
            }

            if (paymentsData.success && paymentsData.payments) {
                allPayments = paymentsData.payments;
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
        const visiteurs = allUsers.filter(u => u.status === 'visiteur');
        const participants = allUsers.filter(u => u.status === 'participant');
        const donateurs = allUsers.filter(u => u.status === 'donateur');

        statVisiteur.textContent = visiteurs.length;
        statParticipant.textContent = participants.length;
        statDonateur.textContent = donateurs.length;

        // ✅ CORRECTION : Diviser par 100 (centimes → FCFA)
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
                    <div class="user-name">
                        <span class="avatar" style="background:${statusColors[status] || '#6b7280'};">${initial}</span>
                        <span class="user-status-dot ${status}"></span>
                        ${name}
                    </div>
                    <div class="user-email-small">${u.email || ''}</div>
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
    // AFFICHER LE DÉTAIL D'UN UTILISATEUR
    // ============================================================

    function renderDetail(id) {
        const user = allUsers.find(u => u.id === id);
        if (!user) {
            emptyDetail.style.display = 'block';
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

        // Récupérer les paiements de l'utilisateur
        const userPayments = getPaymentsByUser(user.id);
        const paymentsByEmail = getPaymentsByEmail(email);
        const allUserPayments = [...userPayments];
        paymentsByEmail.forEach(p => {
            if (!allUserPayments.some(up => up.transaction_id === p.transaction_id)) {
                allUserPayments.push(p);
            }
        });

        // Trier par date (plus récent en premier)
        allUserPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Statistiques
        const totalPayments = allUserPayments.length;
        const successPayments = allUserPayments.filter(p => p.status === 'success');
        
        // ✅ CORRECTION : Diviser par 100 (centimes → FCFA)
        const totalAmount = successPayments.reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);

        const formatDate = (date) => {
            if (!date) return '-';
            return new Date(date).toLocaleDateString('fr-FR') + ' ' + 
                   new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        };

        // Construction du HTML
        let paymentsHtml = '';
        if (allUserPayments.length > 0) {
            paymentsHtml = `
                <div style="margin-top:16px;padding-top:12px;border-top:2px solid #f0f2f5;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-weight:700;color:#0F1B4D;font-size:15px;">
                            💳 Historique des paiements (${totalPayments})
                        </span>
                        <span style="font-size:13px;color:#156FE6;font-weight:600;">
                            Total : ${totalAmount} FCFA
                        </span>
                    </div>
                    <div style="background:#f8f9fc;border-radius:12px;overflow:hidden;border:1px solid #e6e8ef;">
                        <table style="width:100%;border-collapse:collapse;font-size:13px;">
                            <thead>
                                <tr style="background:#f0f2f5;text-align:left;">
                                    <th style="padding:8px 12px;font-weight:600;color:#6b7280;">#</th>
                                    <th style="padding:8px 12px;font-weight:600;color:#6b7280;">Montant</th>
                                    <th style="padding:8px 12px;font-weight:600;color:#6b7280;">Statut</th>
                                    <th style="padding:8px 12px;font-weight:600;color:#6b7280;">Date</th>
                                    <th style="padding:8px 12px;font-weight:600;color:#6b7280;">Référence</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allUserPayments.map((p, index) => {
                                    const statusClass = p.status === 'success' ? '✅' : p.status === 'pending' ? '⏳' : '❌';
                                    const statusColor = p.status === 'success' ? '#0e7a49' : p.status === 'pending' ? '#b45309' : '#c0342a';
                                    // ✅ CORRECTION : Diviser par 100 pour afficher en FCFA
                                    const amountInFCFA = (p.amount || 0) / 100;
                                    return `
                                        <tr style="border-bottom:1px solid #e6e8ef;">
                                            <td style="padding:6px 12px;color:#6b7280;font-weight:600;">${index + 1}</td>
                                            <td style="padding:6px 12px;font-weight:700;color:#156FE6;">${amountInFCFA} FCFA</td>
                                            <td style="padding:6px 12px;font-weight:600;color:${statusColor};">${statusClass} ${p.status || 'inconnu'}</td>
                                            <td style="padding:6px 12px;color:#6b7280;">${formatDate(p.created_at)}</td>
                                            <td style="padding:6px 12px;font-size:11px;color:#6b7280;font-family:'Courier New',monospace;">${p.reference || p.transaction_id || '-'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            paymentsHtml = `
                <div style="margin-top:16px;padding-top:12px;border-top:2px solid #f0f2f5;text-align:center;color:#9ca3af;font-size:14px;">
                    <i class="fas fa-credit-card" style="display:block;font-size:32px;color:#d8dbe4;margin-bottom:8px;"></i>
                    Aucun paiement enregistré pour cet utilisateur.
                </div>
            `;
        }

        // Statut email
        let emailStatusHtml = '';
        if (emailStatus === 'succes') {
            emailStatusHtml = `<span class="email-status succes">✅ Envoyé</span>`;
        } else if (emailStatus === 'echec') {
            emailStatusHtml = `<span class="email-status echec">❌ Échec</span>`;
        } else {
            emailStatusHtml = `<span class="email-status inconnu">⏳ En attente</span>`;
        }

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

                <!-- STATUT FOOTER -->
                <div class="detail-status-footer">
                    ${status === 'visiteur' ? `
                        <div class="status-item">
                            <span class="status-label"><i class="fas fa-clock" style="color:#a78bfa;"></i> En attente</span>
                            <span class="status-time pending">
                                ${formatDate(createdAt)}
                                <span class="badge pending">⏳ En attente</span>
                            </span>
                        </div>
                    ` : ''}
                    ${status === 'participant' ? `
                        <div class="status-item">
                            <span class="status-label"><i class="fas fa-link" style="color:#fbbf24;"></i> Lien généré</span>
                            <span class="status-time pending">
                                ${formatDate(updatedAt)}
                                <span class="badge pending">⏳ En attente</span>
                            </span>
                        </div>
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

                <!-- HISTORIQUE DES PAIEMENTS -->
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
                emptyDetail.style.display = 'block';
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