import express from 'express';
import cors from 'cors';
import { config, emailEnabled } from './config.js';
import { pool } from './db.js';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { invitationsRouter } from './routes/invitations.js';
import { demandesRouter } from './routes/demandes.js';

const app = express();

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
);
app.use(express.json({ limit: '256kb' }));

// Santé du service
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up', email: emailEnabled ? 'configuré' : 'simulé' });
  } catch {
    res.status(503).json({ ok: false, db: 'down' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/demandes', demandesRouter);

app.use((_req, res) => res.status(404).json({ error: 'Endpoint introuvable' }));
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[server] Silverlit Analytics API — http://localhost:${config.port}`);
  console.log(`[server] CORS autorisé pour ${config.frontendUrl}`);
  console.log(`[server] Emails : ${emailEnabled ? 'Resend configuré' : 'mode simulé (lien loggé)'}`);
});

// Arrêt propre
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`\n[server] arrêt (${sig})…`);
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
