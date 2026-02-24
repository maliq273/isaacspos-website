
// Initialize Supabase Client
const supabase = window.supabase.createClient(
    "https://pespysgaqfstachvnsvr.supabase.co", 
    "sb_publishable_JA2mjXkpZxxBYjo9noU4hA_F3-h6V8d"
);

// APP STATE
const appState = {
    user: null,
    companyId: localStorage.getItem("company_id"),
    company: { name: "Loading...", id: null },
    branches: [],
    selectedBranch: localStorage.getItem("branch_id") || 'all',
    dateRange: 30, // days
    customStart: null,
    customEnd: null,
    currentView: 'performance',
    chart: null
};

/**
 * INITIALIZATION CYCLE
 */
async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !appState.companyId) {
        window.location.href = "index.html";
        return;
    }
    
    appState.user = session.user;
    document.getElementById('user-email-sidebar').textContent = appState.user.email;

    await fetchCompanyProfile();
    await fetchBranches();
    setupEventListeners();
    refreshUI();
    
    if (window.lucide) lucide.createIcons();
}

/**
 * DATA FETCHING ENGINE
 */
async function fetchCompanyProfile() {
    // Identity handshake
    const { data, error } = await supabase
        .from('profiles')
        .select('company_name')
        .eq('id', appState.user.id)
        .single();
    
    let name = "Isaacs Strategic Group";
    if (!error && data && data.company_name) {
        name = data.company_name;
    } else if (appState.user.user_metadata && appState.user.user_metadata.company_name) {
        name = appState.user.user_metadata.company_name;
    }
    
    appState.company.name = name;
    document.getElementById('sidebar-company-name').textContent = name;
}

async function fetchBranches() {
    const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('company_id', appState.companyId);

    if (error || !data || data.length === 0) {
        console.warn("Using simulated nodes for current company context.");
        appState.branches = [
            { id: 'br-hq', name: 'Isaacs HQ (Cape Town)', inventory_value: 85000 },
            { id: 'br-st', name: 'Isaacs Stellenbosch', inventory_value: 42000 },
            { id: 'br-cl', name: 'Isaacs Claremont', inventory_value: 31000 }
        ];
    } else {
        appState.branches = data;
    }

    const selector = document.getElementById('branch-selector');
    selector.innerHTML = '<option value="all" class="bg-black">All Enterprise Branches</option>';
    
    appState.branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        opt.className = "bg-black";
        if (b.id === appState.selectedBranch) opt.selected = true;
        selector.appendChild(opt);
    });
}

/**
 * CALCULATED DATA AGGREGATION
 */
async function fetchOperationalData() {
    const { startDate, endDate } = getDateRange();

    // Query construction
    let txQuery = supabase.from('transactions').select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

    let reconQuery = supabase.from('reconciliation').select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

    // Apply branch filter
    if (appState.selectedBranch !== 'all') {
        txQuery = txQuery.eq('branch_id', appState.selectedBranch);
        reconQuery = reconQuery.eq('branch_id', appState.selectedBranch);
    } else {
        // Multi-branch context
        const branchIds = appState.branches.map(b => b.id);
        txQuery = txQuery.in('branch_id', branchIds);
        reconQuery = reconQuery.in('branch_id', branchIds);
    }

    const [txRes, reconRes] = await Promise.all([txQuery, reconQuery]);

    // Simulated fallback if table logic is not yet deployed to target Supabase
    let transactions = (txRes.data && txRes.data.length > 0) ? txRes.data : generateMockTransactions(startDate, endDate);
    let reconLogs = (reconRes.data && reconRes.data.length > 0) ? reconRes.data : generateMockRecon(startDate, endDate);

    // Calculate Dynamic Inventory Assets
    let assetValuation = 0;
    if (appState.selectedBranch === 'all') {
        assetValuation = appState.branches.reduce((acc, b) => acc + (b.inventory_value || 0), 0);
    } else {
        const branch = appState.branches.find(b => b.id === appState.selectedBranch);
        assetValuation = branch ? branch.inventory_value : 0;
    }

    return { transactions, reconLogs, assetValuation };
}

function getDateRange() {
    let start, end;
    if (appState.dateRange === 'custom') {
        start = new Date(appState.customStart);
        end = new Date(appState.customEnd);
    } else {
        end = new Date();
        start = new Date();
        start.setDate(end.getDate() - appState.dateRange);
    }
    return { startDate: start, endDate: end };
}

/**
 * UI RE-RENDER ENGINE
 */
async function refreshUI() {
    const pulse = document.getElementById('sync-pulse');
    if (pulse) pulse.classList.add('animate-ping');

    const data = await fetchOperationalData();

    if (appState.currentView === 'performance') renderPerformance(data);
    else if (appState.currentView === 'journal') renderJournal(data);
    else if (appState.currentView === 'team') renderTeam(data);
    else if (appState.currentView === 'recon') renderRecon(data);

    if (pulse) pulse.classList.remove('animate-ping');
    if (window.lucide) lucide.createIcons();
}

/**
 * VIEW: PERFORMANCE
 */
function renderPerformance(data) {
    const gross = data.transactions.reduce((acc, t) => acc + t.amount, 0);
    const tips = data.transactions.reduce((acc, t) => acc + (t.amount * 0.12), 0); // 12% mock tips
    const daysInRange = Math.max(1, Math.ceil((getDateRange().endDate - getDateRange().startDate) / (1000 * 60 * 60 * 24)));
    const dailyAvg = gross / daysInRange;

    document.getElementById('stat-revenue').textContent = `R${gross.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    document.getElementById('stat-tips').textContent = `R${tips.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    document.getElementById('stat-inventory').textContent = `R${data.assetValuation.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    document.getElementById('stat-avg').textContent = `R${dailyAvg.toLocaleString(undefined, {minimumFractionDigits:2})}`;

    renderVelocityChart(data.transactions);
}

function renderVelocityChart(txs) {
    const ctx = document.getElementById('velocityChart').getContext('2d');
    if (appState.chart) appState.chart.destroy();

    const grouped = {};
    txs.forEach(t => {
        const d = t.created_at.split('T')[0];
        grouped[d] = (grouped[d] || 0) + t.amount;
    });

    const labels = Object.keys(grouped).sort();
    const values = labels.map(l => grouped[l]);

    appState.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Revenue Yield',
                data: values,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 4,
                pointRadius: 5,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#000'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10, weight: 'bold' } } },
                x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10, weight: 'bold' } } }
            }
        }
    });
}

/**
 * VIEW: SALES JOURNAL
 */
function renderJournal(data) {
    const body = document.getElementById('journal-body');
    body.innerHTML = '';
    
    data.transactions.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).forEach(t => {
        const branch = appState.branches.find(b => b.id === t.branch_id);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-8 font-bold opacity-40">${new Date(t.created_at).toLocaleDateString()}</td>
            <td class="p-8 font-black">${t.folio_number}</td>
            <td class="p-8 opacity-70">${t.staff_name}</td>
            <td class="p-8 text-right font-black">R${t.amount.toFixed(2)}</td>
            <td class="p-8"><span class="px-3 py-1 bg-white/5 rounded-lg text-[10px] uppercase font-black">${t.payment_type}</span></td>
            <td class="p-8 text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">${branch ? branch.name : 'Unknown Branch'}</td>
        `;
        body.appendChild(row);
    });
}

/**
 * VIEW: TEAM STATS
 */
function renderTeam(data) {
    const container = document.getElementById('team-stats-container');
    container.innerHTML = '';
    
    const staffStats = {};
    data.transactions.forEach(t => {
        if (!staffStats[t.staff_name]) {
            staffStats[t.staff_name] = { name: t.staff_name, sales: 0, visits: 0, tips: 0 };
        }
        staffStats[t.staff_name].sales += t.amount;
        staffStats[t.staff_name].visits += 1;
        staffStats[t.staff_name].tips += (t.amount * 0.12);
    });

    Object.values(staffStats).forEach(s => {
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
                    <span class="text-sm font-black tracking-tighter">R${s.sales.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[9px] font-black uppercase text-white/30">Tips Logged</span>
                    <span class="text-sm font-black tracking-tighter text-emerald-500">R${s.tips.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * VIEW: RECON LOGS
 */
function renderRecon(data) {
    const body = document.getElementById('recon-body');
    body.innerHTML = '';
    
    data.reconLogs.forEach(r => {
        const branch = appState.branches.find(b => b.id === r.branch_id);
        const row = document.createElement('tr');
        const statusColor = r.status === 'Balanced' ? 'text-emerald-500' : 'text-rose-500';
        row.innerHTML = `
            <td class="p-8 font-bold opacity-40">${r.date}</td>
            <td class="p-8 text-[10px] font-black uppercase text-white/40">${branch ? branch.name : 'Unknown'}</td>
            <td class="p-8 text-right opacity-60">R${r.cash_total.toFixed(2)}</td>
            <td class="p-8 text-right opacity-60">R${r.card_total.toFixed(2)}</td>
            <td class="p-8 text-right opacity-60">R${r.wallet_total.toFixed(2)}</td>
            <td class="p-8 text-right opacity-60">R${r.package_total.toFixed(2)}</td>
            <td class="p-8 text-right font-black text-emerald-500">R${r.system_total.toFixed(2)}</td>
            <td class="p-8 font-black ${statusColor}">R${r.variance.toFixed(2)}</td>
            <td class="p-8"><span class="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-black uppercase ${statusColor}">${r.status}</span></td>
        `;
        body.appendChild(row);
    });
}

/**
 * INTERFACE CONTROLS
 */
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const view = btn.getAttribute('data-view');
            if (view === 'settings') return;

            appState.currentView = view;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(`view-${view}`).classList.add('active');
            
            document.getElementById('view-title').textContent = btn.innerText.trim();
            refreshUI();
            closeMobileNav();
        };
    });

    // Filters
    document.getElementById('branch-selector').onchange = (e) => {
        appState.selectedBranch = e.target.value;
        localStorage.setItem("branch_id", e.target.value);
        refreshUI();
    };

    document.querySelectorAll('.date-filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active-filter'));
            btn.classList.add('active-filter');
            appState.dateRange = parseInt(btn.getAttribute('data-days'));
            appState.customStart = null;
            document.getElementById('custom-date-range').classList.add('hidden');
            refreshUI();
        };
    });

    document.getElementById('custom-date-trigger').onclick = () => {
        document.getElementById('custom-date-range').classList.toggle('hidden');
    };

    const triggerCustom = () => {
        const s = document.getElementById('date-start').value;
        const e = document.getElementById('date-end').value;
        if (s && e) {
            appState.customStart = s;
            appState.customEnd = e;
            appState.dateRange = 'custom';
            refreshUI();
        }
    };
    document.getElementById('date-start').onchange = triggerCustom;
    document.getElementById('date-end').onchange = triggerCustom;

    // Mobile
    document.getElementById('open-mobile-btn').onclick = () => document.getElementById('mobile-nav').classList.add('open');
    document.getElementById('close-mobile-btn').onclick = closeMobileNav;
    document.getElementById('nav-close-overlay').onclick = closeMobileNav;

    // Logout
    document.getElementById('logout-btn').onclick = async () => {
        localStorage.clear();
        await supabase.auth.signOut();
        window.location.href = "index.html";
    };
}

function closeMobileNav() { document.getElementById('mobile-nav').classList.remove('open'); }

/**
 * MOCK DATA GENERATION
 */
function generateMockTransactions(start, end) {
    const txs = [];
    const staff = ['Sarah Stylist', 'David Director', 'Liam Senior', 'Chloe Colorist', 'Emma Junior'];
    const types = ['Cash', 'Card', 'Wallet', 'Package'];
    const branches = appState.branches.map(b => b.id);
    
    let curr = new Date(start);
    while (curr <= end) {
        const count = Math.floor(Math.random() * 12) + 15; // High volume
        for (let i = 0; i < count; i++) {
            const bId = branches[Math.floor(Math.random() * branches.length)];
            if (appState.selectedBranch !== 'all' && bId !== appState.selectedBranch) continue;
            
            txs.push({
                created_at: curr.toISOString(),
                amount: Math.random() * 1200 + 300,
                folio_number: `FOL-${10000 + txs.length}`,
                staff_name: staff[Math.floor(Math.random() * staff.length)],
                payment_type: types[Math.floor(Math.random() * types.length)],
                branch_id: bId
            });
        }
        curr.setDate(curr.getDate() + 1);
    }
    return txs;
}

function generateMockRecon(start, end) {
    const logs = [];
    const branches = appState.branches.map(b => b.id);
    let curr = new Date(start);
    while (curr <= end) {
        branches.forEach(bId => {
            if (appState.selectedBranch !== 'all' && bId !== appState.selectedBranch) return;
            const sys = Math.random() * 12000 + 8000;
            const variance = Math.random() > 0.9 ? (Math.random() * 100 - 50) : 0;
            logs.push({
                date: curr.toISOString().split('T')[0],
                branch_id: bId,
                cash_total: sys * 0.25,
                card_total: sys * 0.65,
                wallet_total: sys * 0.05,
                package_total: sys * 0.05,
                system_total: sys,
                variance: variance,
                status: variance === 0 ? 'Balanced' : (variance > 0 ? 'Over' : 'Short')
            });
        });
        curr.setDate(curr.getDate() + 1);
    }
    return logs;
}

document.addEventListener('DOMContentLoaded', init);
