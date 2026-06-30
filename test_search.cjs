const fs = require("fs");
const content = fs.readFileSync("coduri_edevize.csv", "utf8");
const lines = content.split("\n").filter(l => l.trim() !== "");
const results = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  const firstComma = line.indexOf(",");
  const lastComma = line.lastIndexOf(",");
  if (firstComma > 0 && lastComma > firstComma) {
    const cod = line.substring(0, firstComma).trim();
    const tip = line.substring(lastComma + 1).trim();
    let denumire = line.substring(firstComma + 1, lastComma).trim();
    if (denumire.startsWith('"') && denumire.endsWith('"')) {
      denumire = denumire.substring(1, denumire.length - 1);
    }
    results.push({ cod, denumire, tip });
  }
}
const q = "zidar";
console.log(
  results
    .filter(
      r =>
        r.cod.toLowerCase().includes(q) || r.denumire.toLowerCase().includes(q)
    )
    .slice(0, 5)
);
