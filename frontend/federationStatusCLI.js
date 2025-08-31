const BASE_URL = process.env.BACKEND_URL || "http://localhost:5000";

const colorize = (status) =>
  status === "ONLINE" ? "\x1b[32mONLINE\x1b[0m" : "\x1b[31mOFFLINE\x1b[0m";

(async function () {
  try {
    const res = await fetch(`${BASE_URL}/federation/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const rows = data.federationHealth.map((node) => ({
      "Node URL": node.node,
      Status: colorize(node.status),
      Listings: node.listings || "-",
      Transactions: node.transactions || "-",
      Users: node.users || "-",
      "Last Sync": node.lastSync ? new Date(node.lastSync).toLocaleString() : "N/A",
    }));

    console.log("\n🌍 Federation Node Status Report");
    console.table(rows);
  } catch (error) {
    console.error("Failed to fetch federation status:", error.message);
  }
})();
