/**
 * AYA Expo Tools — Archive Routes
 *
 * Provides API endpoints for archiving exhibition data to external drives:
 *   GET  /api/archive/status  — data size, available drives
 *   POST /api/archive/start   — start archive process
 *   GET  /api/archive/report  — serve latest final report HTML
 */

'use strict';

const fs = require('fs');
const path = require('path');
const archiver = require('../../clusters/data/archiver');

module.exports = function (app, config) {
  
  // ── GET /api/archive/status ─────────────────────────────────────
  // Returns data size breakdown and available drives
  app.get('/api/archive/status', async (req, res) => {
    try {
      const sizeInfo = await archiver.calculateArchiveSize(config);
      const drives = await archiver.detectExternalDrives();

      res.json({
        dataSize: sizeInfo.totalMB,
        breakdown: sizeInfo.breakdown,
        drives: drives
      });

    } catch (err) {
      console.error(`[Archive] Status error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/archive/start ─────────────────────────────────────
  // Starts archive process to selected drive
  // Body: { drive: 'E', slug: 'beleza-astral-2025' }
  app.post('/api/archive/start', async (req, res) => {
    const { drive, slug } = req.body;

    if (!drive || !slug) {
      return res.status(400).json({ error: 'Missing drive or slug' });
    }

    try {
      // Set up SSE for progress updates
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const result = await archiver.archive(drive, slug, config, (progress) => {
        // Send progress as SSE
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      });

      // Send final result
      res.write(`data: ${JSON.stringify({ step: 'complete', result })}\n\n`);
      res.end();

    } catch (err) {
      console.error(`[Archive] Archive error: ${err.message}`);
      res.write(`data: ${JSON.stringify({ step: 'error', error: err.message })}\n\n`);
      res.end();
    }
  });

  // ── GET /api/archive/report ─────────────────────────────────────
  // Serves the latest final report HTML
  app.get('/api/archive/report', (req, res) => {
    try {
      const reportsDir = path.join(__dirname, '..', '..', 'logs', 'reports');
      
      if (!fs.existsSync(reportsDir)) {
        return res.status(404).json({ error: 'No reports available' });
      }

      // Find latest final report
      const files = fs.readdirSync(reportsDir)
        .filter(f => f.startsWith('final-report') && f.endsWith('.html'))
        .map(f => ({
          name: f,
          path: path.join(reportsDir, f),
          mtime: fs.statSync(path.join(reportsDir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length === 0) {
        return res.status(404).json({ error: 'No final report found' });
      }

      const reportPath = files[0].path;
      res.sendFile(reportPath);

    } catch (err) {
      console.error(`[Archive] Report serve error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

};
