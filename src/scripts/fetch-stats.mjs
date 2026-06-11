import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/stats.json');

// Helper to sign JWT using crypto
function signGoogleJWT(clientEmail, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Claim = Buffer.from(JSON.stringify(claim)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${base64Header}.${base64Claim}`);
  // Replace escaped newlines if privateKey was passed in env
  const formattedKey = privateKey.replace(/\\n/g, '\n');
  const signature = sign.sign(formattedKey, 'base64url');
  return `${base64Header}.${base64Claim}.${signature}`;
}

async function fetchGoogleAccessToken(jwt) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google OAuth failed: ${errText}`);
  }
  const data = await response.json();
  return data.access_token;
}

async function fetchGA4ActiveUsers(accessToken, propertyId) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GA4 runReport failed: ${errText}`);
  }
  const data = await response.json();
  const activeUsers = data.rows?.[0]?.metricValues?.[0]?.value;
  return activeUsers ? parseInt(activeUsers, 10) : null;
}

async function fetchEAIStats(token) {
  const eaiUrl = process.env.EAI_API_URL || 'https://eai.envoyou.com';
  const response = await fetch(`${eaiUrl}/api/public-stats`, {
    headers: {
      'x-api-key': token,
    },
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`EAI public-stats fetch failed: ${errText}`);
  }
  return await response.json();
}

function formatReaders(count) {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return String(count);
}

async function main() {
  // Load existing stats as fallbacks
  let stats = {
    totalDrafts: 312,
    readyRate: 94,
    monthlyReaders: "1.2K",
    systemUptime: "99.9%"
  };

  try {
    if (fs.existsSync(DATA_FILE)) {
      stats = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('Could not read existing stats.json, using defaults.');
  }

  // 1. Fetch EAI Stats
  const eaiToken = process.env.PUBLIC_STATS_TOKEN;
  if (eaiToken) {
    try {
      console.log('Fetching EAI stats...');
      const eaiData = await fetchEAIStats(eaiToken);
      stats.totalDrafts = eaiData.totalDrafts;
      stats.readyRate = eaiData.readyRate;
      stats.systemUptime = eaiData.systemUptime.endsWith('%') ? eaiData.systemUptime : eaiData.systemUptime + "%";
      console.log('EAI stats successfully fetched:', eaiData);
    } catch (err) {
      console.error('Failed to fetch EAI stats:', err.message);
    }
  } else {
    console.warn('PUBLIC_STATS_TOKEN not configured. Skipping EAI stats fetch.');
  }

  // 2. Fetch GA4 Stats
  const gaPropertyId = process.env.GA4_PROPERTY_ID;
  const gaEmail = process.env.GA4_CLIENT_EMAIL;
  const gaKey = process.env.GA4_PRIVATE_KEY;

  if (gaPropertyId && gaEmail && gaKey) {
    try {
      console.log('Fetching GA4 active users...');
      const jwt = signGoogleJWT(gaEmail, gaKey);
      const accessToken = await fetchGoogleAccessToken(jwt);
      const activeUsersCount = await fetchGA4ActiveUsers(accessToken, gaPropertyId);
      if (activeUsersCount !== null) {
        stats.monthlyReaders = formatReaders(activeUsersCount);
        console.log('GA4 active users successfully fetched:', activeUsersCount, `(${stats.monthlyReaders})`);
      }
    } catch (err) {
      console.error('Failed to fetch GA4 active users:', err.message);
    }
  } else {
    console.warn('GA4 credentials (GA4_PROPERTY_ID, GA4_CLIENT_EMAIL, GA4_PRIVATE_KEY) not configured. Skipping GA4 fetch.');
  }

  // 3. Write back to stats.json
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2), 'utf8');
    console.log('Successfully wrote combined stats to:', DATA_FILE);
  } catch (err) {
    console.error('Failed to write stats.json:', err.message);
    process.exit(1);
  }
}

main();
