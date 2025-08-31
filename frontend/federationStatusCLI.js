const axios = require("axios");
const chalk = require("chalk");
const Table = require("cli-table3");

const BASE_URL = process.env.BACKEND_URL || "http://localhost:5000";

(async function () {
  try {
    const { data } = await axios.get(`${BASE_URL}/federation/status`);
    const table = new Table({
      head: ["Node URL", "Status", "Listings", "Transactions", "Users", "Last Sync"],
      colWidths: [35, 10, 12, 15, 10, 25],
    });

    data.federationHealth.forEach((node) => {
      const statusColor = node.status === "ONLINE" ? chalk.green : chalk.red;
      table.push([
        node.node,
        statusColor(node.status),
        node.listings || "-",
        node.transactions || "-",
        node.users || "-",
        node.lastSync ? new Date(node.lastSync).toLocaleString() : "N/A",
      ]);
    });

    console.log(chalk.bold.cyan("\n🌍 Federation Node Status Report"));
    console.log(table.toString());
  } catch (error) {
    console.error(chalk.red("Failed to fetch federation status:"), error.message);
  }
})();
