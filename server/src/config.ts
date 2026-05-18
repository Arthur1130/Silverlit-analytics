import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Variable d'environnement manquante : ${name} (voir server/.env.example)`);
  }
  return v.trim();
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : fallback;
}

export const config = {
  port: parseInt(optional('PORT', '4000'), 10),
  frontendUrl: optional('FRONTEND_URL', 'http://localhost:5173'),

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '12h'),

  seedAdmin: {
    pseudo: optional('SEED_ADMIN_PSEUDO', 'arthur1130'),
    password: optional('SEED_ADMIN_PASSWORD', 'arthur1234'),
    email: optional('SEED_ADMIN_EMAIL', 'arthur1130@silverlit.fr'),
    name: optional('SEED_ADMIN_NAME', 'Arthur Leroy Sahli'),
  },

  // L'envoi d'email est optionnel : sans clé Resend, le serveur démarre quand
  // même et les invitations sont créées, mais l'email n'est pas expédié
  // (le lien est alors loggé en console pour la démo).
  resendApiKey: process.env.RESEND_API_KEY?.trim() || '',
  emailFrom: optional('EMAIL_FROM', 'Silverlit Analytics <onboarding@resend.dev>'),
  invitationTtlHours: parseInt(optional('INVITATION_TTL_HOURS', '120'), 10),
};

export const emailEnabled = config.resendApiKey.length > 0;
