import pg from 'pg';
import { config } from './config.js';

// Pool de connexions Postgres partagé par toute l'application.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  // SSL automatique pour les bases hébergées (Heroku, Supabase, Railway…),
  // désactivé en local.
  ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('[db] erreur inattendue sur un client inactif :', err);
});

// Helper typé pour les requêtes
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}
