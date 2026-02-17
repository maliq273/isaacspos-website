const supabase = window.supabase.createClient(
  "https://YOUR_PROJECT.supabase.co",
  "YOUR_ANON_PUBLIC_KEY"
);

async function loadDashboard() {

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    window.location.href = "index.html";
  }

  const userId = userData.user.id;

  // Get company linked to user
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_id", userId)
    .single();

  // Get branches
  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .eq("company_id", company.id);

  const branchIds = branches.map(b => b.id);

  // Get sales
  const { data: sales } = await supabase
    .from("sales")
    .select("*")
    .in("branch_id", branchIds);

  let totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  document.getElementById("totalRevenue").innerText = "R " + totalRevenue;

  // Product count
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .in("branch_id", branchIds);

  document.getElementById("productCount").innerText = products.length;

  // Revenue per branch chart
  let branchRevenue = branches.map(branch => {
    let branchSales = sales.filter(s => s.branch_id === branch.id);
    let total = branchSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    return total;
  });

  new Chart(document.getElementById("branchChart"), {
    type: "bar",
    data: {
      labels: branches.map(b => b.branch_name),
      datasets: [{
        label: "Revenue per Branch",
        data: branchRevenue
      }]
    }
  });
}

loadDashboard();

