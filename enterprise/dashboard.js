
// Initialize Supabase Client
const supabase = window.supabase.createClient(
    "https://pespysgaqfstachvnsvr.supabase.co", 
    "sb_publishable_JA2mjXkpZxxBYjo9noU4hA_F3-h6V8d"
);

const state = {
    currentView: 'overview',
    isMobileNavOpen: false
};

async function initDashboard() {
    // 1. Check for Active JWT Session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        console.error("No valid JWT detected. Access denied.");
        window.location.href = "index.html"; 
        return;
    }

    // 2. Identify Current User
    const user = session.user;
    const emailDisplay = document.getElementById('user-email');
    if (emailDisplay) emailDisplay.textContent = user.email;

    // 3. Initialize UI Components
    initNavigation();
    initMobileNav();
    
    // Trigger Icon Generation
    if (window.lucide) {
        lucide.createIcons();
    }

    console.log("[IsaacsPOS] Cloud Uplink Stable. User:", user.email);
}

function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const viewSections = document.querySelectorAll('.view-section');
    const viewTitle = document.getElementById('view-title');

    navBtns.forEach(btn => {
        btn.onclick = () => {
            const viewId = btn.getAttribute('data-view');
            if (!viewId) return;

            // Update Active State on Buttons
            navBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll(`[data-view="${viewId}"]`).forEach(b => b.classList.add('active'));

            // Switch Sections
            viewSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === `view-${viewId}`) {
                    section.classList.add('active');
                }
            });

            // Update Header Title
            const labels = {
                overview: 'Registry Overview',
                network: 'Salon Network',
                stats: 'Global Stats',
                settings: 'Cloud Settings'
            };
            viewTitle.textContent = labels[viewId] || 'Dashboard';

            // Close mobile nav if open
            closeMobileNav();
        };
    });
}

function initMobileNav() {
    const openBtn = document.getElementById('open-mobile-btn');
    const closeBtn = document.getElementById('close-mobile-btn');
    const overlay = document.getElementById('nav-close-overlay');
    const mobileNav = document.getElementById('mobile-nav');

    if (openBtn) openBtn.onclick = () => {
        mobileNav.classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    if (closeBtn) closeBtn.onclick = closeMobileNav;
    if (overlay) overlay.onclick = closeMobileNav;
}

function closeMobileNav() {
    const mobileNav = document.getElementById('mobile-nav');
    if (mobileNav) {
        mobileNav.classList.remove('open');
        document.body.style.overflow = 'auto';
    }
}

// Global Terminal Shutdown
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) window.location.href = "index.html";
    });
}

// Start Lifecycle
document.addEventListener('DOMContentLoaded', initDashboard);
