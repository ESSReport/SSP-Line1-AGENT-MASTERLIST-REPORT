// ------------------------------
// Configuration
// ------------------------------
const SHEET_ID = "1w5PrRJ9DFTAt8UmkJKlCLwK0mbvxCtjFX7jcVFli0gA";
const SHEETS = {
  DEPOSIT: `https://opensheet.elk.sh/${SHEET_ID}/TOTAL%20DEPOSIT`,
  WITHDRAWAL: `https://opensheet.elk.sh/${SHEET_ID}/TOTAL%20WITHDRAWAL`,
  STLM: `https://opensheet.elk.sh/${SHEET_ID}/STLM%2FTOPUP`,
  COMM: `https://opensheet.elk.sh/${SHEET_ID}/COMM`,
  SHOP_BALANCE: `https://opensheet.elk.sh/${SHEET_ID}/SHOPS%20BALANCE`,
  WALLET_DP: `https://opensheet.elk.sh/19eCfiWh46hQUqyAwcpx4OD_3nPFDVK1p1BYbcncMT4M/DP`,
  WALLET_WD: `https://opensheet.elk.sh/19eCfiWh46hQUqyAwcpx4OD_3nPFDVK1p1BYbcncMT4M/WD`
};

const shopName = new URLSearchParams(window.location.search).get("shopName") || "";
document.getElementById("shopTitle").textContent = shopName || "Shop Dashboard";

const tbody = document.getElementById("transactionTableBody");
const totalsRow = document.getElementById("totalsRow");
const loadingSpinner = document.getElementById("loadingSpinner");
const walletCards = document.getElementById("walletCards");

// ------------------------------
// Utilities
// ------------------------------
function parseNumber(v) {
  if (!v) return 0;
  const s = String(v).replace(/,/g, "").replace(/\((.*)\)/, "-$1").trim();
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
function formatNumber(v) { return v !== undefined ? v.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"; }
function normalizeString(str) { return (str || "").trim().replace(/\s+/g, " ").toUpperCase(); }
async function fetchSheet(url) { const res = await fetch(url); if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); }
function rTrim(v){ return String(v||"").trim(); }

// ------------------------------
// Load Data
// ------------------------------
async function loadData() {
  if (!shopName) { alert("❌ No shopName found in URL"); return; }
  loadingSpinner.style.display = "block";

  try {
    const [depositData, withdrawalData, stlmData, commData, shopBalanceData, walletDP, walletWD] = await Promise.all([
      fetchSheet(SHEETS.DEPOSIT),
      fetchSheet(SHEETS.WITHDRAWAL),
      fetchSheet(SHEETS.STLM),
      fetchSheet(SHEETS.COMM),
      fetchSheet(SHEETS.SHOP_BALANCE),
      fetchSheet(SHEETS.WALLET_DP),
      fetchSheet(SHEETS.WALLET_WD)
    ]);

    const normalizedShop = normalizeString(shopName);

    // Shop info
    const shopRow = shopBalanceData.find(r => normalizeString(r["SHOP"]) === normalizedShop);
    const bringForwardBalance = parseNumber(shopRow ? rTrim(shopRow[" BRING FORWARD BALANCE "]) : 0);
    const securityDeposit = parseNumber(shopRow ? rTrim(shopRow["SECURITY DEPOSIT"]) : 0);
    const teamLeader = shopRow ? rTrim(shopRow["TEAM LEADER"]) : "-";

    if (typeof window.checkTLAccess !== "function") throw new Error("auth.js not loaded");
    await window.checkTLAccess(teamLeader);

    // Header info
    document.getElementById("infoShopName").textContent = shopName;
    document.getElementById("infoBFBalance").textContent = formatNumber(bringForwardBalance);
    document.getElementById("infoSecDeposit").textContent = formatNumber(securityDeposit);
    document.getElementById("infoTeamLeader").textContent = teamLeader;

    // ------------------------------
    // Daily Transactions
    // ------------------------------
    const tlRow = commData.find(r => normalizeString(r.SHOP) === normalizedShop);
    const dpCommRate = parseNumber(tlRow?.["DP COMM"]);
    const wdCommRate = parseNumber(tlRow?.["WD COMM"]);
    const addCommRate = parseNumber(tlRow?.["ADD COMM"]);

    const datesSet = new Set([
      ...depositData.filter(r => normalizeString(r.SHOP) === normalizedShop).map(r => r.DATE),
      ...withdrawalData.filter(r => normalizeString(r.SHOP) === normalizedShop).map(r => r.DATE),
      ...stlmData.filter(r => normalizeString(r.SHOP) === normalizedShop).map(r => r.DATE)
    ]);
    const sortedDates = Array.from(datesSet).filter(Boolean).sort((a,b) => new Date(a) - new Date(b));

    let runningBalance = bringForwardBalance;
    const totals = { depTotal:0, wdTotal:0, inAmt:0, outAmt:0, settlement:0, specialPay:0, adjustment:0, secDep:0, dpComm:0, wdComm:0, addComm:0 };
    tbody.innerHTML = "";

    if (bringForwardBalance) {
      const bfbRow = document.createElement("tr");
      bfbRow.innerHTML = `<td>B/F Balance</td>` + `<td>0.00</td>`.repeat(11) + `<td>${formatNumber(runningBalance)}</td>`;
      tbody.appendChild(bfbRow);
    }

    for (const date of sortedDates) {
      const deposits = depositData.filter(r=>normalizeString(r.SHOP)===normalizedShop && r.DATE===date);
      const withdrawals = withdrawalData.filter(r=>normalizeString(r.SHOP)===normalizedShop && r.DATE===date);
      const stlmForDate = stlmData.filter(r=>normalizeString(r.SHOP)===normalizedShop && r.DATE===date);

      const depTotalRow = deposits.reduce((s,r)=>s+parseNumber(r.AMOUNT),0);
      const wdTotalRow = withdrawals.reduce((s,r)=>s+parseNumber(r.AMOUNT),0);

      const sumMode = mode => stlmForDate.filter(r => normalizeString(r.MODE)===mode).reduce((s,r)=>s+parseNumber(r.AMOUNT),0);
      const inAmtRow = sumMode("IN");
      const outAmtRow = sumMode("OUT");
      const settlementRow = sumMode("SETTLEMENT");
      const specialPayRow = sumMode("SPECIAL PAYMENT");
      const adjustmentRow = sumMode("ADJUSTMENT");
      const secDepRow = sumMode("SECURITY DEPOSIT");

      const dpCommRow = depTotalRow * dpCommRate / 100;
      const wdCommRow = wdTotalRow * wdCommRate / 100;
      const addCommRow = depTotalRow * addCommRate / 100;

      runningBalance += depTotalRow - wdTotalRow + inAmtRow - outAmtRow - settlementRow - specialPayRow
                        + adjustmentRow - dpCommRow - wdCommRow - addCommRow;

      totals.depTotal += depTotalRow; totals.wdTotal += wdTotalRow;
      totals.inAmt += inAmtRow; totals.outAmt += outAmtRow; totals.settlement += settlementRow;
      totals.specialPay += specialPayRow; totals.adjustment += adjustmentRow;
      totals.secDep += secDepRow; totals.dpComm += dpCommRow; totals.wdComm += wdCommRow; totals.addComm += addCommRow;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${date}</td>
        <td>${formatNumber(depTotalRow)}</td>
        <td>${formatNumber(wdTotalRow)}</td>
        <td>${formatNumber(inAmtRow)}</td>
        <td>${formatNumber(outAmtRow)}</td>
        <td>${formatNumber(settlementRow)}</td>
        <td>${formatNumber(specialPayRow)}</td>
        <td>${formatNumber(adjustmentRow)}</td>
        <td>${formatNumber(secDepRow)}</td>
        <td>${formatNumber(dpCommRow)}</td>
        <td>${formatNumber(wdCommRow)}</td>
        <td>${formatNumber(addCommRow)}</td>
        <td>${formatNumber(runningBalance)}</td>
      `;
      tbody.appendChild(tr);
    }

    totalsRow.innerHTML = `<td>TOTAL</td>
      <td>${formatNumber(totals.depTotal)}</td>
      <td>${formatNumber(totals.wdTotal)}</td>
      <td>${formatNumber(totals.inAmt)}</td>
      <td>${formatNumber(totals.outAmt)}</td>
      <td>${formatNumber(totals.settlement)}</td>
      <td>${formatNumber(totals.specialPay)}</td>
      <td>${formatNumber(totals.adjustment)}</td>
      <td>${formatNumber(totals.secDep)}</td>
      <td>${formatNumber(totals.dpComm)}</td>
      <td>${formatNumber(totals.wdComm)}</td>
      <td>${formatNumber(totals.addComm)}</td>
      <td>${formatNumber(runningBalance)}</td>
    `;

    // CSV download
    document.getElementById('downloadCsvBtn').addEventListener('click', () => {
      downloadTableAsCSV(`${shopName || 'daily_transactions'}.csv`);
    });

    // Wallet Summary Cards
    renderWalletSummary(walletDP, walletWD, normalizedShop);

  } catch(err){
    console.error(err);
    alert("⚠️ Error loading data: "+err.message);
  }

  loadingSpinner.style.display = "none";
}

// ------------------------------
// Wallet Summary Cards
// ------------------------------
function renderWalletSummary(walletDP, walletWD, normalizedShop) {
  walletCards.innerHTML = "";

  const dpShop = walletDP.filter(r => normalizeString(r["Shop Name"]) === normalizedShop);
  const wdShop = walletWD.filter(r => normalizeString(r["Shop Name"]) === normalizedShop);

  const totals = { auto: 0, manual: 0, withdrawal: 0 };

  dpShop.forEach(r => { totals[r.Type.trim().toLowerCase()] += parseNumber(r.Amount); });
  wdShop.forEach(r => totals.withdrawal += parseNumber(r.Amount));

  // Top-level cards
  const cardInfo = [
    { title: "Total Deposit (Auto)", amount: totals.auto },
    { title: "Total Deposit (Manual)", amount: totals.manual },
    { title: "Total Withdrawal", amount: totals.withdrawal }
  ];
  cardInfo.forEach(c => {
    const div = document.createElement("div");
    div.className = "wallet-card";
    div.innerHTML = `<h3>${c.title}</h3><p>${formatNumber(c.amount)}</p>`;
    walletCards.appendChild(div);
  });

  // Date-wise breakdown
  const createDateCard = (title, walletAmounts) => {
    const div = document.createElement("div");
    div.className = "wallet-card";
    div.style.background = "#fefefe";
    div.innerHTML = `<h4>${title}</h4>`;
    const ul = document.createElement("ul");
    for (const w in walletAmounts) {
      const li = document.createElement("li");
      li.textContent = `${w} : ${formatNumber(walletAmounts[w])}`;
      ul.appendChild(li);
    }
    div.appendChild(ul);
    walletCards.appendChild(div);
  };

  ["Auto","Manual"].forEach(type => {
    const datesSet = new Set(dpShop.filter(r => r.Type === type).map(r => r.Date));
    Array.from(datesSet).sort((a,b) => new Date(a)-new Date(b)).forEach(date => {
      const wallets = dpShop.filter(r => r.Type === type && r.Date === date);
      const walletSums = {};
      wallets.forEach(r => { walletSums[r.Wallet.trim()] = (walletSums[r.Wallet.trim()]||0)+parseNumber(r.Amount); });
      createDateCard(`${type} Deposit - ${date}`, walletSums);
    });
  });

  const wdDates = new Set(wdShop.map(r => r.Date));
  Array.from(wdDates).sort((a,b) => new Date(a)-new Date(b)).forEach(date => {
    const wallets = wdShop.filter(r => r.Date === date);
    const walletSums = {};
    wallets.forEach(r => { walletSums[r.Wallet.trim()] = (walletSums[r.Wallet.trim()]||0)+parseNumber(r.Amount); });
    createDateCard(`Withdrawal - ${date}`, walletSums);
  });

  // ------------------------------
  // Wallet Summary Download
  // ------------------------------
  document.getElementById("downloadWalletBtn").addEventListener("click", () => {
    const allData = [...dpShop, ...wdShop];
    const columns = ["Wallet","Reference","Amount","Date","Type","Shop Name"];
    const csvRows = [columns.join(",")];
    allData.forEach(r => {
      const row = columns.map(col => `"${(r[col]||"").toString().replace(/"/g,'""')}"`);
      csvRows.push(row.join(","));
    });
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shopName}_wallet_summary.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ------------------------------
// CSV Download Function
// ------------------------------
function downloadTableAsCSV(filename = 'daily_transactions.csv') {
  const rows = document.querySelectorAll('#transactionTable tbody tr, #transactionTable tfoot tr');
  const csv = [];
  const shopNameText = document.getElementById("infoShopName").textContent;
  const secDepositText = document.getElementById("infoSecDeposit").textContent;
  const bfBalanceText = document.getElementById("infoBFBalance").textContent;
  const teamLeaderText = document.getElementById("infoTeamLeader").textContent;

  csv.push(shopNameText);
  csv.push(`Shop Name: ${shopNameText}`);
  csv.push(`Security Deposit: ${secDepositText}`);
  csv.push(`Bring Forward Balance: ${bfBalanceText}`);
  csv.push(`Team Leader: ${teamLeaderText}`);

  const headerCols = document.querySelectorAll('#transactionTable thead th');
  const headerRow = Array.from(headerCols).map(th => `"${th.textContent.replace(/"/g,'""')}"`).join(',');
  csv.push(headerRow);

  rows.forEach(row => {
    const cols = row.querySelectorAll('td, th');
    const rowData = [];
    cols.forEach(col => { rowData.push(`"${col.textContent.replace(/"/g, '""')}"`); });
    csv.push(rowData.join(','));
  });

  const csvString = csv.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Initialize
loadData();
