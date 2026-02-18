const supabase = window.supabase.createClient(
    "https://pespysgaqfstachvnsvr.supabase.co", 
    "sb_publishable_JA2mjXkpZxxBYjo9noU4hA_F3-h6V8d"
);

async function initDashboard() {
    // 1. Check Authentication State
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        console.error("No active session detected. Redirecting to access node.");
        window.location.href = "index.html";
        return;
    }

    // 2. Set User UI
    document.getElementById('user-email').textContent = session.user.email;
    lucide.createIcons();

    // 3. Fetch Company-Specific Data
    // Logic: In a real scenario, we'd fetch from a 'salons' table where user_id = user.id
    // For this demo, we'll simulate an empty state or basic profile fetch
    try {
        const { data: profile, error: profileError } = await supabase
            .from('profiles') // Assuming a profiles table exists
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (profileError) {
            console.warn("Profile registry not found. Running in Generic Mode.");
        } else {
            console.log("Profile handshake successful:", profile);
        }
    } catch (err) {
        console.error("Internal registry fault:", err);
    }
}

// Global Logout Handler
document.getElementById('logout-btn').onclick = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) window.location.href = "index.html";
};

// Start
document.addEventListener('DOMContentLoaded', initDashboard);
