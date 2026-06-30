const fs = require("fs");
const path = require("path");

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith(".css")) {
      let content = fs.readFileSync(fullPath, "utf8");

      // Remove html, body, #root rules from index.css to avoid breaking them
      content = content.replace(/html,\s*body,\s*#root\s*{[^}]*}/g, "");
      content = content.replace(
        /\*,\s*\*\s*::before,\s*\*\s*::after\s*{[^}]*}/g,
        ""
      );

      // Wrap everything in #kiosk-app-root
      const scoped = `#kiosk-app-root {\n${content}\n}`;
      fs.writeFileSync(fullPath, scoped);
      console.log(`Scoped: ${fullPath}`);
    }
  }
}

processDir("./client/src/pages/kiosk");
