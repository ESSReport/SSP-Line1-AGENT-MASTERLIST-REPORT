// auth.js

const ADMIN_PIN = "11302024";
const TL_PINS = {
  "MUNIM": "820156",
  "SHAKIL": "758482",
  "MR LEE": "340451",
  "XYZ": "716515",
  "OSMAN": "883187",
  "DARAZ": "560722",
  "SHARIF": "741041",
  "AFF JAR": "475183",
  "JAVED": "469647",
  "SAM": "493028",
  "MIR": "857030",
  "ZUBAIR": "578355",
  "ALI": "301697",
  "SVEN": "815695",
  "ONEMEN": "207988",
  "ROSE": "364769",
  "JISAN": "104766",
  "AIMAN": "587340",
  "BERLIN": "933222",
  "ALADDIN": "042599",
  "TAPAN": "902398",
  "BADBOY": "632278",
  "JEWEL": "804397",
  "SUJAN": "532478",
  "KERIO": "859614",
  "RUHUL": "859752",
  "RAY": "859833",
  "TANVIR": "463564",
  "ISMAIL": "859632",
  "PALI": "398624",
  "SAGOR": "637841",
  "EMON": "865212",
  "RIDOY": "649467",
  "RIPAN": "943516",
  "MIRAAN": "823465",
  "MONIR": "578416",
  "SHIK": "521479",
  "SONCHOY": "812458",
  "MANTU": "953247",
  "NIHJUM": "945632",
  "CHAK": "584124",
  "SOHARD": "872564"
};

// -------------------------
// Admin Access
// -------------------------
window.requireAdmin = async function() {
  if (sessionStorage.getItem("isAdmin") === "true") return true;
  const entered = prompt("🔐 Enter Admin PIN:");
  if (entered === ADMIN_PIN) {
    sessionStorage.setItem("isAdmin", "true");
    return true;
  }
  throw new Error("Invalid Admin PIN");
};

// -------------------------
// Team Leader Access
// -------------------------
window.requireTeamLeader = async function(tlName) {
  const tl = tlName.toUpperCase();
  if (!TL_PINS[tl]) throw new Error("Team Leader not registered");

  // Check session
  if (sessionStorage.getItem("currentTL") === tl) return true;

  const entered = prompt(`🔐 Enter PIN for Team Leader: ${tl}`);
  if (entered === TL_PINS[tl]) {
    sessionStorage.setItem("currentTL", tl);
    return true;
  }
  throw new Error("Invalid TL PIN");
};

// Unified check
window.checkTLAccess = async function(tlName) {
  if (!tlName) throw new Error("Team Leader not specified");
  return await window.requireTeamLeader(tlName);
};














