// Initialize Supabase Client
console.log("[IsaacsPOS] Dashboard Logic Engaged");

let supabase;
try {
    supabase = window.supabase.createClient(
        "https://pespysgaqfstachvnsvr.supabase.co", 
        "sb_publishable_JA2mjXkpZxxBYjo9noU4hA_F3-h6V8d"
    );
    console.log("[IsaacsPOS] Dashboard Supabase Client Active");
} catch (err) {
    console.error("[IsaacsPOS] Dashboard Supabase Init Failed:", err);
}

// APP STATE
const appState = {
    user: null,
    company: { name: "Loading...", id: null },
    branches: [],
    selectedBranch: 'all',
    dateRange: 30,
    customStart: null,
    customEnd: null,
    currentView: 'performance',
    chart: null
};

/**
 * INITIALIZATION CYCLE
 */
async function init() {
    // 1. Session Handshake
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    
    appState.user = session.user;
    document.getElementById('user-email-sidebar').textContent = appState.user.email;

    // 2. Fetch Company Identity
    await fetchCompanyProfile();

    // 3. Fetch Branch Network
    await fetchBranches();

    // 4. Setup Global Listeners
    setupEventListeners();
    
    // 5. Initial Render
    refreshUI();
    
    if (window.lucide) lucide.createIcons();
}

/**
 * DATA FETCHING ENGINE
 */
async function fetchCompanyProfile() {
    // Try to get company name from user metadata first (fastest)
    let companyName = appState.user.user_metadata?.company_name;

    if (!companyName) {
        // Fallback to querying a profiles/companies table
        const { data, error } = await supabase
            .from('profiles')
            .select('company_name')
            .eq('id', appState.user.id)
            .single();
        
        if (!error && data) companyName = data.company_name;
    }

    // Default if nothing found
    appState.company.name = companyName || "Isaacs Strategic Group";
    document.getElementById('sidebar-company-name').textContent = appState.company.name;
}

async function fetchBranches() {
    // Query branches table for this user
    const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('owner_id', appState.user.id);

    if (error) {
        console.error("Error fetching branches:", error);
        // If table doesn't exist yet, we keep it empty or show placeholder logic
        appState.branches = [];
    } else {
        appState.branches = data || [];
    }

    const selector = document.getElementById('branch-selector');
    // Clear except "All"
    selector.innerHTML = '<option value="all" class="bg-black">All Network Nodes</option>';
    
    appState.branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        opt.className = "bg-black";
        selector.appendChild(opt);
    });
}

/**
 * RE-RENDER LOGIC
 */
async function refreshUI() {
    const data = await getFilteredStats();
    
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

/**
 * DYNAMIC STATS COMPILER
 */
async function getFilteredStats() {
    const { startDate, endDate } = getDateBounds();
    
    // We build queries based on selected branch
    let txQuery = supabase.from('transactions').select('*');
    let reconQuery = supabase.from('reconciliation').select('*');
    let staffQuery = supabase.from('staff_logs').select('*');

    if (appState.selectedBranch !== 'all') {
        txQuery = txQuery.eq('branch_id', appState.selectedBranch);
        reconQuery = reconQuery.eq('branch_id', appState.selectedBranch);
        staffQuery = staffQuery.eq('branch_id', appState.selectedBranch);
    }

    // Filter by date
    txQuery = txQuery.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
    reconQuery = reconQuery.gte('date', startDate.toISOString().split('T')[0]).lte('date', endDate.toISOString().split('T')[0]);

    // Execute queries in parallel with individual error handling
    const [txRes, reconRes, staffRes] = await Promise.all([
        txQuery.catch(err => ({ data: [], error: err })),
        reconQuery.catch(err => ({ data: [], error: err })),
        staffQuery.catch(err => ({ data: [], error: err }))
    ]);

    if (txRes.error) console.warn("Transaction fetch failed:", txRes.error);
    if (reconRes.error) console.warn("Recon fetch failed:", reconRes.error);
    if (staffRes.error) console.warn("Staff fetch failed:", staffRes.error);

    // Calculate dynamic inventory (sum of selected branches)
    const activeBranches = appState.selectedBranch === 'all' ? appState.branches : appState.branches.filter(b => b.id === appState.selectedBranch);
    const totalInventory = activeBranches.reduce((acc, b) => acc + (b.inventory_value || 0), 0);

    return {
        transactions: txRes.data || [],
        reconLogs: reconRes.data || [],
        staff: staffRes.data || [],
        totalInventory,
        branches: activeBranches
    };
}

function getDateBounds() {
    const now = new Date();
    let startDate, endDate;

    if (appState.dateRange === 'custom') {
        startDate = new Date(appState.customStart);
        endDate = new Date(appState.customEnd);
    } else {
        startDate = new Date();
        startDate.setDate(now.getDate() - appState.dateRange);
        endDate = new Date();
    }
    return { startDate, endDate };
}

/**
 * UI RENDERERS
 */
function renderPerformance(data) {
    const totalRevenue = data.transactions.reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalTips = data.staff.reduce((acc, s) => acc + (s.tips || 0), 0);
    const days = appState.dateRange === 'custom' ? 14 : appState.dateRange;
    const avg = totalRevenue / (days || 1);

    document.getElementById('stat-revenue').textContent = `R${totalRevenue.toLocaleString()}`;
    document.getElementById('stat-tips').textContent = `R${totalTips.toLocaleString()}`;
    document.getElementById('stat-inventory').textContent = `R${data.totalInventory.toLocaleString()}`;
    document.getElementById('stat-avg').textContent = `R${avg.toLocaleString(undefined, {maximumFractionDigits:0})}`;

    // Update Velocity Chart
    const dailyData = {};
    data.transactions.forEach(t => {
        const dateKey = t.created_at.split('T')[0];
        dailyData[dateKey] = (dailyData[dateKey] || 0) + t.amount;
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
    
    if (data.transactions.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="p-12 text-center text-white/20 italic">No transactions found for this period.</td></tr>';
        return;
    }

    data.transactions.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).forEach(t => {
        const branch = appState.branches.find(b => b.id === t.branch_id);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-8 font-bold opacity-40">${new Date(t.created_at).toLocaleDateString()}</td>
            <td class="p-8 font-black">${t.folio_number || 'INV-000'}</td>
            <td class="p-8 opacity-70">${t.staff_name || 'System'}</td>
            <td class="p-8 text-right font-black">R${(t.amount || 0).toFixed(2)}</td>
            <td class="p-8">
                <span class="px-3 py-1 bg-white/5 rounded-lg text-[10px] uppercase font-black">${t.payment_type || 'Card'}</span>
            </td>
            <td class="p-8 text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">${branch?.name || 'Master'}</td>
        `;
        body.appendChild(row);
    });
}

function renderTeam(data) {
    const container = document.getElementById('team-stats-container');
    container.innerHTML = '';
    
    if (data.staff.length === 0) {
        container.innerHTML = '<div class="col-span-full p-24 glass text-center text-white/20">No staff data synced for this range.</div>';
        return;
    }

    data.staff.forEach(s => {
        const card = document.createElement('div');
        card.className = "stat-card group hover:border-emerald-500/30";
        card.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-emerald-500">
                    <i data-lucide="user"></i>
                </div>
                <div class="text-right">
                    <div class="text-[10px] font-black uppercase text-emerald-500">${s.visits || 0} Visits</div>
                </div>
            </div>
            <h4 class="text-lg font-black uppercase tracking-tighter mb-1">${s.name}</h4>
            <div class="mt-8 pt-8 border-t border-white/5 space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-[9px] font-black uppercase text-white/30">Gross Sales</span>
                    <span class="text-sm font-black tracking-tighter">R${(s.gross_sales || 0).toLocaleString()}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[9px] font-black uppercase text-white/30">Tips Logged</span>
                    <span class="text-sm font-black tracking-tighter text-emerald-500">R${(s.tips || 0).toLocaleString()}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderRecon(data) {
    const body = document.getElementById('recon-body');
    body.innerHTML = '';

    if (data.reconLogs.length === 0) {
        body.innerHTML = '<tr><td colspan="9" class="p-12 text-center text-white/20 italic">No reconciliation data found.</td></tr>';
        return;
    }

    data.reconLogs.forEach(r => {
        const branch = appState.branches.find(b => b.id === r.branch_id);
        const row = document.createElement('tr');
        const statusColor = r.status === 'Balanced' ? 'text-emerald-500' : 'text-rose-500';
        row.innerHTML = `
            <td class="p-8 font-bold opacity-40">${r.date}</td>
            <td class="p-8 text-[10px] font-black uppercase text-white/40">${branch?.name || 'Unknown'}</td>
            <td class="p-8 text-right opacity-60">R${(r.cash_total || 0).toFixed(2)}</td>
            <td class="p-8 text-right opacity-60">R${(r.card_total || 0).toFixed(2)}</td>
            <td class="p-8 text-right opacity-60">R${(r.wallet_total || 0).toFixed(2)}</td>
            <td class="p-8 text-right opacity-60">R${(r.package_total || 0).toFixed(2)}</td>
            <td class="p-8 text-right font-black text-emerald-500">R${(r.system_total || 0).toFixed(2)}</td>
            <td class="p-8 font-black ${statusColor}">R${(r.variance || 0).toFixed(2)}</td>
            <td class="p-8"><span class="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-black uppercase ${statusColor}">${r.status}</span></td>
        `;
        body.appendChild(row);
    });
}

/**
 * EVENT COORDINATION
 */
function setupEventListeners() {
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

    const updateCustom = () => {
        const s = document.getElementById('date-start').value;
        const e = document.getElementById('date-end').value;
        if (s && e) {
            appState.customStart = s;
            appState.customEnd = e;
            appState.dateRange = 'custom';
            refreshUI();
        }
    };
    document.getElementById('date-start').onchange = updateCustom;
    document.getElementById('date-end').onchange = updateCustom;

    // View Switching
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

    // Mobile Navigation
    document.getElementById('open-mobile-btn').onclick = () => document.getElementById('mobile-nav').classList.add('open');
    document.getElementById('close-mobile-btn').onclick = closeMobileNav;
    document.getElementById('nav-close-overlay').onclick = closeMobileNav;

    // Logout
    document.getElementById('logout-btn').onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = "index.html";
    };
}

function closeMobileNav() { document.getElementById('mobile-nav').classList.remove('open'); }

// Initialize lifecycle
document.addEventListener('DOMContentLoaded', init);
