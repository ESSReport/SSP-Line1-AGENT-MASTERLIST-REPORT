/* =========================================================
   DASHBOARD.JS – FINAL INTEGRATED VERSION
   ========================================================= */

/* -------------------------
   Configuration / Helpers
------------------------- */
const SHEET_ID = "1w5PrRJ9DFTAt8UmkJKlCLwK0mbvxCtjFX7jcVFli0gA";
const OPENSHEET_BASE = `https://opensheet.elk.sh/${SHEET_ID}`;
const OPENSHEET = {
  SHOPS_BALANCE: `${OPENSHEET_BASE}/SHOPS%20BALANCE`,
  DEPOSIT: `${OPENSHEET_BASE}/TOTAL%20DEPOSIT`,
  WITHDRAWAL: `${OPENSHEET_BASE}/TOTAL%20WITHDRAWAL`,
  STLM: `${OPENSHEET_BASE}/STLM%2FTOPUP`,
  COMM: `${OPENSHEET_BASE}/COMM`
};

const HEADERS = [
  "SHOP NAME","TEAM LEADER","GROUP NAME","SECURITY DEPOSIT","BRING FORWARD BALANCE",
  "TOTAL DEPOSIT","TOTAL WITHDRAWAL","INTERNAL TRANSFER IN","INTERNAL TRANSFER OUT",
  "SETTLEMENT","SPECIAL PAYMENT","ADJUSTMENT","DP COMM","WD COMM","ADD COMM","RUNNING BALANCE"
];

const cleanKey = k => String(k||"").replace(/\s+/g," ").trim().toUpperCase();
const parseNumber = v => {
  if (v === undefined || v === null || v === "") return 0;
  const s = String(v).replace(/,/g,"").replace(/\((.*)\)/,"-$1").trim();
  const n = Number(s);
  return isFinite(n) ? n : 0;
};
const parseCommRate = v => {
  if (!v) return 0;
  return parseFloat(String(v).replace("%",""))||0;
};
const normalize = row => {
  const out = {};
  for (const k in row) out[cleanKey(k)] = String(row[k]||"").trim();
  return out;
};

let rawData = [], cachedData = [], filteredData = [];
let currentPage = 1, rowsPerPage = 20;

/* -------------------------
   Fetch & Build Summary
------------------------- */
async function fetchShopsBalance(){
  const res = await fetch(OPENSHEET.SHOPS_BALANCE);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.map(normalize);
}

function buildSummary(data){
  const summary = {};
  data.forEach(r=>{
    const shop = (r["SHOP"]||r["SHOP NAME"]||"").trim();
    if(!shop) return;
    if(!summary[shop]) summary[shop] = Object.assign({}, ...HEADERS.map(h=> ({
      [h]: (h==="SHOP NAME"? shop : (h==="TEAM LEADER"? ((r["TEAM LEADER"]||"").trim().toUpperCase()) : (h==="GROUP NAME"? ((r["GROUP NAME"]||"").trim().toUpperCase()) : 0) ))
    })));
    ["SECURITY DEPOSIT","BRING FORWARD BALANCE","TOTAL DEPOSIT","TOTAL WITHDRAWAL","INTERNAL TRANSFER IN","INTERNAL TRANSFER OUT","SETTLEMENT","SPECIAL PAYMENT","ADJUSTMENT","DP COMM","WD COMM","ADD COMM"].forEach(key=>{
      summary[shop][key] = (summary[shop][key] || 0) + parseNumber(r[key]);
    });
    summary[shop]["RUNNING BALANCE"] = 
      (summary[shop]["BRING FORWARD BALANCE"]||0) +
      (summary[shop]["TOTAL DEPOSIT"]||0) - (summary[shop]["TOTAL WITHDRAWAL"]||0) +
      (summary[shop]["INTERNAL TRANSFER IN"]||0) - (summary[shop]["INTERNAL TRANSFER OUT"]||0) -
      (summary[shop]["SETTLEMENT"]||0) - (summary[shop]["SPECIAL PAYMENT"]||0) +
      (summary[shop]["ADJUSTMENT"]||0) - (summary[shop]["DP COMM"]||0) -
      (summary[shop]["WD COMM"]||0) - (summary[shop]["ADD COMM"]||0);
    summary[shop]["WALLET NUMBER"] = r["WALLET NUMBER"] || summary[shop]["WALLET NUMBER"];
  });
  cachedData = Object.values(summary);
  filteredData = cachedData;
  renderTable();
}

/* -------------------------
   Render Table & Totals
------------------------- */
function renderTable(){
  const tableHead = document.getElementById("tableHeader");
  const tableBody = document.getElementById("tableBody");
  tableHead.innerHTML = ""; tableBody.innerHTML = "";

  HEADERS.forEach(h=>{
    const th=document.createElement("th"); th.textContent=h; tableHead.appendChild(th);
  });

  const start = (currentPage-1)*rowsPerPage;
  const pageData = filteredData.slice(start, start+rowsPerPage);

  pageData.forEach(r=>{
    const tr=document.createElement("tr");
    HEADERS.forEach(h=>{
      const td=document.createElement("td");
      if(h==="SHOP NAME"){
        const a=document.createElement("a");
        a.textContent = r[h] + (r["WALLET NUMBER"]? ` (${r["WALLET NUMBER"]})` : "");
        a.href = `shop_dashboard.html?shopName=${encodeURIComponent(r[h])}`;
        a.target="_blank";
        a.style.color = "#0077cc";
        a.style.textDecoration = "underline";
        td.appendChild(a);
      } else if(["TEAM LEADER","GROUP NAME"].includes(h)){
        td.textContent = r[h] || "";
      } else {
        td.textContent = (Number(r[h])||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
      }
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });

  updatePagination();
  renderTotals();
  updateTeamDashboardLink();
}

function renderTotals(){
  const totalsDiv = document.getElementById("totalsRow");
  totalsDiv.innerHTML = "";
  HEADERS.forEach(h=>{
    if(["SHOP NAME","TEAM LEADER","GROUP NAME"].includes(h)) return;
    const total = filteredData.reduce((a,b)=> a + (parseNumber(b[h])||0), 0);
    const card=document.createElement("div");
    card.className="total-card";
    card.innerHTML = `<div>${h}</div><div>${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>`;
    totalsDiv.appendChild(card);
  });
}

function updatePagination(){
  const totalPages = Math.ceil(filteredData.length/rowsPerPage) || 1;
  document.getElementById("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
  document.getElementById("prevPage").disabled = currentPage===1;
  document.getElementById("nextPage").disabled = currentPage===totalPages;
}

function updateTeamDashboardLink(){
  const leader = document.getElementById("leaderFilter").value;
  const linkDiv = document.getElementById("teamDashboardLink");
  if(leader && leader!=="ALL"){
    const url = `${window.location.origin}${window.location.pathname}?teamLeader=${encodeURIComponent(leader)}`;
    linkDiv.innerHTML = `<a href="${url}" target="_blank" style="color:#0077cc;font-weight:bold;text-decoration:underline">Open ${leader} Dashboard in New Tab</a>`;
  } else linkDiv.innerHTML = "";
}

/* -------------------------
   Filters
------------------------- */
function buildTeamLeaderDropdown(data){
  const dd = document.getElementById("leaderFilter");
  dd.innerHTML = '<option value="ALL">All Team Leaders</option>';
  const leaders = [...new Set(data.map(r=> (r["TEAM LEADER"]||"").trim().toUpperCase()))].filter(x=>x&&x!=="#N/A"&&x!=="N/A").sort();
  leaders.forEach(l=>{ const opt=document.createElement("option"); opt.value=l; opt.textContent=l; dd.appendChild(opt); });
}

function buildGroupDropdown(data, selectedLeader="ALL"){
  const dd = document.getElementById("groupFilter");
  dd.innerHTML = '<option value="ALL">All Groups</option>';
  const groups = [...new Set(data.filter(r=> selectedLeader==="ALL" || (r["TEAM LEADER"]||"").toUpperCase()===selectedLeader).map(r=> (r["GROUP NAME"]||"").trim().toUpperCase()))].filter(x=>x&&x!=="#N/A"&&x!=="N/A").sort();
  groups.forEach(g=>{ const opt=document.createElement("option"); opt.value=g; opt.textContent=g; dd.appendChild(opt); });
}

function filterData(){
  const leader = document.getElementById("leaderFilter").value;
  const group = document.getElementById("groupFilter").value;
  const search = document.getElementById("searchInput").value.trim().toUpperCase();
  filteredData = cachedData.filter(r=>{
    const matchLeader = leader==="ALL" || (r["TEAM LEADER"]||"").toUpperCase()===leader;
    const matchGroup = group==="ALL" || (r["GROUP NAME"]||"").toUpperCase()===group;
    const matchSearch = (r["SHOP NAME"]||"").toUpperCase().includes(search);
    return matchLeader && matchGroup && matchSearch;
  });
  currentPage = 1; renderTable();
}

/* -------------------------
   CSV Export
------------------------- */
function exportCSV() {
  if (!filteredData.length) { alert("No data to export"); return; }
  const rows = [HEADERS.join(",")];
  filteredData.forEach(r=>{
    const row = HEADERS.map(h=> {
      const v = (r[h] === undefined || r[h] === null) ? "" : String(r[h]);
      return `"${v.replace(/"/g,'""')}"`;
    }).join(",");
    rows.push(row);
  });
  const blob = new Blob([rows.join("\n")], {type:"text/csv;charset=utf-8"});
  if (typeof saveAs !== "function") { alert("Download failed: FileSaver.js not loaded."); return; }
  saveAs(blob, `Shops_Summary_${new Date().toISOString().slice(0,10)}.csv`);
}

/* -------------------------
   ZIP Download – B/F Balance & COMM
------------------------- */
async function downloadAllShops() {
  if (!cachedData.length) { alert("No shop data available"); return; }
  const zip = new JSZip();

  try {
    const [depositData, withdrawalData, stlmData, commDataRaw, shopBalanceDataRaw] = await Promise.all([
      fetch(OPENSHEET.DEPOSIT).then(r=>r.json()),
      fetch(OPENSHEET.WITHDRAWAL).then(r=>r.json()),
      fetch(OPENSHEET.STLM).then(r=>r.json()),
      fetch(OPENSHEET.COMM).then(r=>r.json()),
      fetch(OPENSHEET.SHOPS_BALANCE).then(r=>r.json())
    ]);

    const shopBalanceData = shopBalanceDataRaw.map(normalize);
    const commData = commDataRaw.map(normalize);
    const normalizeStr = str => (str||"").trim().toUpperCase();
    const parseNum = v => { if (!v) return 0; const s=String(v).replace(/,/g,"").replace(/\((.*)\)/,"-$1").trim(); return Number(s)||0; };
    const parseComm = v => { if(!v) return 0; return parseFloat(String(v).replace("%",""))||0; };
    const formatNum = v => (v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

    for (const shop of cachedData) {
      const shopName = shop["SHOP NAME"];
      const normalizedShop = normalizeStr(shopName);
      const teamLeader = shop["TEAM LEADER"] || "Unknown";

      const shopRow = shopBalanceData.find(r => normalizeStr(r["SHOP"]) === normalizedShop);
      const bringForwardBalance = parseNum(shopRow?.["BRING FORWARD BALANCE"] || shopRow?.["OPENING BALANCE"] || 0);
      const securityDeposit = parseNum(shopRow?.["SECURITY DEPOSIT"] || 0);

      const commRow = commData.find(r => normalizeStr(r["SHOP"]) === normalizedShop);
      const dpCommRate = parseComm(commRow?.["DP COMM"] || 0);
      const wdCommRate = parseComm(commRow?.["WD COMM"] || 0);
      const addCommRate = parseComm(commRow?.["ADD COMM"] || 0);

      const datesSet = new Set([
        ...depositData.filter(r=>normalizeStr(r.SHOP)===normalizedShop).map(r=>r.DATE),
        ...withdrawalData.filter(r=>normalizeStr(r.SHOP)===normalizedShop).map(r=>r.DATE),
        ...stlmData.filter(r=>normalizeStr(r.SHOP)===normalizedShop).map(r=>r.DATE)
      ]);
      const sortedDates = Array.from(datesSet).filter(Boolean).sort((a,b)=>new Date(a)-new Date(b));

      let runningBalance = bringForwardBalance;
      const csvRows = [];

      csvRows.push(shopName);
      csvRows.push(`Shop Name: ${shopName}`);
      csvRows.push(`Security Deposit: ${formatNum(securityDeposit)}`);
      csvRows.push(`Bring Forward Balance: ${formatNum(bringForwardBalance)}`);
      csvRows.push(`Team Leader: ${teamLeader}`);
      const headers = ["DATE","DEPOSIT","WITHDRAWAL","IN","OUT","SETTLEMENT","SPECIAL PAYMENT","ADJUSTMENT","SEC DEPOSIT","DP COMM","WD COMM","ADD COMM","BALANCE"];
      csvRows.push(headers.map(h=>`"${h}"`).join(','));

      // B/F Balance row
      csvRows.push([
        'B/F Balance','0','0','0','0','0','0','0','0',
        formatNum(bringForwardBalance*dpCommRate/100),
        formatNum(bringForwardBalance*wdCommRate/100),
        formatNum(bringForwardBalance*addCommRate/100),
        formatNum(runningBalance)
      ].map(v=>`"${v}"`).join(','));

      for (const date of sortedDates) {
        const deposits = depositData.filter(r=>normalizeStr(r.SHOP)===normalizedShop && r.DATE===date);
        const withdrawals = withdrawalData.filter(r=>normalizeStr(r.SHOP)===normalizedShop && r.DATE===date);
        const stlmForDate = stlmData.filter(r=>normalizeStr(r.SHOP)===normalizedShop && r.DATE===date);

        const depTotal = deposits.reduce((s,r)=>s+parseNum(r.AMOUNT),0);
        const wdTotal = withdrawals.reduce((s,r)=>s+parseNum(r.AMOUNT),0);
        const sumMode = mode => stlmForDate.filter(r=>normalizeStr(r.MODE)===mode).reduce((s,r)=>s+parseNum(r.AMOUNT),0);

        const inAmt = sumMode("IN");
        const outAmt = sumMode("OUT");
        const settlement = sumMode("SETTLEMENT");
        const specialPay = sumMode("SPECIAL PAYMENT");
        const adjustment = sumMode("ADJUSTMENT");
        const secDep = sumMode("SECURITY DEPOSIT");

        const dpComm = depTotal*dpCommRate/100;
        const wdComm = wdTotal*wdCommRate/100;
        const addComm = depTotal*addCommRate/100;

        runningBalance += depTotal - wdTotal + inAmt - outAmt - settlement - specialPay + adjustment - dpComm - wdComm - addComm;

        csvRows.push([
          date,
          formatNum(depTotal),
          formatNum(wdTotal),
          formatNum(inAmt),
          formatNum(outAmt),
          formatNum(settlement),
          formatNum(specialPay),
          formatNum(adjustment),
          formatNum(secDep),
          formatNum(dpComm),
          formatNum(wdComm),
          formatNum(addComm),
          formatNum(runningBalance)
        ].map(v=>`"${v}"`).join(','));
      }

      const folder = zip.folder(teamLeader);
      folder.file(`${shopName}.csv`, csvRows.join('\n'));
    }

    const content = await zip.generateAsync({type:"blob"});
    saveAs(content, `All_Shops_Summary_${new Date().toISOString().slice(0,10)}.zip`);

  } catch(err){
    console.error(err);
    alert("⚠️ Failed to generate ZIP: "+err.message);
  }
}

/* -------------------------
   Init Dashboard
------------------------- */
async function initDashboard() {
  try {
    rawData = await fetchShopsBalance();
    buildTeamLeaderDropdown(rawData);
    buildGroupDropdown(rawData);
    buildSummary(rawData);

    const params = new URLSearchParams(window.location.search);
    const leaderParam = (params.get("teamLeader") || "").toUpperCase();
    if (leaderParam) {
      const leaderSelect = document.getElementById("leaderFilter");
      if (leaderSelect) {
        leaderSelect.value = leaderParam;
        leaderSelect.disabled = true;
        buildGroupDropdown(rawData, leaderParam);
        filterData();
      }
    }

    const leaderFilter = document.getElementById("leaderFilter");
    const groupFilter = document.getElementById("groupFilter");
    const searchInput = document.getElementById("searchInput");
    const prevPage = document.getElementById("prevPage");
    const nextPage = document.getElementById("nextPage");
    const exportBtn = document.getElementById("exportBtn");
    const zipBtn = document.getElementById("downloadAllShopsBtn");

    if (leaderFilter) leaderFilter.addEventListener("change", e => { buildGroupDropdown(rawData, e.target.value); filterData(); });
    if (groupFilter) groupFilter.addEventListener("change", filterData);
    if (searchInput) searchInput.addEventListener("input", filterData);
    if (prevPage) prevPage.addEventListener("click", ()=>{ if(currentPage>1){ currentPage--; renderTable(); }});
    if (nextPage) nextPage.addEventListener("click", ()=>{ if(currentPage < Math.ceil(filteredData.length/rowsPerPage)){ currentPage++; renderTable(); }});
    if (exportBtn) exportBtn.addEventListener("click", exportCSV);
    if (zipBtn) zipBtn.addEventListener("click", downloadAllShops);

  } catch(err){ console.error(err); alert("Failed to initialize dashboard: "+err.message); }
}

window.addEventListener("DOMContentLoaded", initDashboard);
