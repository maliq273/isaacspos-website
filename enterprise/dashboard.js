
// Initialize Supabase Client
const supabase = window.supabase.createClient(
    "https://pespysgaqfstachvnsvr.supabase.co", 
    "sb_publishable_JA2mjXkpZxxBYjo9noU4hA_F3-h6V8d"
);

async function initDashboard() {
    // 1. Check for Active JWT Session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        console.error("No valid JWT detected. Access denied.");
        // FIX: Redirect to the enterprise login node, not the home page
        window.location.href = "index.html"; 
        return;
    }

    // 2. Identify Current User
    const user = session.user;
    const emailDisplay = document.getElementById('user-email');
    if (emailDisplay) emailDisplay.textContent = user.email;

    // Trigger Icon Generation
    if (window.lucide) {
        lucide.createIcons();
    }

    console.log("[IsaacsPOS] Cloud Uplink Stable. User:", user.email);
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
