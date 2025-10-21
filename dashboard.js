const SHEET_ID = "1lukJC1vKSq02Nus23svZ21_pp-86fz0mU1EARjalCBI";
const OPENSHEET_URL = `https://opensheet.elk.sh/${SHEET_ID}/SHOPS%20BALANCE`;

const HEADERS = [
  "SHOP NAME",
  "TEAM LEADER",
  "SECURITY DEPOSIT",
  "BRING FORWARD BALANCE",
  "TOTAL DEPOSIT",
  "TOTAL WITHDAWAL",
  "INTERNAL TRANSFER IN",
  "INTERNAL TRANSAFER OUT",
  "SETTLEMENT",
  "SPECIAL PAYMENT",
  "ADJUSTMENT",
  "DP COMM",
  "WD COMM",
  "ADD COMM",
  "RUNNING BALANCE",
];

const cleanKey = (k) => String(k || "").replace(/\s+/g, " ").trim().toUpperCase();
const parseNumber = (v) => {
  if (!v) return 0;
  const s = String(v).replace(/[,\s]/g, "").replace(/\((.*)\)/, "-$1");
  const n = Number(s);
  return isFinite(n) ? n : 0;
};
const normalize = (row) => {
  const out = {};
  for (const k in row) out[cleanKey(k)] = String(row[k] || "").trim();
  return out;
};

let rawData = [];
let filteredData = [];
let cachedData = [];
let currentPage = 1;
const rowsPerPage = 20;

async function fetchShopBalance() {
  const res = await fetch(OPENSHEET_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.map(normalize);
}

async function loadDashboard() {
  const data = await fetchShopBalance();
  rawData = data;
  buildTeamLeaderDropdown(data);

  // Auto-filter if URL contains teamLeader param
  const urlParams = new URLSearchParams(window.location.search);
  const teamLeaderParam = urlParams.get("teamLeader");

  if (teamLeaderParam) {
    document.getElementById("leaderFilter").value = teamLeaderParam.toUpperCase();
    // Hide dropdown and link
    document.getElementById("leaderFilter").style.display = "none";
    document.getElementById("teamDashboardLink").style.display = "none";
  }

  buildSummary(data);
  if (teamLeaderParam) filterData();
}

function buildTeamLeaderDropdown(data) {
  const dropdown = document.getElementById("leaderFilter");
  dropdown.innerHTML = '<option value="ALL">All Team Leaders</option>';
  const leaders = [...new Set(
    data.map(r => (r["TEAM LEADER"] || "").trim().toUpperCase())
  )].filter(name => name && name !== "#N/A" && name !== "N/A");
  leaders.sort().forEach(l => {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = l;
    dropdown.appendChild(opt);
  });
}

function buildSummary(data) {
  const summary = {};
  data.forEach(r => {
    const shop = (r["SHOP"] || r["SHOP NAME"] || "").trim();
    if (!shop) return;

    const leader = (r["TEAM LEADER"] || "").trim().toUpperCase();

    if (!summary[shop]) {
      summary[shop] = {
        "SHOP NAME": shop,
        "TEAM LEADER": leader,
        "SECURITY DEPOSIT": 0,
        "BRING FORWARD BALANCE": 0,
        "TOTAL DEPOSIT": 0,
        "TOTAL WITHDAWAL": 0,
        "INTERNAL TRANSFER IN": 0,
        "INTERNAL TRANSAFER OUT": 0,
        "SETTLEMENT": 0,
        "SPECIAL PAYMENT": 0,
        "ADJUSTMENT": 0,
        "DP COMM": 0,
        "WD COMM": 0,
        "ADD COMM": 0,
        "RUNNING BALANCE": 0,
      };
    }

    summary[shop]["SECURITY DEPOSIT"] += parseNumber(r["SECURITY DEPOSIT"]);
    summary[shop]["BRING FORWARD BALANCE"] += parseNumber(r["BRING FORWARD BALANCE"]);
    summary[shop]["TOTAL DEPOSIT"] += parseNumber(r["TOTAL DEPOSIT"]);
    summary[shop]["TOTAL WITHDAWAL"] += parseNumber(r["TOTAL WITHDAWAL"]);
    summary[shop]["INTERNAL TRANSFER IN"] += parseNumber(r["INTERNAL TRANSFER IN"]);
    summary[shop]["INTERNAL TRANSAFER OUT"] += parseNumber(r["INTERNAL TRANSAFER OUT"]);
    summary[shop]["SETTLEMENT"] += parseNumber(r["SETTLEMENT"]);
    summary[shop]["SPECIAL PAYMENT"] += parseNumber(r["SPECIAL PAYMENT"]);
    summary[shop]["ADJUSTMENT"] += parseNumber(r["ADJUSTMENT"]);
    summary[shop]["DP COMM"] += parseNumber(r["DP COMM"]);
    summary[shop]["WD COMM"] += parseNumber(r["WD COMM"]);
    summary[shop]["ADD COMM"] += parseNumber(r["ADD COMM"]);

    const rb =
      summary[shop]["BRING FORWARD BALANCE"] +
      summary[shop]["TOTAL DEPOSIT"] -
      summary[shop]["TOTAL WITHDAWAL"] +
      summary[shop]["INTERNAL TRANSFER IN"] -
      summary[shop]["INTERNAL TRANSAFER OUT"] -
      summary[shop]["SETTLEMENT"] -
      summary[shop]["SPECIAL PAYMENT"] +
      summary[shop]["ADJUSTMENT"] -
      summary[shop]["DP COMM"] -
      summary[shop]["WD COMM"] -
      summary[shop]["ADD COMM"];

    summary[shop]["RUNNING BALANCE"] = rb;
  });

  cachedData = Object.values(summary);
  filteredData = cachedData;
  renderTable();
}

function renderTable() {
  const tableHead = document.getElementById("tableHeader");
  const tableBody = document.getElementById("tableBody");
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  HEADERS.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    if (h === "SHOP NAME" || h === "TEAM LEADER") th.classList.add("left");
    tableHead.appendChild(th);
  });

  const start = (currentPage - 1) * rowsPerPage;
  const pageData = filteredData.slice(start, start + rowsPerPage);

  pageData.forEach(r => {
    const tr = document.createElement("tr");
    HEADERS.forEach(h => {
      const td = document.createElement("td");
      if (h === "SHOP NAME") {
        const a = document.createElement("a");
        a.textContent = r[h] || "";
        a.href = `shop_dashboard.html?shopName=${encodeURIComponent(r[h] || "")}`;
        a.target = "_blank";
        a.className = "shop-link";
        td.appendChild(a);
        td.classList.add("left");
      } else if (h === "TEAM LEADER") {
        td.textContent = r[h] || "";
        td.classList.add("left");
      } else {
        td.textContent = (Number(r[h]) || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });

  updatePagination();
  renderTotals();
  updateTeamDashboardLink();
}

function updatePagination() {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  document.getElementById("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
  document.getElementById("prevPage").disabled = currentPage === 1;
  document.getElementById("nextPage").disabled = currentPage === totalPages || totalPages === 0;
}

/* ---------- Totals Bar ---------- */
function renderTotals() {
  const totalsDiv = document.getElementById("totalsRow");
  totalsDiv.innerHTML = "";

  HEADERS.forEach(h => {
    if (["SHOP NAME", "TEAM LEADER"].includes(h)) return;
    const total = filteredData.reduce((a, b) => a + (parseNumber(b[h]) || 0), 0);
    const card = document.createElement("div");
    card.className = "total-card";
    card.innerHTML = `<div>${h}</div>
                      <div>${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>`;
    totalsDiv.appendChild(card);
  });
}

/* ---------- Team Leader Link ---------- */
function updateTeamDashboardLink() {
  const leader = document.getElementById("leaderFilter").value;
  const linkDiv = document.getElementById("teamDashboardLink");
  
  if (leader && leader !== "ALL") {
    const url = `${window.location.origin}${window.location.pathname}?teamLeader=${encodeURIComponent(leader)}`;
    linkDiv.innerHTML = `
      <a href="${url}" target="_blank" style="color:#0077cc; font-weight:bold; text-decoration:underline;">
        Open ${leader} Dashboard in New Tab
      </a>
    `;
  } else {
    linkDiv.innerHTML = "";
  }
}

/* ---------- Event Listeners ---------- */
document.getElementById("leaderFilter").addEventListener("change", filterData);
document.getElementById("searchInput").addEventListener("input", filterData);
document.getElementById("prevPage").addEventListener("click", () => { currentPage--; renderTable(); });
document.getElementById("nextPage").addEventListener("click", () => { currentPage++; renderTable(); });
document.getElementById("resetBtn").addEventListener("click", () => {
  document.getElementById("leaderFilter").value = "ALL";
  document.getElementById("searchInput").value = "";
  filteredData = cachedData;
  currentPage = 1;
  renderTable();
});
document.getElementById("exportBtn").addEventListener("click", exportCSV);

function filterData() {
  const leader = document.getElementById("leaderFilter").value;
  const search = document.getElementById("searchInput").value.trim().toUpperCase();

  filteredData = cachedData.filter(r => {
    const matchLeader = leader === "ALL" || (r["TEAM LEADER"] || "").toUpperCase() === leader;
    const matchSearch = (r["SHOP NAME"] || "").toUpperCase().includes(search);
    return matchLeader && matchSearch;
  });

  currentPage = 1;
  renderTable();
}

/* ---------- CSV Export (Cross-Platform) ---------- */
function exportCSV() {
  let csv = HEADERS.join(",") + "\n";
  filteredData.forEach(r => {
    const row = HEADERS.map(h => `"${r[h] || 0}"`).join(",");
    csv += row + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  // Detect device
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  if (isIOS || isAndroid) {
    // Mobile workaround: open in new tab
    const url = URL.createObjectURL(blob);
    const newTab = window.open(url, "_blank");
    if (!newTab) {
      alert("Please allow popups to download the file.");
    } else {
      newTab.document.title = "shops_balance.csv";
    }
  } else {
    // Desktop browsers: direct download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shops_balance.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
/* ---------- INIT ---------- */
loadDashboard();
