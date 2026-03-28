/**
 * Patch: add keepAliveTimeout + headersTimeout to expo-tools server
 * Fixes CLOSE_WAIT leak from portal push/health polling
 */
const fs = require('fs');
const f = 'C:\\aya-expo-tools\\server\\index.js';
let code = fs.readFileSync(f, 'utf8');

// Check if already patched
if (code.includes('keepAliveTimeout')) {
  console.log('SKIP - already patched (keepAliveTimeout found)');
  process.exit(0);
}

// Add timeouts after server.listen block's opening line
// Target: server.listen(PORT, HOST, () => {
const target = "server.listen(PORT, HOST, () => {";
const replacement = `// ─── HTTP Timeouts (fix CLOSE_WAIT leak) ───────────────────
// Portal polls every 30s. Without these, idle sockets accumulate
// as CLOSE_WAIT and eventually exhaust the event loop.
server.keepAliveTimeout = 30000;   // close idle keep-alive sockets after 30s
server.headersTimeout = 35000;     // must be > keepAliveTimeout
server.requestTimeout = 30000;     // kill requests that take > 30s
server.timeout = 120000;           // overall socket timeout 2min

server.listen(PORT, HOST, () => {`;

if (!code.includes(target)) {
  console.log('ERROR - could not find server.listen target');
  process.exit(1);
}

code = code.replace(target, replacement);
fs.writeFileSync(f, code, 'utf8');
console.log('OK - patched server timeouts (keepAlive=30s, headers=35s, request=30s, socket=120s)');
