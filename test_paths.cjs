const fs = require('fs');
const path = require('path');
const p1 = path.resolve(process.cwd(), "client/public/logo.png");
const p2 = path.resolve(__dirname, "../client/public/logo.png");
console.log("CWD:", process.cwd());
console.log("P1:", p1, "Exists:", fs.existsSync(p1));
console.log("P2:", p2, "Exists:", fs.existsSync(p2));
