// core/routes/session.js
module.exports = function(app, { session, addLogEntry, readLog, writeLog, broadcast }) {
  // ─── API: Session (Ciclo 3 — R4) ───────────────────────────
  app.get('/api/session', (req, res) => {
    res.json(session);
  });

  app.post('/api/session/start', (req, res) => {
    if (session.active) {
      return res.json({ ok: true, message: 'Sessão já ativa', session });
    }
    session.active = true;
    session.startedAt = new Date().toISOString();
    session.startedBy = req.body?.by || 'local';
    broadcast('session', session);

    // Log
    const entries = readLog();
    entries.unshift({ message: `🟢 Sessão iniciada por ${session.startedBy}`, type: 'session', timestamp: session.startedAt });
    if (entries.length > 200) entries.splice(200);
    writeLog(entries);

    console.log(`  🟢 Sessão ativa — comandos remotos destrutivos bloqueados`);
    res.json({ ok: true, session });
  });

  app.post('/api/session/end', (req, res) => {
    if (!session.active) {
      return res.json({ ok: true, message: 'Sessão já inativa', session });
    }
    session.active = false;
    const endedAt = new Date().toISOString();
    broadcast('session', session);

    // Log
    const entries = readLog();
    entries.unshift({ message: `🔴 Sessão encerrada`, type: 'session', timestamp: endedAt });
    if (entries.length > 200) entries.splice(200);
    writeLog(entries);

    session.startedAt = null;
    session.startedBy = null;
    console.log(`  🔴 Sessão encerrada — comandos remotos liberados`);
    res.json({ ok: true, session });
  });
};
