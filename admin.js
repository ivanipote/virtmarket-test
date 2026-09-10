// ================================================================
// admin.js - Logique du tableau de bord admin
// VERSION : 8.0 - Avec overlay de connexion
// ================================================================

document.addEventListener('DOMContentLoaded', function() {

    console.log('✅ admin.js chargé');

    // ============================================================
    // 1. GESTION DE LA CONNEXION
    // ============================================================

    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    const loginUser = document.getElementById('loginUser');
    const loginPass = document.getElementById('loginPass');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');

    // ✅ Vérifier si l'utilisateur est déjà connecté (session)
    // Pour l'instant, on utilise une variable en mémoire
    let isAuthenticated = false;

    // ✅ Fonctions de l'overlay
    function showLoginError(message) {
        loginError.textContent = message || '❌ Identifiants incorrects';
        loginError.className = 'login-error show';
    }

    function hideLoginError() {
        loginError.className = 'login-error';
    }

    function showLoginOverlay() {
        loginOverlay.classList.remove('hidden');
        loginUser.value = '';
        loginPass.value = '';
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter';
        hideLoginError();
        loginUser.focus();
    }

    function hideLoginOverlay() {
        loginOverlay.classList.add('hidden');
    }

    // ✅ Vérifier les identifiants
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideLoginError();

        const username = loginUser.value.trim();
        const password = loginPass.value.trim();

        if (!username || !password) {
            showLoginError('❌ Veuillez remplir tous les champs');
            return;
        }

        // Désactiver le bouton
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner"></span> Vérification...';

        try {
            const response = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // ✅ Connexion réussie
                isAuthenticated = true;
                console.log('✅ Connexion admin réussie');
                hideLoginOverlay();
                // Charger les données
                loadData();
            } else {
                // ❌ Échec
                showLoginError(data.error || '❌ Identifiants incorrects');
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter';
                loginUser.focus();
                loginUser.select();
            }
        } catch (error) {
            console.error('❌ Erreur connexion:', error);
            showLoginError('❌ Erreur de connexion au serveur');
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter';
        }
    });

    // ✅ Effacer l'erreur en tapant
    loginUser.addEventListener('input', hideLoginError);
    loginPass.addEventListener('input', hideLoginError);

    // ✅ Afficher l'overlay au chargement
    showLoginOverlay();

    // ============================================================
    // 2. RÉFÉRENCES DU DASHBOARD
    // ============================================================

    const usersList = document.getElementById('usersList');
    const emptyUsers = document.getElementById('emptyUsers');
    const emptyDetail = document.getElementById('emptyDetail');
    const detailContent = document.getElementById('detailContent');
    const detailsBody = document.getElementById('detailsBody');
    const paymentsList = document.getElementById('paymentsList');
    const emptyPayments = document.getElementById('emptyPayments');
    const paymentsContent = document.getElementById('paymentsContent');
    const refreshBtn = document.getElementById('refreshBtn');

    const statTotal = document.getElementById('statTotal');
    const countAll = document.getElementById('countAll');
    const countVisiteur = document.getElementById('countVisiteur');
    const countParticipant = document.getElementById('countParticipant');
    const countDonateur = document.getElementById('countDonateur');
    const sidebarCount = document.getElementById('sidebarCount');
    const paymentsCount = document.getElementById('paymentsCount');

    const filterBtns = document.querySelectorAll('.filter-btn');

    let allUsers = [];
    let selectedId = null;
    let currentFilter = 'all';
    let allOrders = [];
    let allPayments = [];

    const statusColors = {
        'visiteur': '#eab308',
        'participant': '#3b82f6',
        'donateur': '#22c55e'
    };

    const statusLabels = {
        'visiteur': { label: 'Visiteur', class: 'visiteur' },
        'participant': { label: 'Participant', class: 'participant' },
        'donateur': { label: 'Donateur', class: 'donateur' }
    };

    // ============================================================
    // 3. MÉTHODES DE PAIEMENT - MAPPING
    // ============================================================

    const methodLabels = {
        'wave': 'Wave',
        'orange': 'Orange Money',
        'mtn': 'MTN MoMo',
        'moov': 'Moov Money',
        'mtn_momo': 'MTN MoMo',
        'orange_money': 'Orange Money',
        'moov_money': 'Moov Money'
    };

    const methodIcons = {
        'wave': '/wave.png',
        'orange': '/om.png',
        'mtn': '/mtn.png',
        'moov': '/moov.png',
        'mtn_momo': '/mtn.png',
        'orange_money': '/om.png',
        'moov_money': '/moov.png'
    };

    const methodClasses = {
        'wave': 'wave',
        'orange': 'orange',
        'mtn': 'mtn',
        'moov': 'moov',
        'mtn_momo': 'mtn',
        'orange_money': 'orange',
        'moov_money': 'moov'
    };

    // ============================================================
    // 4. REDIMENSIONNEMENT DES CADRES
    // ============================================================

    function setupResize(handleId, targetId, minWidth = 200, maxWidth = 600) {
        const handle = document.getElementById(handleId);
        const target = document.getElementById(targetId);

        if (!handle || !target) return;

        let isResizing = false;

        handle.addEventListener('mousedown', function(e) {
            isResizing = true;
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', function(e) {
            if (!isResizing) return;

            const rect = target.getBoundingClientRect();
            const newWidth = e.clientX - rect.left;

            if (newWidth >= minWidth && newWidth <= maxWidth) {
                target.style.width = newWidth + 'px';
                target.style.flex = 'none';
            }
        });

        document.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    setupResize('resizeHandle2', 'cadreDetails', 200, 800);
    setupResize('resizeHandle3', 'cadrePayments', 200, 800);

    // ============================================================
    // 5. CHARGER LES DONNÉES
    // ============================================================

    async function loadData() {
        try {
            const usersRes = await fetch('/api/users');
            const usersData = await usersRes.json();

            const ordersRes = await fetch('/api/paylist');
            const ordersData = await ordersRes.json();

            const paymentsRes = await fetch('/api/payments');
            const paymentsData = await paymentsRes.json();

            if (usersData.success && usersData.users) {
                allUsers = usersData.users;
            }

            if (ordersData.success && ordersData.orders) {
                allOrders = ordersData.orders;
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
                renderPayments(selectedId);
            } else if (selectedId) {
                const exists = allUsers.some(u => u.id === selectedId);
                if (!exists && allUsers.length > 0) {
                    selectedId = allUsers[0].id;
                    renderDetail(selectedId);
                    renderPayments(selectedId);
                } else if (exists) {
                    renderDetail(selectedId);
                    renderPayments(selectedId);
                }
            }
        } catch (error) {
            console.error('❌ Erreur chargement:', error);
        }
    }

    // ============================================================
    // 6. STATS
    // ============================================================

    function renderStats() {
        const totalAmount = allPayments
            .filter(p => p.status === 'success')
            .reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);
        statTotal.textContent = totalAmount + ' FCFA';
    }

    // ============================================================
    // 7. FILTRES
    // ============================================================

    function renderFilters() {
        const visiteurs = allUsers.filter(u => u.calculated_status === 'visiteur');
        const participants = allUsers.filter(u => u.calculated_status === 'participant');
        const donateurs = allUsers.filter(u => u.calculated_status === 'donateur');

        countAll.textContent = allUsers.length;
        countVisiteur.textContent = visiteurs.length;
        countParticipant.textContent = participants.length;
        countDonateur.textContent = donateurs.length;
    }

    // ============================================================
    // 8. RÉCUPÉRER LES COMMANDES/PALEMENTS
    // ============================================================

    function getOrdersByEmail(email) {
        return allOrders.filter(o => o.email === email);
    }

    function getPaymentsByEmail(email) {
        return allPayments.filter(p => p.email === email || p.user_email === email);
    }

    // ============================================================
    // 9. AFFICHER LES UTILISATEURS (CADRE 1)
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

            let badgeHtml = '';
            if (status === 'visiteur') {
                badgeHtml = `<span class="user-badge visiteur">Visiteur</span>`;
            } else if (status === 'participant') {
                badgeHtml = `<span class="user-badge participant">Participant</span>`;
            } else if (status === 'donateur') {
                badgeHtml = `<span class="user-badge donateur">Donateur</span>`;
            }

            return `
                <div class="user-item ${isActive ? 'active' : ''}" data-id="${u.id}">
                    <span class="avatar" style="background:${statusColors[status] || '#6b7280'};">${initial}</span>
                    <span class="status-dot ${status}"></span>
                    <span class="user-name">${name}</span>
                    ${badgeHtml}
                </div>
            `;
        }).join('');

        document.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                selectedId = id;
                renderUsers();
                renderDetail(id);
                renderPayments(id);
            });
        });
    }

    // ============================================================
    // 10. AFFICHER LE DÉTAIL (CADRE 2)
    // ============================================================

    function renderDetail(id) {
        const user = allUsers.find(u => u.id === id);
        if (!user) {
            emptyDetail.style.display = 'flex';
            detailContent.style.display = 'none';
            return;
        }

        emptyDetail.style.display = 'none';
        detailContent.style.display = 'block';

        const status = user.calculated_status || 'visiteur';
        const name = user.name || 'Anonyme';
        const email = user.email || 'Non renseigné';
        const createdAt = user.created_at ? new Date(user.created_at) : null;
        const updatedAt = user.updated_at ? new Date(user.updated_at) : null;

        const intention = user.flex3 || null;
        const statusInfo = statusLabels[status] || statusLabels.visiteur;

        const userOrders = getOrdersByEmail(email);
        const userPayments = getPaymentsByEmail(email);
        const successPayments = userPayments.filter(p => p.status === 'success');
        const totalAmount = successPayments.reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);
        const totalOrders = userOrders.length;
        const totalPending = userOrders.filter(o => o.status === 'pending').length;

        const formatDate = (date) => {
            if (!date) return '-';
            return new Date(date).toLocaleDateString('fr-FR') + ' ' + 
                   new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        };

        // Dernière méthode utilisée
        let lastMethod = null;
        if (successPayments.length > 0) {
            const lastPayment = successPayments[0];
            lastMethod = lastPayment.payment_method || lastPayment.flex4 || 'wave';
        } else if (userOrders.length > 0) {
            const lastOrder = userOrders[0];
            lastMethod = lastOrder.flex4 || 'wave';
        }

        const methodKey = lastMethod || 'wave';
        const methodLabel = methodLabels[methodKey] || 'Wave';
        const methodIcon = methodIcons[methodKey] || '/wave.png';
        const methodClass = methodClasses[methodKey] || 'wave';

        let methodHtml = '';
        if (lastMethod) {
            const isMtn = methodClass === 'mtn';
            methodHtml = `
                <span class="method-badge ${methodClass}">
                    <img src="${methodIcon}" alt="${methodLabel}" class="method-logo" />
                    ${methodLabel}
                </span>
            `;
        } else {
            methodHtml = '<span style="color:#9ca3af;font-weight:400;">Aucune</span>';
        }

        // ✅ EMAIL STATUS
        const emailStatus = user.flex1 || null;
        const emailMessage = user.flex2 || null;

        let emailStatusHtml = '';
        let emailStatusClass = '';
        let emailStatusIcon = '';
        if (emailStatus === 'succes') {
            emailStatusHtml = 'Envoyé avec succès';
            emailStatusClass = 'success';
            emailStatusIcon = '✅';
        } else if (emailStatus === 'echec') {
            emailStatusHtml = 'Échec';
            emailStatusClass = 'error';
            emailStatusIcon = '❌';
        } else {
            emailStatusHtml = 'Non envoyé';
            emailStatusClass = 'pending';
            emailStatusIcon = '⏳';
        }

        const emailDate = updatedAt ? formatDate(updatedAt) : '-';

        detailContent.innerHTML = `
            <div class="detail-content">

                <div class="detail-section">
                    <div class="section-title">Identité</div>
                    <div class="detail-row">
                        <span class="label">Nom</span>
                        <span class="value">${name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Email</span>
                        <span class="value">${email}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Statut</span>
                        <span class="value"><span class="badge ${statusInfo.class}">${statusInfo.label}</span></span>
                    </div>
                </div>

                <div class="detail-section">
                    <div class="section-title">Finances</div>
                    <div class="detail-row">
                        <span class="label">Total payé</span>
                        <span class="value amount-value">${totalAmount} FCFA</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Commandes</span>
                        <span class="value">${totalOrders}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">En attente</span>
                        <span class="value">${totalPending}</span>
                    </div>
                    ${intention ? `
                        <div class="detail-row">
                            <span class="label">Intention initiale</span>
                            <span class="value" style="color:#6b7280;font-weight:400;">${intention} FCFA</span>
                        </div>
                    ` : ''}
                </div>

                <div class="detail-section">
                    <div class="section-title">Méthode de paiement</div>
                    <div class="detail-row">
                        <span class="label">Dernière méthode</span>
                        <span class="value">${methodHtml}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Inscription</span>
                        <span class="value">${formatDate(createdAt)}</span>
                    </div>
                </div>

                <div class="detail-section" style="border-left: 3px solid ${emailStatus === 'succes' ? '#22c55e' : emailStatus === 'echec' ? '#dc3545' : '#f59e0b'};">
                    <div class="section-title">
                        <i class="fas fa-envelope"></i> Email de remerciement
                    </div>
                    <div class="detail-row">
                        <span class="label">Statut</span>
                        <span class="value" style="color:${emailStatus === 'succes' ? '#0e7a49' : emailStatus === 'echec' ? '#c0342a' : '#b45309'};">
                            ${emailStatusIcon} ${emailStatusHtml}
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Message</span>
                        <span class="value" style="font-weight:400;color:#6b7280;max-width:50%;font-size:12px;">${emailMessage || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Dernier envoi</span>
                        <span class="value" style="font-weight:400;color:#6b7280;font-size:12px;">${emailDate}</span>
                    </div>
                </div>

            </div>
        `;
    }

    // ============================================================
    // 11. AFFICHER LES PAIEMENTS (CADRE 3)
    // ============================================================

    function renderPayments(id) {
        const user = allUsers.find(u => u.id === id);
        if (!user) {
            emptyPayments.style.display = 'block';
            paymentsContent.style.display = 'none';
            paymentsCount.textContent = '0';
            return;
        }

        const status = user.calculated_status || 'visiteur';

        if (status === 'visiteur') {
            emptyPayments.style.display = 'block';
            emptyPayments.innerHTML = `
                <i class="fas fa-credit-card"></i>
                <p>Aucun paiement</p>
                <span style="font-size:11px;color:#d8dbe4;">Ce visiteur n'a pas encore effectué de paiement</span>
            `;
            paymentsContent.style.display = 'none';
            paymentsCount.textContent = '0';
            return;
        }

        const userOrders = getOrdersByEmail(user.email);
        const userPayments = getPaymentsByEmail(user.email);

        const allItems = [];

        userPayments.forEach(p => {
            allItems.push({
                type: 'payment',
                amount: (p.amount || 0) / 100,
                status: p.status || 'success',
                method: p.payment_method || p.flex4 || 'wave',
                date: p.created_at,
                reference: p.reference || p.transaction_id || '-'
            });
        });

        userOrders.filter(o => o.status === 'pending').forEach(o => {
            allItems.push({
                type: 'order',
                amount: o.amount || 0,
                status: 'pending',
                method: o.flex4 || 'wave',
                date: o.created_at,
                reference: o.reference || '-'
            });
        });

        allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

        paymentsCount.textContent = allItems.length;

        if (allItems.length === 0) {
            emptyPayments.style.display = 'block';
            emptyPayments.innerHTML = `
                <i class="fas fa-credit-card"></i>
                <p>Aucun paiement</p>
                <span style="font-size:11px;color:#d8dbe4;">Aucune transaction enregistrée</span>
            `;
            paymentsContent.style.display = 'none';
            return;
        }

        emptyPayments.style.display = 'none';
        paymentsContent.style.display = 'block';

        const formatDate = (date) => {
            if (!date) return '-';
            return new Date(date).toLocaleDateString('fr-FR') + ' ' + 
                   new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        };

        paymentsContent.innerHTML = `
            <table class="payments-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Montant</th>
                        <th>Méthode</th>
                        <th>Statut</th>
                        <th>Date</th>
                        <th>Référence</th>
                    </tr>
                </thead>
                <tbody>
                    ${allItems.map((item, index) => {
                        const statusClass = item.status === 'success' ? 'status-success' : 'status-pending';
                        const statusIcon = item.status === 'success' ? '✅' : '⏳';
                        const methodKey = item.method || 'wave';
                        const methodName = methodLabels[methodKey] || 'Wave';
                        const methodIcon = methodIcons[methodKey] || '/wave.png';
                        const methodClass = methodClasses[methodKey] || 'wave';

                        return `
                            <tr>
                                <td>${index + 1}</td>
                                <td class="amount-cell">${item.amount} FCFA</td>
                                <td>
                                    <div class="method-cell">
                                        <span class="method-logo ${methodClass}">
                                            <img src="${methodIcon}" alt="${methodName}" />
                                        </span>
                                        <span class="method-name ${methodClass}">${methodName}</span>
                                    </div>
                                </td>
                                <td class="${statusClass}">${statusIcon} ${item.status}</td>
                                <td class="date-cell">${formatDate(item.date)}</td>
                                <td class="ref-cell">${item.reference}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    // ============================================================
    // 12. FILTRES
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
                renderPayments(id);
            } else {
                selectedId = null;
                emptyDetail.style.display = 'flex';
                detailContent.style.display = 'none';
                emptyPayments.style.display = 'block';
                paymentsContent.style.display = 'none';
                paymentsCount.textContent = '0';
            }
        });
    });

    // ============================================================
    // 13. RAFRAÎCHIR
    // ============================================================

    refreshBtn.addEventListener('click', function() {
        if (isAuthenticated) {
            loadData();
        }
    });

    // ============================================================
    // 14. AUTO-REFRESH
    // ============================================================

    setInterval(function() {
        if (isAuthenticated) {
            loadData();
        }
    }, 30000);

    // ============================================================
    // 15. INIT
    // ============================================================

    // L'overlay est affiché par défaut
    // loadData() sera appelé après la connexion

    console.log('✅ admin.js initialisé');

});