// IsaacsPOS Enterprise Dashboard Logic
const supabase = window.supabase.createClient(
    "https://pespysgaqfstachvnsvr.supabase.co",
    "sb_publishable_JA2mjXkpZxxBYjo9noU4hA_F3-h6V8d",
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);

// State Management
let state = {
    user: null,
    branches: [],
    selectedBranchId: 'all',
    range: 7, 
    startDate: null,
    endDate: null,
    data: {
        transactions: [],
        staff: [],
        inventory: [],
        reconLogs: []
    }
};

let revenueChart = null;

async function initDashboard() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.replace("index.html");
        return;
    }

    state.user = session.user;

    await fetchBranches();
    setRange(7);
    await refreshData();
    initUIEvents();

    if (window.lucide) lucide.createIcons();
}

    state.user = sessionResult.data.session.user;
    console.log("Access Granted: " + state.user.email);
    
    // UI Greetings
    const welcomeEl = document.getElementById('current-tab-title');
    if (welcomeEl) welcomeEl.textContent = `Node: ${state.user.email.split('@')[0].toUpperCase()}`;

    // Load Infrastructure
    await fetchBranches();
    setRange(7);
    await refreshData();
    
    // Initialize UI
    initUIEvents();
    if (window.lucide) lucide.createIcons();
}

async function fetchBranches() {
    state.branches = [
        { id: 'b1', name: 'Sandton Master Node' },
        { id: 'b2', name: 'Cape Town Waterfront' },
        { id: 'b3', name: 'Umhlanga Heights' }
    ];
    
    const selector = document.getElementById('branch-selector');
    if (selector) {
        selector.innerHTML = '<option value="all">Global Matrix (All Branches)</option>';
        state.branches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            selector.appendChild(opt);
        });
    }
}

function setRange(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    state.startDate = start.toISOString().split('T')[0];
    state.endDate = end.toISOString().split('T')[0];
    
    const sInput = document.getElementById('start-date');
    const eInput = document.getElementById('end-date');
    if (sInput) sInput.value = state.startDate;
    if (eInput) eInput.value = state.endDate;
}

async function refreshData() {
    generateMockData();
    renderAll();
}

function generateMockData() {
    const txCount = state.range === 'custom' ? 100 : state.range * 25;
    state.data.transactions = [];
    state.data.staff = [
        { id: 's1', name: 'M. Isaacs', branchId: 'b1' },
        { id: 's2', name: 'S. Adams', branchId: 'b1' },
        { id: 's3', name: 'L. Van Wyk', branchId: 'b2' },
        { id: 's4', name: 'J. Doe', branchId: 'b3' }
    ];

    for (let i = 0; i < txCount; i++) {
        const date = new Date(state.startDate);
        date.setDate(date.getDate() + Math.floor(Math.random() * (state.range || 1)));
        
        state.data.transactions.push({
            id: `FL-${5000 + i}`,
            date: date.toISOString().split('T')[0],
            amount: 500 + (Math.random() * 1500),
            tip: 50 + (Math.random() * 300),
            staffId: state.data.staff[Math.floor(Math.random() * state.data.staff.length)].id,
            branchId: state.branches[Math.floor(Math.random() * state.branches.length)].id,
            method: ['Card', 'Cash', 'Wallet', 'Package'][Math.floor(Math.random() * 4)]
        });
    }

    state.data.inventory = [
        { name: 'Professional Back-bar', value: 85000, branchId: 'b1' },
        { name: 'Retail Assets', value: 120000, branchId: 'b1' },
        { name: 'Cape Assets', value: 45000, branchId: 'b2' }
    ];

    state.data.reconLogs = state.branches.map(b => ({
        date: new Date().toISOString().split('T')[0],
        branchId: b.id,
        systemTotal: 12000 + (Math.random() * 8000),
        variance: Math.random() > 0.9 ? -250 : 0,
        status: Math.random() > 0.9 ? 'Short' : 'Balanced'
    }));
}

function renderAll() {
    let txs = state.data.transactions;
    if (state.selectedBranchId !== 'all') {
        txs = txs.filter(t => t.branchId === state.selectedBranchId);
    }

    const totalRev = txs.reduce((acc, t) => acc + t.amount, 0);
    const totalTips = txs.reduce((acc, t) => acc + t.tip, 0);
    const invValue = state.data.inventory
        .filter(i => state.selectedBranchId === 'all' || i.branchId === state.selectedBranchId)
        .reduce((acc, i) => acc + i.value, 0);
    
    updateCounter('stat-revenue', totalRev);
    updateCounter('stat-tips', totalTips);
    updateCounter('stat-inventory', invValue);
    updateCounter('stat-avg', (totalRev / (state.range || 1)));

    updateChart(txs);
    renderJournal(txs);
    renderTeam(txs);
    renderRecon();
}

function updateCounter(id, val) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = `R${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
}

function updateChart(txs) {
    const ctx = document.getElementById('revenue-chart');
    if (!ctx) return;
    
    const dayMap = {};
    txs.forEach(t => {
        dayMap[t.date] = (dayMap[t.date] || 0) + t.amount;
    });
    
    const labels = Object.keys(dayMap).sort();
    const values = labels.map(l => dayMap[l]);

    if (revenueChart) revenueChart.destroy();
    
    revenueChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Gross Daily Revenue',
                data: values,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                fill: true,
                tension: 0.3,
                borderWidth: 4,
                pointRadius: 6,
                pointBackgroundColor: '#10b981',
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.2)', font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.2)', font: { size: 10 } } }
            }
        }
    });
}

function renderJournal(txs) {
    const tbody = document.getElementById('journal-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    txs.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 100).forEach(t => {
        const staff = state.data.staff.find(s => s.id === t.staffId);
        const tr = document.createElement('tr');
        tr.className = 'table-row';
        tr.innerHTML = `
            <td class="py-5 opacity-40 text-[11px]">${t.date}</td>
            <td class="py-5 font-black uppercase tracking-tighter text-emerald-500">${t.id}</td>
            <td class="py-5 font-bold">${staff ? staff.name : 'Unknown'}</td>
            <td class="py-5"><span class="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] uppercase font-black">${t.method}</span></td>
            <td class="py-5 text-right font-black text-white">R${t.amount.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTeam(txs) {
    const grid = document.getElementById('team-stats-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const staffStats = {};
    txs.forEach(t => {
        if (!staffStats[t.staffId]) staffStats[t.staffId] = { sales: 0, tips: 0, visits: 0 };
        staffStats[t.staffId].sales += t.amount;
        staffStats[t.staffId].tips += t.tip;
        staffStats[t.staffId].visits += 1;
    });

    const card = document.createElement('div');
    card.className = 'dashboard-card';
    let html = `
        <h3 class="text-xl font-black uppercase mb-8">Staff Performance Matrix</h3>
        <table class="w-full text-left">
            <thead class="border-b border-white/5 text-[10px] font-black uppercase text-white/30 tracking-widest">
                <tr>
                    <th class="pb-4">Professional</th>
                    <th class="pb-4 text-center">Visits</th>
                    <th class="pb-4 text-center">Avg/Sale</th>
                    <th class="pb-4 text-center">Tips Logged</th>
                    <th class="pb-4 text-right">Gross Sales</th>
                </tr>
            </thead>
            <tbody class="text-sm font-medium">`;

    Object.keys(staffStats).forEach(sid => {
        const staff = state.data.staff.find(s => s.id === sid);
        const s = staffStats[sid];
        html += `
            <tr class="table-row">
                <td class="py-4 font-bold text-white">${staff ? staff.name : sid}</td>
                <td class="py-4 text-center opacity-40 font-black">${s.visits}</td>
                <td class="py-4 text-center opacity-40 font-black">R${(s.sales/s.visits).toFixed(0)}</td>
                <td class="py-4 text-center text-emerald-400 font-black">R${s.tips.toFixed(2)}</td>
                <td class="py-4 text-right font-black text-white">R${s.sales.toFixed(2)}</td>
            </tr>`;
    });

    html += `</tbody></table>`;
    card.innerHTML = html;
    grid.appendChild(card);
}

function renderRecon() {
    const tbody = document.getElementById('recon-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    state.data.reconLogs.forEach(log => {
        const branch = state.branches.find(b => b.id === log.branchId);
        if (state.selectedBranchId !== 'all' && log.branchId !== state.selectedBranchId) return;

        const tr = document.createElement('tr');
        tr.className = 'table-row';
        tr.innerHTML = `
            <td class="py-5 opacity-40 text-[11px]">${log.date}</td>
            <td class="py-5 font-bold text-white/80">${branch ? branch.name : log.branchId}</td>
            <td class="py-5 font-black text-white">R${log.systemTotal.toFixed(2)}</td>
            <td class="py-5 font-black ${log.variance < 0 ? 'text-red-400' : 'text-emerald-500'}">R${log.variance.toFixed(2)}</td>
            <td class="py-5 text-right"><span class="px-4 py-1.5 ${log.status === 'Balanced' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} rounded-full text-[9px] uppercase font-black tracking-widest">${log.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function initUIEvents() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const tab = btn.dataset.tab;
            if (tab === 'settings') return;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            const targetTab = document.getElementById(`tab-${tab}`);
            if (targetTab) targetTab.classList.remove('hidden');
            const titleEl = document.getElementById('current-tab-title');
            if (titleEl) titleEl.textContent = btn.innerText;
        };
    });

    const bSel = document.getElementById('branch-selector');
    if (bSel) {
        bSel.onchange = (e) => {
            state.selectedBranchId = e.target.value;
            refreshData();
        };
    }

    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.onclick = () => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const range = pill.dataset.range;
            const customBox = document.getElementById('custom-date-container');
            if (range === 'custom') {
                if (customBox) customBox.classList.remove('hidden');
            } else {
                if (customBox) customBox.classList.add('hidden');
                state.range = parseInt(range);
                setRange(state.range);
                refreshData();
            }
        };
    });

    const sIn = document.getElementById('start-date');
    const eIn = document.getElementById('end-date');
    if (sIn) sIn.onchange = () => {
        state.startDate = sIn.value;
        refreshData();
    };
    if (eIn) eIn.onchange = () => {
        state.endDate = eIn.value;
        refreshData();
    };

    const lBtn = document.getElementById('logout-btn');
    if (lBtn) {
        lBtn.onclick = async () => {
            await supabase.auth.signOut();
            window.location.href = "index.html";
        };
    }
}

initDashboard();
