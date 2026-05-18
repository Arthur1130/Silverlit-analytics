// Migration : applique le schéma puis crée le compte administrateur initial.
// Idempotent — peut être relancé sans risque.
//   npm run migrate

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log('[migrate] application du schéma…');
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
  console.log('[migrate] schéma OK');

  // Compte admin initial
  const { rows } = await pool.query('SELECT id FROM users WHERE pseudo = $1', [
    config.seedAdmin.pseudo,
  ]);
  if (rows.length === 0) {
    const hash = await bcrypt.hash(config.seedAdmin.password, 10);
    await pool.query(
      `INSERT INTO users (pseudo, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')`,
      [config.seedAdmin.pseudo, config.seedAdmin.name, config.seedAdmin.email, hash],
    );
    console.log(`[migrate] compte admin créé : ${config.seedAdmin.pseudo}`);
  } else {
    console.log(`[migrate] compte admin déjà présent : ${config.seedAdmin.pseudo}`);
  }

  await pool.end();
  console.log('[migrate] terminé.');
}

migrate().catch((err) => {
  console.error('[migrate] échec :', err);
  process.exit(1);
});
