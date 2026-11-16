const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const PUBLIC_KEYS = [
  'DENTRA_API_URL',
  'DENTRA_SUPPORT_EMAIL',
  'DENTRA_PUSH_ENABLED',
  'DENTRA_PUSH_IOS_ENABLED',
];

// Babel and Metro must use the same public configuration snapshot.
module.exports = function readPublicEnvironment(
  file = path.join(__dirname, '.env'),
  environment = process.env
) {
  const local = fs.existsSync(file)
    ? parseEnv(fs.readFileSync(file, 'utf8'))
    : {};
  return Object.fromEntries(
    PUBLIC_KEYS.map(key => [key, environment[key] || local[key] || undefined])
  );
};
