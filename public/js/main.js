// Main application logic using jQuery and AJAX

$(document).ready(function () {

    // --- 1. Global Setup & Utilities ---
    const API_BASE = '/api';

    // Check if we're on the app page to fetch initial data
    if (window.location.pathname.includes('app.html')) {
        checkAuth();
    }

    // Handle "Remember Me" email pre-fill on login page
    if (window.location.pathname.includes('login.html') || window.location.pathname === '/') {
        const cookies = document.cookie.split(';');
        let rememberedEmail = '';
        cookies.forEach(c => {
            if (c.trim().startsWith('rememberedEmail=')) {
                rememberedEmail = decodeURIComponent(c.trim().substring('rememberedEmail='.length));
            }
        });
        if (rememberedEmail) {
            $('#email').val(rememberedEmail);
            $('#remember').prop('checked', true);
        }
    }

    // Show alert messages
    function showAlert(id, message, type = 'danger') {
        const $alert = $(id);
        $alert.removeClass('alert-danger alert-success alert-warning d-none')
            .addClass(`alert-${type}`)
            .text(message);

        // Auto hide after 5 seconds
        if (type !== 'danger') {
            setTimeout(() => {
                $alert.addClass('d-none');
            }, 5000);
        }
    }

    // --- 2. Authentication Flow ---

    $('#signup-form').on('submit', function (e) {
        e.preventDefault();
        const data = {
            name: $('#name').val(),
            email: $('#email').val(),
            password: $('#password').val()
        };

        if (data.password.length < 6) {
            showAlert('#signup-alert', 'Password must be at least 6 characters.');
            return;
        }

        $.ajax({
            url: `${API_BASE}/signup`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (res) {
                if (res.success) window.location.href = '/login.html';
            },
            error: function (err) {
                showAlert('#signup-alert', err.responseJSON ? err.responseJSON.message : 'Signup failed');
            }
        });
    });

    $('#login-form').on('submit', function (e) {
        e.preventDefault();
        const data = {
            email: $('#email').val(),
            password: $('#password').val(),
            remember: $('#remember').is(':checked')
        };

        $.ajax({
            url: `${API_BASE}/login`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (res) {
                if (res.success) window.location.href = '/app.html';
            },
            error: function (err) {
                showAlert('#login-alert', err.responseJSON ? err.responseJSON.message : 'Login failed');
            }
        });
    });

    $('#btn-logout').on('click', function () {
        $.post(`${API_BASE}/logout`, function () {
            window.location.href = '/login.html';
        });
    });

    // --- 3. Main App Logic ---

    let expensesData = [];
    let currentUser = null;

    function checkAuth() {
        $.get(`${API_BASE}/user`)
            .done(function (res) {
                if (res.success && res.user) {
                    currentUser = res.user;
                    $('#profile-name').text(currentUser.name);
                    $('#profile-email').text(currentUser.email);
                    loadExpenses();
                }
            })
            .fail(function () {
                window.location.href = '/login.html';
            });
    }

    function loadExpenses(categoryFilter = '', typeFilter = '') {
        let url = `${API_BASE}/expenses?`;
        if (categoryFilter) url += `category=${encodeURIComponent(categoryFilter)}&`;
        if (typeFilter) url += `type=${encodeURIComponent(typeFilter)}`;

        $.get(url)
            .done(function (res) {
                if (res.success) {
                    expensesData = res.expenses;
                    $('#profile-count').text(expensesData.length);
                    renderDashboard();
                    renderHistoryTable();
                    renderAnalysis();
                }
            })
            .fail(function () {
                showAlert('#global-alert', 'Error fetching data');
            });
    }

    $('.nav-link').on('click', function () {
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
        
        const targetId = $(this).data('target');
        $('.app-section').removeClass('active');
        $(`#${targetId}`).addClass('active');
        
        $('#page-title').text($(this).text().trim());

        if (window.innerWidth <= 768) $('.sidebar').removeClass('show-nav');
    });

    $('#toggle-sidebar').on('click', function () {
        $('.sidebar').toggleClass('show-nav');
    });

    // --- 4. Render Functions ---

    function formatCurrency(amount) {
        return '₹' + amount.toLocaleString('en-IN');
    }

    function renderDashboard() {
        let totalIncome = 0;
        let totalExpense = 0;

        const $recentList = $('#recent-transactions-list');
        $recentList.empty();

        expensesData.forEach((exp, index) => {
            const isInc = exp.type === 'income';
            if (isInc) totalIncome += exp.amount;
            else totalExpense += exp.amount;

            if (index < 5) {
                $recentList.append(`
                    <li class="list-group-item d-flex justify-content-between align-items-center px-0 py-3 border-bottom">
                        <div class="d-flex align-items-center">
                            <div class="card-icon bg-light me-3" style="width: 40px; height: 40px; font-size: 1.2rem;">
                                ${getCategoryIcon(exp.category, exp.type)}
                            </div>
                            <div>
                                <h6 class="mb-0 fw-bold">${exp.category} <span class="badge ${isInc ? 'bg-success' : 'bg-danger'} ms-2">${exp.type || 'expense'}</span></h6>
                                <small class="text-muted">${new Date(exp.date).toLocaleDateString()}</small>
                            </div>
                        </div>
                        <span class="fw-bold ${isInc ? 'text-success' : 'text-danger'}">${isInc ? '+' : '-'}${formatCurrency(exp.amount)}</span>
                    </li>
                `);
            }
        });

        if (expensesData.length === 0) {
            $recentList.append('<li class="list-group-item px-0 text-center text-muted border-0">No recent transactions</li>');
        }

        const netBalance = totalIncome - totalExpense;

        $('.d-total-inc').text(formatCurrency(totalIncome));
        $('.d-total-exp').text(formatCurrency(totalExpense));
        
        const $bLeft = $('.d-net-bal');
        $bLeft.text(formatCurrency(netBalance));
        
        if (netBalance < 0) {
            $bLeft.removeClass('text-success').addClass('text-danger');
        } else {
            $bLeft.removeClass('text-danger').addClass('text-success');
        }
    }

    function getCategoryIcon(cat, type) {
        if (type === 'income') {
            return '<i class="fa-solid fa-money-bill-trend-up text-success"></i>';
        }
        switch (cat) {
            case 'Food': return '<i class="fa-solid fa-utensils text-danger"></i>';
            case 'Travel': return '<i class="fa-solid fa-car text-danger"></i>';
            case 'Shopping': return '<i class="fa-solid fa-bag-shopping text-danger"></i>';
            case 'Bills': return '<i class="fa-solid fa-file-invoice-dollar text-danger"></i>';
            default: return '<i class="fa-solid fa-tag text-danger"></i>';
        }
    }

    function renderHistoryTable() {
        const $tbody = $('#expense-table-body');
        $tbody.empty();

        if (expensesData.length === 0) {
            $tbody.append('<tr><td colspan="6" class="text-center py-4 text-muted border-0">No transactions found.</td></tr>');
            return;
        }

        expensesData.forEach(exp => {
            const dateStr = new Date(exp.date).toLocaleDateString();
            const isInc = exp.type === 'income';
            $tbody.append(`
                <tr>
                    <td>${dateStr}</td>
                    <td><span class="badge ${isInc ? 'bg-success' : 'bg-danger'}">${exp.type || 'expense'}</span></td>
                    <td><span class="badge bg-light text-dark border">${exp.category}</span></td>
                    <td>${exp.description || '-'}</td>
                    <td class="fw-bold ${isInc ? 'text-success' : 'text-danger'}">${isInc ? '+' : '-'}${formatCurrency(exp.amount)}</td>
                    <td>
                        <button class="btn btn-sm btn-light me-1 btn-edit" data-id="${exp._id}">
                            <i class="fa-solid fa-pen text-primary"></i>
                        </button>
                        <button class="btn btn-sm btn-light btn-delete" data-id="${exp._id}">
                            <i class="fa-solid fa-trash text-danger"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    }



    function renderAnalysis() {
        let expenseCatTotals = {};
        let totalExpense = 0;
        
        // Filter only expenses for the charts
        const onlyExpenses = expensesData.filter(e => (e.type || 'expense') === 'expense');

        onlyExpenses.forEach(exp => {
            if (!expenseCatTotals[exp.category]) expenseCatTotals[exp.category] = 0;
            expenseCatTotals[exp.category] += exp.amount;
            totalExpense += exp.amount;
        });

        // == Rendering Bar Graph ==
        const $bars = $('#analysis-bars');
        $bars.empty();

        if (totalExpense === 0) {
            $bars.append('<p class="text-muted text-center py-4">No expense data to analyze</p>');
            $('#pie-chart-container').hide();
            $('#pie-chart-legend').hide();
            return;
        } else {
            $('#pie-chart-container').show();
            $('#pie-chart-legend').show();
        }

        // Generate Colors
        const colors = ['#f97316', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#eab308'];
        let colorIdx = 0;
        
        let conicString = "";
        let currentDeg = 0;
        
        const $legend = $('#pie-chart-legend');
        $legend.empty();

        for (const [cat, amount] of Object.entries(expenseCatTotals)) {
            const percentage = ((amount / totalExpense) * 100);
            const color = colors[colorIdx % colors.length];
            
            // Bar graph HTML
            $bars.append(`
                <div class="mb-4">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="fw-bold">${cat}</span>
                        <span class="text-muted">${percentage.toFixed(1)}% (${formatCurrency(amount)})</span>
                    </div>
                    <div class="progress" style="height: 10px;">
                        <div class="progress-bar" role="progressbar" style="width: ${percentage}%; background-color: ${color};" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                </div>
            `);

            // Pie chart math (degrees)
            const degrees = (percentage / 100) * 360;
            conicString += `${color} ${currentDeg}deg ${currentDeg + degrees}deg, `;
            currentDeg += degrees;
            
            // Pie chart legend
            $legend.append(`
                <div class="d-flex align-items-center">
                    <div style="width: 15px; height: 15px; background-color: ${color}; border-radius: 3px; margin-right: 5px;"></div>
                    <small>${cat}</small>
                </div>
            `);
            
            colorIdx++;
        }

        // Apply Conic Gradient to Pie Chart
        conicString = conicString.slice(0, -2); // remove last comma
        $('#pie-chart-container').css('background', `conic-gradient(${conicString})`);
    }

    // --- 5. CRUD Actions ---

    $('#filter-form').on('submit', function (e) {
        e.preventDefault();
        const typeFilter = $('#filter-type').val();
        const catFilter = $('#filter-category').val();
        loadExpenses(catFilter, typeFilter);
    });

    $('#btn-clear-filter').on('click', function () {
        $('#filter-type').val('');
        $('#filter-category').val('');
        loadExpenses();
    });

    // Populate modal depending on type
    $('#addExpenseModal').on('show.bs.modal', function (e) {
        // Only set type if triggered by button, not via edit (which is done via JS explicitly)
        if(e.relatedTarget) {
            const type = $(e.relatedTarget).data('type') || 'expense';
            $('#exp-type').val(type);
            $('#expenseModalTitle').text(type === 'income' ? 'Add Income' : 'Add Expense');
            
            const $catSelect = $('#exp-category');
            $catSelect.empty();
            
            if(type === 'income') {
                $catSelect.append(`
                    <option value="Salary">Salary</option>
                    <option value="Gift">Gift</option>
                    <option value="Investment">Investment</option>
                    <option value="Rental">Rental</option>
                    <option value="Other Income">Other Income</option>
                `);
            } else {
                $catSelect.append(`
                    <option value="Food">Food</option>
                    <option value="Travel">Travel</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Bills">Bills</option>
                    <option value="Other">Other</option>
                `);
            }
        }
    });

    $('#addExpenseModal').on('hidden.bs.modal', function () {
        $('#expense-form')[0].reset();
        $('#exp-id').val('');
    });

    $('#expense-form').on('submit', function (e) {
        e.preventDefault();

        const id = $('#exp-id').val();
        const data = {
            type: $('#exp-type').val(),
            amount: Number($('#exp-amount').val()),
            category: $('#exp-category').val(),
            date: $('#exp-date').val(),
            description: $('#exp-description').val()
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/expenses/${id}` : `${API_BASE}/expenses`;

        $.ajax({
            url: url,
            method: method,
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (res) {
                if (res.success) {
                    $('#addExpenseModal').modal('hide');
                    $('#expense-form')[0].reset();
                    $('#exp-id').val('');

                    $('#global-alert')
                        .removeClass('d-none alert-danger')
                        .addClass('alert-success')
                        .text(`Transaction ${id ? 'updated' : 'added'} successfully!`)
                        .show();

                    setTimeout(() => $('#global-alert').hide(), 3000);

                    const typeFilter = $('#filter-type').val();
                    const catFilter = $('#filter-category').val();
                    loadExpenses(catFilter, typeFilter);
                }
            },
            error: function () {
                alert('Error saving transaction.');
            }
        });
    });

    $(document).on('click', '.btn-delete', function () {
        if (confirm('Are you sure you want to delete this transaction?')) {
            const id = $(this).data('id');
            $.ajax({
                url: `${API_BASE}/expenses/${id}`,
                method: 'DELETE',
                success: function (res) {
                    if (res.success) {
                        const typeFilter = $('#filter-type').val();
                        const catFilter = $('#filter-category').val();
                        loadExpenses(catFilter, typeFilter);

                        $('#global-alert')
                            .removeClass('d-none alert-danger')
                            .addClass('alert-success')
                            .text('Transaction deleted successfully!')
                            .show();

                        setTimeout(() => $('#global-alert').hide(), 3000);
                    }
                }
            });
        }
    });

    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        const exp = expensesData.find(e => e._id === id);
        if (exp) {
            $('#exp-id').val(exp._id);
            const type = exp.type || 'expense';
            $('#exp-type').val(type);
            $('#expenseModalTitle').text(type === 'income' ? 'Edit Income' : 'Edit Expense');
            
            // Re-populate categories
            const $catSelect = $('#exp-category');
            $catSelect.empty();
            if(type === 'income') {
                $catSelect.append('<option value="Salary">Salary</option><option value="Gift">Gift</option><option value="Investment">Investment</option><option value="Rental">Rental</option><option value="Other Income">Other Income</option>');
            } else {
                $catSelect.append('<option value="Food">Food</option><option value="Travel">Travel</option><option value="Shopping">Shopping</option><option value="Bills">Bills</option><option value="Other">Other</option>');
            }

            $('#exp-amount').val(exp.amount);
            $('#exp-category').val(exp.category);
            $('#exp-date').val(new Date(exp.date).toISOString().split('T')[0]);
            $('#exp-description').val(exp.description || '');

            $('#addExpenseModal').modal('show');
        }
    });

    $('#contact-form').on('submit', function (e) {
        e.preventDefault();
        $.post(`${API_BASE}/contact`, function (res) {
            if (res.success) {
                $('#contact-form')[0].reset();
                $('#global-alert')
                    .removeClass('d-none alert-danger')
                    .addClass('alert-success')
                    .text(res.message)
                    .show();
                setTimeout(() => $('#global-alert').hide(), 3000);
            }
        });
    });

});
