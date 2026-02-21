// IsaacsPOS Enterprise Dashboard Logic
const supabase = window.supabase.createClient(
    "https://pespysgaqfstachvnsvr.supabase.co", 
    "sb_publishable_JA2mjXkpZxxBYjo9noU4hA_F3-h6V8d"
);

// State Management
let state = {
    user: null,
    branches: [],
    selectedBranchId: 'all',
    range: 7, // 7, 14, 30, 'custom'
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
    // 1. Auth Check
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = "index.html";
        return;
    }
    state.user = session.user;
    document.getElementById('user-email').textContent = state.user.email;

    // 2. Fetch Core Infrastructure (Branches)
    await fetchBranches();
    
    // 3. Set Default Dates
    setRange(7);

    // 4. Initial Load
    await refreshData();
    lucide.createIcons();
    initUIEvents();
}

async function fetchBranches() {
    // Simulated fetch from 'branches' table
    state.branches = [
        { id: 'b1', name: 'Sandton Master Node' },
        { id: 'b2', name: 'Cape Town Waterfront' },
        { id: 'b3', name: 'Umhlanga Heights' }
    ];
    
    const selector = document.getElementById('branch-selector');
    state.branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        selector.appendChild(opt);
    });
}

function setRange(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    state.startDate = start.toISOString().split('T')[0];
    state.endDate = end.toISOString().split('T')[0];
    
    document.getElementById('start-date').value = state.startDate;
    document.getElementById('end-date').value = state.endDate;
}

async function refreshData() {
    // In production, these would be filtered queries to Supabase
    // We generate deterministic mock data based on the owner/branch context for this demo
    generateMockData();
    renderAll();
}

function generateMockData() {
    // Simulate high-fidelity datasets
    const txCount = state.range === 'custom' ? 50 : state.range * 15;
    state.data.transactions = [];
    state.data.staff = [
        { id: 's1', name: 'M. Isaacs', branchId: 'b1' },
        { id: 's2', name: 'S. Adams', branchId: 'b1' },
        { id: 's3', name: 'L. Van Wyk', branchId: 'b2' },
        { id: 's4', name: 'J. Doe', branchId: 'b3' }
    ];

    for (let i = 0; i < txCount; i++) {
        const date = new Date(state.startDate);
        date.setDate(date.getDate() + Math.floor(Math.random() * state.range));
        
        state.data.transactions.push({
            id: `FL-${1000 + i}`,
            date: date.toISOString().split('T')[0],
            amount: 450 + (Math.random() * 1200),
            tip: 50 + (Math.random() * 200),
            staffId: state.data.staff[Math.floor(Math.random() * state.data.staff.length)].id,
            branchId: state.branches[Math.floor(Math.random() * state.branches.length)].id,
            method: ['Card', 'Cash', 'Wallet', 'Package'][Math.floor(Math.random() * 4)]
        });
    }

    state.data.inventory = [
        { name: 'Redken Brews', value: 12500, branchId: 'b1' },
        { name: 'Kérastase Gold', value: 45000, branchId: 'b2' }
    ];

    state.data.reconLogs = state.branches.map(b => ({
        date: new Date().toISOString().split('T')[0],
        branchId: b.id,
        systemTotal: 15400,
        variance: Math.random() > 0.8 ? -150 : 0,
        status: Math.random() > 0.8 ? 'Short' : 'Balanced'
    }));
}

function renderAll() {
    // Global Filtering
    let txs = state.data.transactions;
    if (state.selectedBranchId !== 'all') {
        txs = txs.filter(t => t.branchId === state.selectedBranchId);
    }

    // Performance Calculations
    const totalRev = txs.reduce((acc, t) => acc + t.amount, 0);
    const totalTips = txs.reduce((acc, t) => acc + t.tip, 0);
    const invValue = state.data.inventory
        .filter(i => state.selectedBranchId === 'all' || i.branchId === state.selectedBranchId)
        .reduce((acc, i) => acc + i.value, 0);
    
    document.getElementById('stat-revenue').textContent = `R${totalRev.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('stat-tips').textContent = `R${totalTips.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('stat-inventory').textContent = `R${invValue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('stat-avg').textContent = `R${(totalRev / (state.range || 1)).toLocaleString(undefined, {maximumFractionDigits: 0})}`;

    updateChart(txs);
    renderJournal(txs);
    renderTeam(txs);
    renderRecon();
}

function updateChart(txs) {
    const ctx = document.getElementById('revenue-chart').getContext('2d');
    const dayMap = {};
    txs.forEach(t => {
        dayMap[t.date] = (dayMap[t.date] || 0) + t.amount;
    });
    
    const labels = Object.keys(dayMap).sort();
    const values = labels.map(l => dayMap[l]);

    if (revenueChart) revenueChart.destroy();
    
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Gross Daily Revenue',
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

function renderJournal(txs) {
    const tbody = document.getElementById('journal-tbody');
    tbody.innerHTML = '';
    
    txs.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 50).forEach(t => {
        const staff = state.data.staff.find(s => s.id === t.staffId);
        const tr = document.createElement('tr');
        tr.className = 'table-row';
        tr.innerHTML = `
            <td class="py-5 opacity-40">${t.date}</td>
            <td class="py-5 font-black uppercase tracking-tighter">${t.id}</td>
            <td class="py-5 font-bold">${staff ? staff.name : 'Unknown'}</td>
            <td class="py-5"><span class="px-3 py-1 bg-white/5 rounded-lg text-[10px] uppercase font-black">${t.method}</span></td>
            <td class="py-5 text-right font-black">R${t.amount.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTeam(txs) {
    const grid = document.getElementById('team-stats-grid');
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
        <h3 class="text-xl font-black uppercase mb-8">Staff Performance Analytics</h3>
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
                <td class="py-4 font-bold">${staff ? staff.name : sid}</td>
                <td class="py-4 text-center opacity-40">${s.visits}</td>
                <td class="py-4 text-center opacity-40">R${(s.sales/s.visits).toFixed(0)}</td>
                <td class="py-4 text-center text-emerald-500 font-black">R${s.tips.toFixed(2)}</td>
                <td class="py-4 text-right font-black">R${s.sales.toFixed(2)}</td>
            </tr>`;
    });

    html += `</tbody></table>`;
    card.innerHTML = html;
    grid.appendChild(card);
}

function renderRecon() {
    const tbody = document.getElementById('recon-tbody');
    tbody.innerHTML = '';

    state.data.reconLogs.forEach(log => {
        const branch = state.branches.find(b => b.id === log.branchId);
        if (state.selectedBranchId !== 'all' && log.branchId !== state.selectedBranchId) return;

        const tr = document.createElement('tr');
        tr.className = 'table-row';
        tr.innerHTML = `
            <td class="py-5 opacity-40">${log.date}</td>
            <td class="py-5 font-bold">${branch ? branch.name : log.branchId}</td>
            <td class="py-5 font-black">R${log.systemTotal.toFixed(2)}</td>
            <td class="py-5 font-black ${log.variance < 0 ? 'text-red-400' : ''}">R${log.variance.toFixed(2)}</td>
            <td class="py-5 text-right"><span class="px-3 py-1 ${log.status === 'Balanced' ? 'bg-emerald-500 text-black' : 'bg-red-500/20 text-red-400'} rounded-lg text-[10px] uppercase font-black">${log.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function initUIEvents() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const tab = btn.dataset.tab;
            if (tab === 'settings') return; // Not implemented

            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-${tab}`).classList.remove('hidden');
            
            document.getElementById('current-tab-title').textContent = btn.textContent;
        };
    });

    // Branch Selector
    document.getElementById('branch-selector').onchange = (e) => {
        state.selectedBranchId = e.target.value;
        refreshData();
    };

    // Range Filter
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.onclick = () => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const range = pill.dataset.range;
            const customBox = document.getElementById('custom-date-container');
            
            if (range === 'custom') {
                customBox.classList.remove('hidden');
            } else {
                customBox.classList.add('hidden');
                state.range = parseInt(range);
                setRange(state.range);
                refreshData();
            }
        };
    });

    document.getElementById('start-date').onchange = () => {
        state.startDate = document.getElementById('start-date').value;
        state.range = Math.ceil((new Date(state.endDate) - new Date(state.startDate)) / (1000 * 60 * 60 * 24));
        refreshData();
    };
    
    document.getElementById('end-date').onchange = () => {
        state.endDate = document.getElementById('end-date').value;
        state.range = Math.ceil((new Date(state.endDate) - new Date(state.startDate)) / (1000 * 60 * 60 * 24));
        refreshData();
    };

    // Logout
    document.getElementById('logout-btn').onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = "index.html";
    };
}

document.addEventListener('DOMContentLoaded', initDashboard);
