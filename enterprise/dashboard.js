// IsaacsPOS Enterprise Dashboard Logic
const sb = window.supabase.createClient(
    "https://pespysgaqfstachvnsvr.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc3B5c2dhcWZzdGFjaHZuc3ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzg0NTIsImV4cCI6MjA4NjgxNDQ1Mn0.uCg80UmYLtcUvpjIV_G7bRwQqJV1f-INKOWzfcendes"
);

// State Management
let state = {
    user: null,
    company: null,
    branches: [],
    selectedBranchId: 'all',
    range: 7, 
    startDate: null,
    endDate: null,
    activeTab: 'performance',
    data: {
        sales: [],
        staff: [],
        inventory: { products: [], services: [] },
        reconLogs: []
    }
};

let revenueChart = null;

async function fetchCompany() {
    const { data, error } = await sb
        .from('companies')
        .select('*')
        .eq('user_id', state.user.id)
        .single();
    
    if (error) {
        console.error("Error fetching company:", error);
        return null;
    }
    state.company = data;
    return data;
}

async function fetchBranches() {
    if (!state.company) return;
    
    const { data, error } = await sb
        .from('branches')
        .select('*')
        .eq('company_id', state.company.id);
    
    if (error) {
        console.error("Error fetching branches:", error);
        return;
    }
    
    state.branches = data;
    
    const selector = document.getElementById('branch-selector');
    if (selector) {
        selector.innerHTML = '<option value="all">Global Matrix (All Branches)</option>';
        state.branches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.branch_name;
            selector.appendChild(opt);
        });
    }
}

function setRange(days) {
    state.range = days;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    state.startDate = start.toISOString().split('T')[0];
    state.endDate = end.toISOString().split('T')[0];
    
    document.getElementById('start-date').value = state.startDate;
    document.getElementById('end-date').value = state.endDate;
}

async function refreshData() {
    if (!state.company) return;

    const branchIds = state.selectedBranchId === 'all' 
        ? state.branches.map(b => b.id) 
        : [state.selectedBranchId];

    if (branchIds.length === 0) return;

    // Fetch Sales
    const { data: sales, error: salesError } = await sb
        .from('sales')
        .select('*, staff:staff_id(*)')
        .in('branch_id', branchIds)
        .gte('sale_date', state.startDate)
        .lte('sale_date', state.endDate);

    // Fetch Staff
    const { data: staff, error: staffError } = await sb
        .from('staff')
        .select('*')
        .in('branch_id', branchIds);

    // Fetch Recon Logs
    const { data: recon, error: reconError } = await sb
        .from('recon_logs')
        .select('*')
        .in('branch_id', branchIds)
        .gte('log_date', state.startDate)
        .lte('log_date', state.endDate);

    // Fetch Inventory (Products & Services)
    const { data: products } = await sb.from('products').select('*').in('branch_id', branchIds);
    const { data: services } = await sb.from('services').select('*').in('branch_id', branchIds);

    state.data.sales = sales || [];
    state.data.staff = staff || [];
    state.data.reconLogs = recon || [];
    state.data.inventory = { products: products || [], services: services || [] };

    renderAll();
}

function renderAll() {
    renderPerformance();
    renderJournal();
    renderTeam();
    renderRecon();
    renderSettings();
}

function renderPerformance() {
    const sales = state.data.sales;
    const totalRev = sales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
    const totalTips = sales.reduce((acc, s) => acc + (s.tip || 0), 0);
    const inventoryVal = state.data.inventory.products.reduce((acc, p) => acc + ((p.price || 0) * (p.stock || 0)), 0);
    
    updateCounter('stat-revenue', totalRev);
    updateCounter('stat-tips', totalTips);
    updateCounter('stat-inventory', inventoryVal);
    
    const days = Math.max(1, (new Date(state.endDate) - new Date(state.startDate)) / (1000 * 60 * 60 * 24));
    updateCounter('stat-avg', totalRev / days);

    updateChart(sales);
}

function renderJournal() {
    const body = document.getElementById('journal-body');
    if (!body) return;
    
    body.innerHTML = state.data.sales.map(s => `
        <tr class="table-row border-b border-white/5">
            <td class="py-4 text-white/40">#${s.id.toString().slice(-4)}</td>
            <td class="py-4">${s.sale_date}</td>
            <td class="py-4 text-emerald-500">${state.branches.find(b => b.id === s.branch_id)?.branch_name || 'N/A'}</td>
            <td class="py-4">${s.staff?.name || 'Unknown'}</td>
            <td class="py-4">${s.payment_method}</td>
            <td class="py-4">R${(s.tip || 0).toFixed(2)}</td>
            <td class="py-4 font-black">R${(s.total_amount || 0).toFixed(2)}</td>
        </tr>
    `).join('');
}

function renderTeam() {
    const container = document.getElementById('team-cards');
    if (!container) return;

    const staffStats = state.data.staff.map(member => {
        const memberSales = state.data.sales.filter(s => s.staff_id === member.id);
        const revenue = memberSales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
        const tips = memberSales.reduce((acc, s) => acc + (s.tip || 0), 0);
        return { ...member, revenue, tips, count: memberSales.length };
    });

    container.innerHTML = staffStats.map(s => `
        <div class="dashboard-card flex items-center gap-6">
            <div class="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                <i data-lucide="user" class="w-8 h-8"></i>
            </div>
            <div class="flex-1">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-black uppercase tracking-tight text-lg">${s.name}</h4>
                        <p class="text-[9px] font-black text-white/30 uppercase tracking-widest">${s.role}</p>
                    </div>
                    <div class="text-right">
                        <div class="text-emerald-500 font-black">R${s.revenue.toFixed(2)}</div>
                        <div class="text-[9px] font-black text-white/30 uppercase tracking-widest">${s.count} Sales</div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    if (window.lucide) lucide.createIcons();
}

function renderRecon() {
    const body = document.getElementById('recon-body');
    if (!body) return;

    body.innerHTML = state.data.reconLogs.map(l => `
        <tr class="table-row border-b border-white/5">
            <td class="py-4">${l.log_date}</td>
            <td class="py-4">R${(l.cash_total || 0).toFixed(2)}</td>
            <td class="py-4">R${(l.card_total || 0).toFixed(2)}</td>
            <td class="py-4">R${(l.wallet_total || 0).toFixed(2)}</td>
            <td class="py-4">R${(l.system_total || 0).toFixed(2)}</td>
            <td class="py-4 font-black ${l.variance < 0 ? 'text-red-400' : 'text-emerald-500'}">R${(l.variance || 0).toFixed(2)}</td>
            <td class="py-4">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${l.status === 'Balanced' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}">
                    ${l.status}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderSettings() {
    const info = document.getElementById('company-info');
    const list = document.getElementById('branch-list');
    if (!info || !list) return;

    info.innerHTML = `
        <div class="flex justify-between"><span>Company ID:</span> <span class="text-white">${state.company.company_id}</span></div>
        <div class="flex justify-between"><span>Owner:</span> <span class="text-white">${state.company.owner_name}</span></div>
        <div class="flex justify-between"><span>Tier:</span> <span class="text-emerald-500 font-black">${state.company['tier level']}</span></div>
        <div class="flex justify-between"><span>Status:</span> <span class="text-white">${state.company.status}</span></div>
    `;

    list.innerHTML = state.branches.map(b => `
        <div class="p-4 glass rounded-2xl flex justify-between items-center">
            <div>
                <div class="font-black uppercase text-xs">${b.branch_name}</div>
                <div class="text-[9px] text-white/30 uppercase tracking-widest">${b.location}</div>
            </div>
            <div class="text-[9px] font-black uppercase px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500">
                ${b.system_type}
            </div>
        </div>
    `).join('');
}

function updateCounter(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = `R${val.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
}

function updateChart(sales) {
    const ctx = document.getElementById('revenue-chart');
    if (!ctx) return;
    
    const dayMap = {};
    sales.forEach(s => { dayMap[s.sale_date] = (dayMap[s.sale_date] || 0) + s.total_amount; });
    
    const labels = Object.keys(dayMap).sort();
    const values = labels.map(l => dayMap[l]);

    if (revenueChart) revenueChart.destroy();
    
    revenueChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Revenue',
                data: values,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10 } } }
            }
        }
    });
}

function initUIEvents() {
    // Tab switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const tab = btn.getAttribute('data-tab');
            state.activeTab = tab;
            
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-${tab}`).classList.remove('hidden');
            
            document.getElementById('current-tab-title').textContent = btn.textContent.trim();
        };
    });

    // Branch selection
    document.getElementById('branch-selector').onchange = (e) => {
        state.selectedBranchId = e.target.value;
        refreshData();
    };

    // Range selection
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.onclick = () => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            setRange(parseInt(pill.getAttribute('data-range')));
            refreshData();
        };
    });

    // Custom date selection
    document.getElementById('start-date').onchange = (e) => {
        state.startDate = e.target.value;
        refreshData();
    };
    document.getElementById('end-date').onchange = (e) => {
        state.endDate = e.target.value;
        refreshData();
    };

    // Logout
    const lBtn = document.getElementById('logout-btn');
    if (lBtn) {
        lBtn.onclick = async () => {
            await sb.auth.signOut();
            window.location.replace("index.html");
        };
    }

    // Global Print
    document.getElementById('print-global-btn').onclick = () => window.print();
}

window.printSection = (id) => {
    const content = document.getElementById(id).innerHTML;
    const win = window.open('', '', 'height=700,width=900');
    win.document.write('<html><head><title>IsaacsPOS Report</title>');
    win.document.write('<link rel="stylesheet" href="https://cdn.tailwindcss.com">');
    win.document.write('<style>body{padding:40px; color:black !important; background:white !important;} .dashboard-card{border:1px solid #eee; padding:20px; border-radius:10px;} .hidden{display:none !important;}</style>');
    win.document.write('</head><body>');
    win.document.write('<h1 style="font-size:24px; font-weight:bold; margin-bottom:20px;">IsaacsPOS Enterprise Report</h1>');
    win.document.write(content);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
};

/**
 * PATIENT UPLINK PROTOCOL
 */
async function getAuthenticatedSession() {
    return new Promise((resolve) => {
        sb.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                resolve(session);
                return;
            }
            const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
                if (session) {
                    subscription.unsubscribe();
                    resolve(session);
                } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
                    subscription.unsubscribe();
                    resolve(null);
                }
            });
        });
    });
}

async function initDashboard() {
    const appShell = document.getElementById('main-app-shell');
    const session = await getAuthenticatedSession();

    if (!session) {
        window.location.replace("index.html");
        return;
    }

    state.user = session.user;
    if (appShell) appShell.classList.add('ready');

    await fetchCompany();
    await fetchBranches();
    setRange(7);
    await refreshData();
    initUIEvents();

    if (window.lucide) lucide.createIcons();
}

document.addEventListener("DOMContentLoaded", initDashboard);
