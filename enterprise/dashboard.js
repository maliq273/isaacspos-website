// IsaacsPOS Enterprise Dashboard Logic
const sb = window.supabase.createClient(
    "https://pespysgaqfstachvnsvr.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc3B5c2dhcWZzdGFjaHZuc3ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzg0NTIsImV4cCI6MjA4NjgxNDQ1Mn0.uCg80UmYLtcUvpjIV_G7bRwQqJV1f-INKOWzfcendes"
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
}

async function refreshData() {
    generateMockData();
    renderAll();
}

function generateMockData() {
    const txCount = state.range * 25;
    state.data.transactions = [];
    state.data.staff = [
        { id: 's1', name: 'M. Isaacs', branchId: 'b1' },
        { id: 's2', name: 'S. Adams', branchId: 'b1' }
    ];

    for (let i = 0; i < txCount; i++) {
        const date = new Date(state.startDate);
        date.setDate(date.getDate() + Math.floor(Math.random() * (state.range || 1)));
        
        state.data.transactions.push({
            id: `FL-${5000 + i}`,
            date: date.toISOString().split('T')[0],
            amount: 500 + (Math.random() * 1500),
            tip: 50 + (Math.random() * 300),
            staffId: 's1',
            branchId: 'b1',
            method: 'Card'
        });
    }

    state.data.inventory = [{ name: 'Retail', value: 120000, branchId: 'b1' }];
}

function renderAll() {
    let txs = state.data.transactions;
    const totalRev = txs.reduce((acc, t) => acc + t.amount, 0);
    const totalTips = txs.reduce((acc, t) => acc + t.tip, 0);
    
    updateCounter('stat-revenue', totalRev);
    updateCounter('stat-tips', totalTips);
    updateCounter('stat-inventory', 120000);
    updateCounter('stat-avg', (totalRev / (state.range || 1)));

    updateChart(txs);
}

function updateCounter(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = `R${val.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
}

function updateChart(txs) {
    const ctx = document.getElementById('revenue-chart');
    if (!ctx) return;
    
    const dayMap = {};
    txs.forEach(t => { dayMap[t.date] = (dayMap[t.date] || 0) + t.amount; });
    
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
                y: { grid: { color: 'rgba(255,255,255,0.03)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function initUIEvents() {
    const lBtn = document.getElementById('logout-btn');
    if (lBtn) {
        lBtn.onclick = async () => {
            await sb.auth.signOut();
            window.location.replace("index.html");
        };
    }
}

/**
 * PATIENT UPLINK PROTOCOL
 */
async function getAuthenticatedSession() {
    return new Promise((resolve) => {
        // Step 1: Immediate check
        sb.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                console.log("Matrix Uplink: Active session detected.");
                resolve(session);
                return;
            }

            // Step 2: Listen for hydration event
            const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
                console.log(`Matrix Uplink Event: ${event}`);
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
    console.log("Dashboard Node: Analyzing Security Handshake...");

    const session = await getAuthenticatedSession();

    if (!session) {
        console.error("Dashboard Security Failure: Redirecting to Gatekeeper.");
        window.location.replace("index.html");
        return;
    }

    state.user = session.user;
    if (appShell) appShell.classList.add('ready');

    const welcomeEl = document.getElementById('current-tab-title');
    if (welcomeEl && state.user?.email) {
        welcomeEl.textContent = `Node: ${state.user.email.split('@')[0].toUpperCase()}`;
    }

    await fetchBranches();
    setRange(7);
    await refreshData();
    initUIEvents();

    if (window.lucide) lucide.createIcons();
}

document.addEventListener("DOMContentLoaded", initDashboard);
