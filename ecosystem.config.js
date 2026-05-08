const fs = require('fs');

function loadEnvFile(filePath) {
  const env = {};

  if (!fs.existsSync(filePath)) {
    return env;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const apiEnv = loadEnvFile('/var/www/restoran-saas/apps/api/.env');
const webEnv = loadEnvFile('/var/www/restoran-saas/apps/web/.env.local');

module.exports = {
  apps: [
    {
      name: 'restoran-api',
      cwd: '/var/www/restoran-saas/apps/api',
      script: 'dist/main.js',
      instances: 3,
      exec_mode: 'cluster',
      env: {
        MAPBOX_TOKEN: apiEnv.MAPBOX_TOKEN || '',
        ...apiEnv,
        NODE_ENV: 'production',
        PORT: apiEnv.PORT || '4000',
      },
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
    },
    {
      name: 'restoran-web',
      cwd: '/var/www/restoran-saas/apps/web',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        ...webEnv,
        NEXT_PUBLIC_MAPBOX_TOKEN:
          webEnv.NEXT_PUBLIC_MAPBOX_TOKEN || apiEnv.MAPBOX_TOKEN || '',
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
    },
  ],
};
