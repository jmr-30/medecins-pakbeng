// Chromium : celui fourni par Playwright, ou celui indiqué par la variable CHROMIUM
const fs = require('fs');
module.exports = (o = {}) => {
  const p = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  return p ? { executablePath: p, ...o } : o;
};
// Rôle de l'appareil fixé d'avance (évite la question posée au premier lancement)
module.exports.role = (p, r = 'tablette') => p.addInitScript(r => { try { if (!localStorage.getItem('role_appareil')) localStorage.setItem('role_appareil', r); } catch(e) {} }, r);
