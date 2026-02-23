
// Initialize Supabase
const supabase = window.supabase.createClient(
    "https://pespysgaqfstachvnsvr.supabase.co", 
    "sb_publishable_JA2mjXkpZxxBYjo9noU4hA_F3-h6V8d"
);

// MOCK DATASET FOR MALIQ273@GMAIL.COM (ISACC STRATEGIC GROUP)
const MOCK_DATA = {
    company: "Isaacs Strategic Group",
    branches: [
        {
            id: "b1",
            name: "Isaacs HQ (Cape Town)",
            inventoryValue: 18500.00,
            staff: [
                { id: "s1", name: "Sarah Stylist", visits: 42, sales: 8500, tips: 1200 },
                { id: "s2", name: "David Director", visits: 28, sales: 12000, tips: 2400 },
                { id: "s3", name: "Emma Junior", visits: 55, sales: 5500, tips: 400 }
            ],
            transactions: generateMockTransactions("b1", 45),
            reconLogs: generateMockRecon("b1", 10)
        },
        {
            id: "b2",
            name: "Isaacs Stellenbosch",
            inventoryValue: 12200.00,
            staff: [
                { id: "s4", name: "Liam Senior", visits: 38, sales: 7200, tips: 1100 },
                { id: "s5", name: "Chloe Colorist", visits: 31, sales: 9800, tips: 1800 }
            ],
            transactions: generateMockTransactions("b2", 45),
            reconLogs: generateMockRecon("b2", 10)
        }
    ]
};

function generateMockTransactions(branchId, count) {
    const list = [];
    const pros = branchId === "b1" ? ["Sarah Stylist", "David Director", "Emma Junior"] : ["Liam Senior", "Chloe Colorist"];
    const types = ["Cash", "Card", "Wallet", "Package"];
    for (let i = 0; i < count; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        list.push({
            date: d.toISOString().split('T')[0],
            folio: `INV-${1000 + i}`,
            professional: pros[Math.floor(Math.random() * pros.length)],
            amount: Math.random() * 800 + 200,
            type: types[Math.floor(Math.random() * types.length)],
            branchId
        });
    }
    return list;
}

function generateMockRecon(branchId, count) {
    const list = [];
    for (let i = 0; i < count; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const cash = Math.random() * 2000 + 1000;
        const card = Math.random() * 4000 + 2000;
        const total = cash + card + 500;
        const variance = Math.random() > 0.8 ? (Math.random() * 50 - 25) : 0;
        list.push({
            date: d.toISOString().split('T')[0],
            branchId,
            cash,
            card,
            wallet: 300,
            package: 200,
            total,
            variance,
            status: variance === 0 ? "Balanced" : (variance > 0 ? "Over" : "Short")
        });
    }
    return list;
}

// APP STATE
const appState = {
    selectedBranch: 'all',
    dateRange: 30, // Days
    customStart: null,
    customEnd: null,
    currentView: 'performance',
    chart: null
};

async function init() {
    // Session Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }

    // Header Setup
    document.getElementById('sidebar-company-name').textContent = MOCK_DATA.company;
    document.getElementById('user-email-sidebar').textContent = session.user.email;

    // Populate Branch Selector
    const selector = document.getElementById('branch-selector');
    MOCK_DATA.branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        opt.className = "bg-black";
        selector.appendChild(opt);
    });

    setupEventListeners();
    refreshUI();
    
    if (window.lucide) lucide.createIcons();
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const view = btn.getAttribute('data-view');
            appState.currentView = view;
            
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${view}`).classList.add('active');
            
            document.getElementById('view-title').textContent = btn.textContent.trim();
            refreshUI();
            closeMobileNav();
        };
    });

    // Branch Selector
    document.getElementById('branch-selector').onchange = (e) => {
        appState.selectedBranch = e.target.value;
        refreshUI();
    };

    // Date Filters
    document.querySelectorAll('.date-filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active-filter', 'bg-emerald-600/20'));
            btn.classList.add('active-filter', 'bg-emerald-600/20');
            appState.dateRange = parseInt(btn.getAttribute('data-days'));
            appState.customStart = null;
            document.getElementById('custom-date-range').classList.add('hidden');
            refreshUI();
        };
    });

    document.getElementById('custom-date-trigger').onclick = () => {
        document.getElementById('custom-date-range').classList.toggle('hidden');
    };

    document.getElementById('date-start').onchange = updateCustomRange;
    document.getElementById('date-end').onchange = updateCustomRange;

    // Mobile
    document.getElementById('open-mobile-btn').onclick = () => document.getElementById('mobile-nav').classList.add('open');
    document.getElementById('close-mobile-btn').onclick = closeMobileNav;
    document.getElementById('nav-close-overlay').onclick = closeMobileNav;

    // Logout
    document.getElementById('logout-btn').onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = "index.html";
    };
}

function updateCustomRange() {
    const s = document.getElementById('date-start').value;
    const e = document.getElementById('date-end').value;
    if (s && e) {
        appState.customStart = s;
        appState.customEnd = e;
        appState.dateRange = 'custom';
        refreshUI();
    }
}

function closeMobileNav() { document.getElementById('mobile-nav').classList.remove('open'); }

function getFilteredData() {
    let branches = appState.selectedBranch === 'all' 
        ? MOCK_DATA.branches 
        : MOCK_DATA.branches.filter(b => b.id === appState.selectedBranch);

    const now = new Date();
    const startDate = appState.dateRange === 'custom' 
        ? new Date(appState.customStart) 
        : new Date(now.setDate(now.getDate() - appState.dateRange));

    const endDate = appState.dateRange === 'custom' ? new Date(appState.customEnd) : new Date();

    const transactions = [];
    const reconLogs = [];
    let totalInventory = 0;

    branches.forEach(b => {
        totalInventory += b.inventoryValue;
        b.transactions.forEach(t => {
            const td = new Date(t.date);
            if (td >= startDate && td <= endDate) transactions.push(t);
        });
        b.reconLogs.forEach(r => {
            const rd = new Date(r.date);
            if (rd >= startDate && rd <= endDate) reconLogs.push(r);
        });
    });

    return { transactions, reconLogs, totalInventory, branches };
}

function refreshUI() {
    const data = getFilteredData();
    
    // Performance Tab
    if (appState.currentView === 'performance') {
        renderPerformance(data);
    } 
    // Journal Tab
    else if (appState.currentView === 'journal') {
        renderJournal(data);
    }
    // Team Tab
    else if (appState.currentView === 'team') {
        renderTeam(data);
    }
    // Recon Tab
    else if (appState.currentView === 'recon') {
        renderRecon(data);
    }

    if (window.lucide) lucide.createIcons();
}

function renderPerformance(data) {
    const totalRevenue = data.transactions.reduce((acc, t) => acc + t.amount, 0);
    const totalTips = totalRevenue * 0.12; // Simulated
    const avg = totalRevenue / (appState.dateRange === 'custom' ? 14 : appState.dateRange);

    document.getElementById('stat-revenue').textContent = `R${totalRevenue.toLocaleString()}`;
    document.getElementById('stat-tips').textContent = `R${totalTips.toLocaleString()}`;
    document.getElementById('stat-inventory').textContent = `R${data.totalInventory.toLocaleString()}`;
    document.getElementById('stat-avg').textContent = `R${avg.toLocaleString(undefined, {maximumFractionDigits:0})}`;

    // Velocity Chart
    const dailyData = {};
    data.transactions.forEach(t => {
        dailyData[t.date] = (dailyData[t.date] || 0) + t.amount;
    });

    const labels = Object.keys(dailyData).sort();
    const values = labels.map(l => dailyData[l]);

    const ctx = document.getElementById('velocityChart').getContext('2d');
    if (appState.chart) appState.chart.destroy();

    appState.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Revenue',
                data: values,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#10b981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10 } } }
            }
        }
    });
}

function renderJournal(data) {
    const body = document.getElementById('journal-body');
    body.innerHTML = '';
    data.transactions.forEach(t => {
        const branchName = MOCK_DATA.branches.find(b => b.id === t.branchId)?.name || 'Unknown';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-8 font-bold opacity-40">${t.date}</td>
            <td class="p-8 font-black">${t.folio}</td>
            <td class="p-8 opacity-70">${t.professional}</td>
            <td class="p-8 text-right font-black">R${t.amount.toFixed(2)}</td>
            <td class="p-8">
                <span class="px-3 py-1 bg-white/5 rounded-lg text-[10px] uppercase font-black">${t.type}</span>
            </td>
            <td class="p-8 text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">${branchName}</td>
        `;
        body.appendChild(row);
    });
}

function renderTeam(data) {
    const container = document.getElementById('team-stats-container');
    container.innerHTML = '';
    
    // Flatten staff and calculate totals
    const staffTotals = {};
    data.branches.forEach(b => {
        b.staff.forEach(s => {
            if (!staffTotals[s.name]) staffTotals[s.name] = { ...s, visits: 0, sales: 0, tips: 0 };
            // Filter transactions for this staff
            const staffSales = data.transactions.filter(t => t.professional === s.name);
            staffTotals[s.name].sales = staffSales.reduce((acc, t) => acc + t.amount, 0);
            staffTotals[s.name].visits = staffSales.length;
            staffTotals[s.name].tips = staffTotals[s.name].sales * 0.15;
        });
    });

    Object.values(staffTotals).forEach(s => {
        if (s.sales === 0) return;
        const card = document.createElement('div');
        card.className = "stat-card group hover:border-emerald-500/30";
        card.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-emerald-500">
                    <i data-lucide="user"></i>
                </div>
                <div class="text-right">
                    <div class="text-[10px] font-black uppercase text-emerald-500">${s.visits} Visits</div>
                </div>
            </div>
            <h4 class="text-lg font-black uppercase tracking-tighter mb-1">${s.name}</h4>
            <div class="mt-8 pt-8 border-t border-white/5 space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-[9px] font-black uppercase text-white/30">Gross Sales</span>
                    <span class="text-sm font-black tracking-tighter">R${s.sales.toLocaleString()}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[9px] font-black uppercase text-white/30">Tips Logged</span>
                    <span class="text-sm font-black tracking-tighter text-emerald-500">R${s.tips.toLocaleString()}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderRecon(data) {
    const body = document.getElementById('recon-body');
    body.innerHTML = '';
    data.reconLogs.forEach(r => {
        const branchName = MOCK_DATA.branches.find(b => b.id === r.branchId)?.name || 'Unknown';
        const row = document.createElement('tr');
        const statusColor = r.status === 'Balanced' ? 'text-emerald-500' : 'text-rose-500';
        row.innerHTML = `
            <td class="p-8 font-bold opacity-40">${r.date}</td>
            <td class="p-8 text-[10px] font-black uppercase text-white/40">${branchName}</td>
            <td class="p-8 text-right opacity-60">R${r.cash.toFixed(2)}</td>
            <td class="p-8 text-right opacity-60">R${r.card.toFixed(2)}</td>
            <td class="p-8 text-right opacity-60">R${r.wallet.toFixed(2)}</td>
            <td class="p-8 text-right opacity-60">R${r.package.toFixed(2)}</td>
            <td class="p-8 text-right font-black text-emerald-500">R${r.total.toFixed(2)}</td>
            <td class="p-8 font-black ${statusColor}">R${r.variance.toFixed(2)}</td>
            <td class="p-8"><span class="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-black uppercase ${statusColor}">${r.status}</span></td>
        `;
        body.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', init);
