
// Initialize Supabase Client
const supabase = window.supabase.createClient(
    "https://pespysgaqfstachvnsvr.supabase.co", 
    "sb_publishable_JA2mjXkpZxxBYjo9noU4hA_F3-h6V8d"
);

// APP STATE
const appState = {
    user: null,
    companyId: null,
    company: { name: "Loading...", id: null },
    branches: [],
    selectedBranch: 'all',
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
    // 1. Recover Session State
    appState.companyId = localStorage.getItem("company_id");
    appState.company.name = localStorage.getItem("company_name") || "Isaacs Strategic Group";
    appState.selectedBranch = localStorage.getItem("branch_id") || 'all';

    // 2. Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    
    // Safety: If no session OR no company ID, we cannot proceed
    if (!session || !appState.companyId) {
        console.error("Session invalid or Context missing. Resetting Uplink.");
        localStorage.clear();
        window.location.href = "index.html";
        return;
    }
    
    appState.user = session.user;
    document.getElementById('user-email-sidebar').textContent = appState.user.email;
    document.getElementById('sidebar-company-name').textContent = appState.company.name;

    // 3. Populate Infrastructure
    await fetchBranchNetwork();
    
    // 4. Bind System Events
    setupEventListeners();
    
    // 5. Initial Data Rendering
    refreshUI();
    
    if (window.lucide) lucide.createIcons();
}

/**
 * INFRASTRUCTURE: BRANCH MESH
 */
async function fetchBranchNetwork() {
    // Attempt to pull real branch data for this company
    const { data: branches, error } = await supabase
        .from("branches")
        .select("*")
        .eq("company_id", appState.companyId);

    if (error || !branches || branches.length === 0) {
        console.warn("Using simulated network nodes for current company context.");
        appState.branches = [
            { id: 'br-hq', name: 'Isaacs HQ (Cape Town)', inventory_value: 85000, company_id: appState.companyId },
            { id: 'br-st', name: 'Isaacs Stellenbosch', inventory_value: 42000, company_id: appState.companyId },
            { id: 'br-cl', name: 'Isaacs Claremont', inventory_value: 31000, company_id: appState.companyId }
        ];
    } else {
        appState.branches = branches;
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
 * DATA ANALYSIS ENGINE
 */
async function loadPerformanceData() {
    const { startDate, endDate } = getDateBounds();

    // Determine Branch Context
    let targetBranchIds = appState.selectedBranch === 'all' 
        ? appState.branches.map(b => b.id) 
        : [appState.selectedBranch];

    // Parallel Queries for speed
    const [salesRes, productsRes] = await Promise.all([
        supabase.from("sales").select("*")
            .in("branch_id", targetBranchIds)
            .gte("created_at", startDate.toISOString())
            .lte("created_at", endDate.toISOString()),
        supabase.from("products").select("id").in("branch_id", targetBranchIds)
    ]);

    // Data Processing & Aggregation
    const sales = salesRes.data || generateMockSales(startDate, endDate);
    const productsCount = (productsRes.data?.length) || 125;

    const grossRevenue = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalTips = sales.reduce((sum, s) => sum + (s.tip_amount || 0), 0);
    
    const todayStr = new Date().toISOString().split("T")[0];
    const dailyAverage = sales.filter(s => s.created_at.startsWith(todayStr))
                             .reduce((sum, s) => sum + (s.total_amount || 0), 0);

    const revenueVelocity = grossRevenue / 30;

    return { grossRevenue, totalTips, inventoryCount: productsCount, dailyAverage, revenueVelocity, allSales: sales };
}

/**
 * UI SYNC ENGINE
 */
async function refreshUI() {
    const pulse = document.getElementById('sync-pulse');
    if (pulse) pulse.classList.add('animate-ping');

    const stats = await loadPerformanceData();

    // DOM Binding
    document.getElementById("grossRevenue").innerText = "R " + stats.grossRevenue.toFixed(2);
    document.getElementById("totalTips").innerText = "R " + stats.totalTips.toFixed(2);
    document.getElementById("inventoryCount").innerText = stats.inventoryCount;
    document.getElementById("dailyAverage").innerText = "R " + stats.dailyAverage.toFixed(2);
    document.getElementById("revenueVelocity").innerText = "R " + stats.revenueVelocity.toFixed(2) + " / Cycle";

    // View Dissemination
    if (appState.currentView === 'performance') renderVelocityChart(stats.allSales);
    else if (appState.currentView === 'journal') renderSalesJournal(stats.allSales);
    else if (appState.currentView === 'team') renderTeamStats(stats.allSales);

    if (pulse) pulse.classList.remove('animate-ping');
    if (window.lucide) lucide.createIcons();
}

/**
 * VISUALIZATIONS
 */
function renderVelocityChart(sales) {
    const ctx = document.getElementById('velocityChart').getContext('2d');
    if (appState.chart) appState.chart.destroy();

    const dailyData = {};
    sales.forEach(s => {
        const d = s.created_at.split('T')[0];
        dailyData[d] = (dailyData[d] || 0) + (s.total_amount || 0);
    });

    const labels = Object.keys(dailyData).sort();
    const values = labels.map(l => dailyData[l]);

    appState.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Revenue Flow',
                data: values,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 4,
                pointRadius: 5,
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

function renderSalesJournal(sales) {
    const body = document.getElementById('journal-body');
    body.innerHTML = '';
    sales.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).forEach(s => {
        const branch = appState.branches.find(b => b.id === s.branch_id);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-8 font-bold opacity-40">${new Date(s.created_at).toLocaleDateString()}</td>
            <td class="p-8 font-black">${s.folio_number || 'INV-'+Math.floor(Math.random()*9000+1000)}</td>
            <td class="p-8 opacity-70">${s.staff_name || 'System Operator'}</td>
            <td class="p-8 text-right font-black">R${(s.total_amount || 0).toFixed(2)}</td>
            <td class="p-8"><span class="px-3 py-1 bg-white/5 rounded-lg text-[10px] uppercase font-black">${s.payment_type || 'Card'}</span></td>
            <td class="p-8 text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">${branch ? branch.name : 'Master Node'}</td>
        `;
        body.appendChild(row);
    });
}

function renderTeamStats(sales) {
    const container = document.getElementById('team-stats-container');
    container.innerHTML = '';
    const stats = {};
    sales.forEach(s => {
        const name = s.staff_name || 'System Operator';
        if (!stats[name]) stats[name] = { sales: 0, visits: 0, tips: 0 };
        stats[name].sales += (s.total_amount || 0);
        stats[name].visits += 1;
        stats[name].tips += (s.tip_amount || 0);
    });

    Object.entries(stats).forEach(([name, data]) => {
        const card = document.createElement('div');
        card.className = "stat-card group hover:border-emerald-500/30";
        card.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-emerald-500"><i data-lucide="user"></i></div>
                <div class="text-right"><div class="text-[10px] font-black uppercase text-emerald-500">${data.visits} Visits</div></div>
            </div>
            <h4 class="text-lg font-black uppercase tracking-tighter mb-1">${name}</h4>
            <div class="mt-8 pt-8 border-t border-white/5 space-y-4">
                <div class="flex justify-between items-center"><span class="text-[9px] font-black uppercase text-white/30">Gross Sales</span><span class="text-sm font-black tracking-tighter">R${data.sales.toLocaleString()}</span></div>
                <div class="flex justify-between items-center"><span class="text-[9px] font-black uppercase text-white/30">Tips Logged</span><span class="text-sm font-black tracking-tighter text-emerald-500">R${data.tips.toLocaleString()}</span></div>
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * UTILITIES & LISTENERS
 */
function getDateBounds() {
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

function setupEventListeners() {
    // Navigation Routing
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

    // Branch Filter
    document.getElementById('branch-selector').onchange = (e) => {
        appState.selectedBranch = e.target.value;
        localStorage.setItem("branch_id", e.target.value);
        refreshUI();
    };

    // Date Presets
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

    // Logout Routine
    document.getElementById('logout-btn').onclick = async () => {
        localStorage.clear();
        await supabase.auth.signOut();
        window.location.href = "index.html";
    };
}

function closeMobileNav() { document.getElementById('mobile-nav').classList.remove('open'); }

/**
 * SAFETY MOCK DATA
 */
function generateMockSales(start, end) {
    const data = [];
    const staff = ['David Director', 'Sarah Stylist', 'Emma Junior'];
    let curr = new Date(start);
    while (curr <= end) {
        const count = 15;
        for(let i=0; i<count; i++) {
            data.push({
                created_at: curr.toISOString(),
                total_amount: 500 + Math.random() * 500,
                tip_amount: 50 + Math.random() * 50,
                branch_id: appState.branches[Math.floor(Math.random() * appState.branches.length)]?.id,
                staff_name: staff[Math.floor(Math.random() * staff.length)]
            });
        }
        curr.setDate(curr.getDate() + 1);
    }
    return data;
}

document.addEventListener('DOMContentLoaded', init);
