// ------------------------------
// Configuration
// ------------------------------
const SHEET_ID = "1eUETYzpLr1bv9cPIIQnQszWoMP5BHlBfk1kXSP67X04";
const SHEETS = {
  DEPOSIT: `https://opensheet.elk.sh/${SHEET_ID}/TOTAL%20DEPOSIT`,
  WITHDRAWAL: `https://opensheet.elk.sh/${SHEET_ID}/TOTAL%20WITHDRAWAL`,
  STLM: `https://opensheet.elk.sh/${SHEET_ID}/STLM%2FTOPUP`,
  COMM: `https://opensheet.elk.sh/${SHEET_ID}/COMM`,
  SHOP_BALANCE: `https://opensheet.elk.sh/${SHEET_ID}/SHOPS%20BALANCE`
};

const shopName = new URLSearchParams(window.location.search).get("shopName") || "";
document.getElementById("shopTitle").textContent = shopName || "Shop Dashboard";

const tbody = document.getElementById("transactionTableBody");
const totalsRow = document.getElementById("totalsRow");
const loadingSpinner = document.getElementById("loadingSpinner");

// ------------------------------
// Utilities
// ------------------------------
function parseNumber(v) {
  if (!v) return 0;
  const s = String(v).replace(/,/g, "").replace(/\((.*)\)/, "-$1").trim();
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function formatNumber(v) {
  return v !== undefined ? v.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-";
}

function normalizeString(str) {
  return (str || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function rTrim(v) {
  return String(v || "").trim();
}

async function fetchSheet(url) {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // ✅ Trim all keys (handles " SHOP " → "SHOP")
  return data.map(row => {
    const cleaned = {};
    for (const key in row) cleaned[rTrim(key)] = row[key];
    return cleaned;
  });
}

// ------------------------------
// Date normalization (handles Google serials + text)
// ------------------------------
function normalizeDate(dateStr) {
  if (!dateStr) return "";
  const raw = String(dateStr).trim();
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = parseFloat(raw);
    const d = new Date((serial - 25569) * 86400 * 1000);
    return d.toISOString().split("T")[0];
  }
  const parts = raw.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let [p1, p2, p3] = parts.map(x => x.padStart(2, "0"));
    if (parseInt(p1) > 12) return `${p3.length === 2 ? "20" + p3 : p3}-${p2}-${p1}`;
    else return `${p3.length === 2 ? "20" + p3 : p3}-${p1}-${p2}`;
  }
  const d = new Date(raw);
  if (!isNaN(d)) return d.toISOString().split("T")[0];
  return raw;
}

// ------------------------------
// Load Data
// ------------------------------
async function loadData() {
  if (!shopName) {
    alert("❌ No shopName found in URL");
    return;
  }

  loadingSpinner.style.display = "block";

  try {
    const [depositData, withdrawalData, stlmData, commData, shopBalanceData] = await Promise.all([
      fetchSheet(SHEETS.DEPOSIT),
      fetchSheet(SHEETS.WITHDRAWAL),
      fetchSheet(SHEETS.STLM),
      fetchSheet(SHEETS.COMM),
      fetchSheet(SHEETS.SHOP_BALANCE)
    ]);

    const normalizedShop = normalizeString(shopName);

    // ------------------------------
    // SHOP BALANCE: B/F, Security Deposit, Team Leader
    // ------------------------------
    const shopRow = shopBalanceData.find(r => normalizeString(r["SHOP"]) === normalizedShop);

    const bringForwardBalance = parseNumber(shopRow ? rTrim(shopRow["BRING FORWARD BALANCE"]) : 0);
    const securityDeposit = parseNumber(shopRow ? rTrim(shopRow["SECURITY DEPOSIT"]) : 0);
    const teamLeader = shopRow ? rTrim(shopRow["TEAM LEADER"]) : "-";

    document.getElementById("infoShopName").textContent = shopName;
    document.getElementById("infoBFBalance").textContent = formatNumber(bringForwardBalance);
    document.getElementById("infoSecDeposit").textContent = formatNumber(securityDeposit);
    document.getElementById("infoTeamLeader").textContent = teamLeader;

    // ------------------------------
    // COMMISSION RATES
    // ------------------------------
    const commRow = commData.find(r => normalizeString(r["SHOP"]) === normalizedShop);
    const dpCommRate = parseNumber(commRow?.["DP COMM"]);
    const wdCommRate = parseNumber(commRow?.["WD COMM"]);
    const addCommRate = parseNumber(commRow?.["ADD COMM"]);

    // ------------------------------
    // Get all unique normalized dates for this shop
    // ------------------------------
    const datesSet = new Set([
      ...depositData.filter(r => normalizeString(r["SHOP"]) === normalizedShop).map(r => normalizeDate(r["DATE"])),
      ...withdrawalData.filter(r => normalizeString(r["SHOP"]) === normalizedShop).map(r => normalizeDate(r["DATE"])),
      ...stlmData.filter(r => normalizeString(r["SHOP"]) === normalizedShop).map(r => normalizeDate(r["DATE"]))
    ]);

    const sortedDates = Array.from(datesSet)
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b));

    // ------------------------------
    // Initialize totals
    // ------------------------------
    let runningBalance = bringForwardBalance;
    const totals = {
      depTotal: 0, wdTotal: 0, inAmt: 0, outAmt: 0, settlement: 0,
      specialPay: 0, adjustment: 0, secDep: 0, dpComm: 0, wdComm: 0, addComm: 0
    };
    tbody.innerHTML = "";

    // ------------------------------
    // Add B/F Balance row
    // ------------------------------
    if (bringForwardBalance || securityDeposit) {
      const bfbRow = document.createElement("tr");
      bfbRow.innerHTML = `
        <td>B/F Balance</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>${formatNumber(securityDeposit)}</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>${formatNumber(runningBalance)}</td>
      `;
      tbody.appendChild(bfbRow);
    }

    // ------------------------------
    // Loop through each date
    // ------------------------------
    for (const date of sortedDates) {
      const deposits = depositData.filter(r => normalizeString(r["SHOP"]) === normalizedShop && normalizeDate(r["DATE"]) === date);
      const withdrawals = withdrawalData.filter(r => normalizeString(r["SHOP"]) === normalizedShop && normalizeDate(r["DATE"]) === date);
      const stlmForDate = stlmData.filter(r => normalizeString(r["SHOP"]) === normalizedShop && normalizeDate(r["DATE"]) === date);

      const depTotalRow = deposits.reduce((s, r) => s + parseNumber(r["AMOUNT"]), 0);
      const wdTotalRow = withdrawals.reduce((s, r) => s + parseNumber(r["AMOUNT"]), 0);

      const sumMode = mode =>
        stlmForDate.filter(r => normalizeString(r["MODE"]) === normalizeString(mode))
          .reduce((s, r) => s + parseNumber(r["AMOUNT"]), 0);

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

      totals.depTotal += depTotalRow;
      totals.wdTotal += wdTotalRow;
      totals.inAmt += inAmtRow;
      totals.outAmt += outAmtRow;
      totals.settlement += settlementRow;
      totals.specialPay += specialPayRow;
      totals.adjustment += adjustmentRow;
      totals.secDep += secDepRow;
      totals.dpComm += dpCommRow;
      totals.wdComm += wdCommRow;
      totals.addComm += addCommRow;

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

    const rows = tbody.querySelectorAll("tr");
    if (rows.length) rows[rows.length - 1].classList.add("latest");

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
      <td>${formatNumber(runningBalance)}</td>`;

    const btn = document.getElementById("viewDailyBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        const shop = document.getElementById("infoShopName").textContent;
        if (!shop || shop === "-") {
          alert("Shop name not available yet. Please wait for data to load.");
          return;
        }
        window.location.href = `daily_transactions.html?shopName=${encodeURIComponent(shop)}`;
      });
    }

  } catch (err) {
    console.error(err);
    alert("⚠️ Error loading data: " + err.message);
  }

  loadingSpinner.style.display = "none";
}

// ------------------------------
// Initialize
// ------------------------------
loadData();
