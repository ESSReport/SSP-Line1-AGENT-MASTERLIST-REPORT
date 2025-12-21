// ------------------------------
// CONFIG
// ------------------------------
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby9cDHe1_Cy4tmldSWYHJZDi26pxYaHUTB6Wlu0XYigQJpiYbybUUmuxECtReKwqbdt/exec";
const BACKUP_INDEX_URL = "https://opensheet.elk.sh/19eCfiWh46hQUqyAwcpx4OD_3nPFDVK1p1BYbcncMT4M/Backup_Index";
const SHOP_NAME = new URLSearchParams(window.location.search).get("shopName") || "";

function normalizeShop(name) { return (name||"").trim().toUpperCase(); }

const backupList = document.getElementById("backupList");

// ------------------------------
// Load latest 7 backups
async function loadBackupLinks() {
    backupList.textContent = "Loading backup links…";

    try {
        const res = await fetch(BACKUP_INDEX_URL);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Filter backups with valid Date & FileId, latest 7 only
        const backups = data
            .filter(b => b.Date && b.FileId)
            .sort((a,b)=>b.Date.localeCompare(a.Date))
            .slice(-7)
            .reverse();

        backupList.innerHTML = "";

        backups.forEach(b => {
            const link = document.createElement("a");
            link.href = "#";
            link.textContent = `⬇ Download XLSX for ${b.Date} (backup gsheet)`;
            link.style.display = "block";
            link.style.marginBottom = "6px";

            link.addEventListener("click", async e=>{
                e.preventDefault();
                link.textContent = `⬇ Download XLSX for ${b.Date} (loading…)`;

                try {
                    // Call Web App to fetch only current shop’s data
                    const url = `${WEB_APP_URL}?fileId=${b.FileId}&shopName=${normalizeShop(SHOP_NAME)}`;
                    const response = await fetch(url);
                    const json = await response.json();

                    if(json.error) throw new Error(json.error);

                    generateXLSX(json, b.Date);

                } catch(err) {
                    console.error(err);
                    alert(`Failed to download backup for ${b.Date}: ${err.message}`);
                } finally {
                    link.textContent = `⬇ Download XLSX for ${b.Date} (backup gsheet)`;
                }
            });

            backupList.appendChild(link);
        });

        if(!backups.length) backupList.textContent = "No backups found.";

    } catch(err) {
        console.error("Failed to load backup links:", err);
        backupList.textContent = "Failed to load backup links.";
    }
}

// ------------------------------
// Generate XLSX from DP & WD data
function generateXLSX({ dp, wd }, date) {
    if(!dp.length && !wd.length) return alert("No data for this backup.");

    const headers = ["To Wallet Number","Wallet","Reference","Amount","Date","Type"];
    function mapData(arr){ return arr.map(r=>headers.map(h=>r[h]??"")); }

    const wb = XLSX.utils.book_new();
    if(dp.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers,...mapData(dp)]),"DP");
    if(wd.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers,...mapData(wd)]),"WD");

    XLSX.writeFile(wb, `Backup_Transactions_${date}.xlsx`);
}

// ------------------------------
loadBackupLinks();
