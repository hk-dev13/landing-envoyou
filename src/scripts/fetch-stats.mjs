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

async function fetchGA4Stats(accessToken, propertyId) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GA4 runReport failed: ${errText}`);
  }
  const data = await response.json();
  const metricValues = data.rows?.[0]?.metricValues;
  const activeUsers = metricValues?.[0]?.value ? parseInt(metricValues[0].value, 10) : null;
  const pageViews = metricValues?.[1]?.value ? parseInt(metricValues[1].value, 10) : null;
  return { activeUsers, pageViews };
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

async function fetchBlogStats() {
  const blogApiUrl = process.env.BLOG_API_URL || 'https://api.envoyou.com/api';
  
  // Fetch posts (up to 100)
  const postsRes = await fetch(`${blogApiUrl}/posts?limit=100`);
  if (!postsRes.ok) {
    const errText = await postsRes.text();
    throw new Error(`Blog posts fetch failed: ${errText}`);
  }
  const postsData = await postsRes.json();
  const posts = postsData.data || [];
  const publishedArticles = postsData.meta?.total || posts.length || 25;

  // Calculate average reading time
  let totalReadingTime = 0;
  let countWithReadingTime = 0;
  posts.forEach(post => {
    if (post.reading_time) {
      totalReadingTime += post.reading_time;
      countWithReadingTime++;
    }
  });
  const avgReadingTime = countWithReadingTime > 0 ? Math.round(totalReadingTime / countWithReadingTime) : 5;

  // Find top article views count
  let topArticleViews = 150;
  if (posts.length > 0) {
    const sorted = [...posts].sort((a, b) => (b.views || 0) - (a.views || 0));
    if (sorted[0] && typeof sorted[0].views === 'number') {
      topArticleViews = sorted[0].views;
    }
  }

  // Fetch categories
  const catsRes = await fetch(`${blogApiUrl}/categories`);
  if (!catsRes.ok) {
    const errText = await catsRes.text();
    throw new Error(`Blog categories fetch failed: ${errText}`);
  }
  const catsData = await catsRes.json();
  const categoriesList = catsData.data || [];
  const categoriesCount = categoriesList.length || 4;

  // Find top category by post_count
  let topCategory = "Bisnis & Teknologi";
  if (categoriesList.length > 0) {
    const sorted = [...categoriesList].sort((a, b) => (b.post_count || 0) - (a.post_count || 0));
    if (sorted[0] && sorted[0].name) {
      topCategory = sorted[0].name;
    }
  }

  return {
    publishedArticles,
    categoriesCount,
    topCategory,
    topArticleViews,
    avgReadingTime
  };
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

function formatDate(date) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function get30DaysRangeString() {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  return `${formatDate(thirtyDaysAgo)} - ${formatDate(today)}`;
}

async function main() {
  // Load existing stats as fallbacks
  let stats = {
    dateRange: "13 May 2026 - 12 June 2026",
    totalDrafts: 17,
    readyRate: 43,
    monthlyReaders: "2.4K",
    systemUptime: "100%",
    blog: {
      publishedArticles: 25,
      views30Days: "2.8K",
      categoriesCount: 4,
      topCategory: "Bisnis & Teknologi",
      topArticleViews: 150,
      avgReadingTime: 5
    },
    eai: {
      cmsExportSuccess: "100%",
      brandVoiceAlignment: "82.0%",
      seoCompletionRate: "88.0%",
      avgAiCostPerArticle: "$0.017",
      pricingVersion: "2026-06-12",
      draftsThisMonth: 12,
      avgProcessTimeMins: 1.8,
      finishedDrafts: 15
    }
  };

  try {
    if (fs.existsSync(DATA_FILE)) {
      const existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      stats = {
        ...stats,
        ...existing,
        blog: { ...stats.blog, ...existing.blog },
        eai: { ...stats.eai, ...existing.eai }
      };
    }
  } catch (err) {
    console.warn('Could not read existing stats.json, using defaults.');
  }

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

  stats.dateRange = get30DaysRangeString();

  // 1. Fetch Blog Stats
  try {
    console.log('Fetching Blog stats...');
    const blogData = await fetchBlogStats();
    stats.blog.publishedArticles = blogData.publishedArticles;
    stats.blog.categoriesCount = blogData.categoriesCount;
    stats.blog.topCategory = blogData.topCategory;
    stats.blog.topArticleViews = blogData.topArticleViews;
    stats.blog.avgReadingTime = blogData.avgReadingTime;
    console.log('Blog stats successfully fetched:', blogData);
  } catch (err) {
    console.warn('WARNING: Failed to fetch Blog stats (falling back to stats.json):', err.message);
  }

  // 2. Fetch EAI Stats
  const eaiToken = process.env.PUBLIC_STATS_TOKEN;
  if (eaiToken) {
    try {
      console.log('Fetching EAI stats...');
      const eaiData = await fetchEAIStats(eaiToken);
      stats.totalDrafts = eaiData.totalDrafts;
      stats.readyRate = eaiData.readyRate;
      stats.systemUptime = eaiData.systemUptime.endsWith('%') ? eaiData.systemUptime : eaiData.systemUptime + "%";
      if (eaiData.avgAiCostPerArticle) {
        stats.eai.avgAiCostPerArticle = eaiData.avgAiCostPerArticle;
      }
      if (eaiData.pricingVersion) {
        stats.eai.pricingVersion = eaiData.pricingVersion;
      }
      if (eaiData.draftsThisMonth !== undefined) {
        stats.eai.draftsThisMonth = eaiData.draftsThisMonth;
      }
      if (eaiData.avgProcessTimeMins !== undefined) {
        stats.eai.avgProcessTimeMins = eaiData.avgProcessTimeMins;
      }
      if (eaiData.finishedDrafts !== undefined) {
        stats.eai.finishedDrafts = eaiData.finishedDrafts;
      }
      if (eaiData.cmsExportSuccess !== undefined) {
        stats.eai.cmsExportSuccess = eaiData.cmsExportSuccess;
      }
      if (eaiData.seoCompletionRate !== undefined) {
        stats.eai.seoCompletionRate = eaiData.seoCompletionRate;
      }
      console.log('EAI stats successfully fetched:', eaiData);
    } catch (err) {
      console.warn('WARNING: Failed to fetch EAI stats (falling back to stats.json):', err.message);
    }
  } else {
    console.warn('PUBLIC_STATS_TOKEN not configured. Skipping EAI stats fetch.');
  }

  // 3. Fetch GA4 Stats
  const gaPropertyId = process.env.GA4_PROPERTY_ID;
  const gaEmail = process.env.GA4_CLIENT_EMAIL;
  const gaKey = process.env.GA4_PRIVATE_KEY;

  if (gaPropertyId && gaEmail && gaKey) {
    try {
      console.log('Fetching GA4 stats...');
      const jwt = signGoogleJWT(gaEmail, gaKey);
      const accessToken = await fetchGoogleAccessToken(jwt);
      const gaData = await fetchGA4Stats(accessToken, gaPropertyId);
      if (gaData.activeUsers !== null) {
        stats.monthlyReaders = formatReaders(gaData.activeUsers);
        console.log('GA4 active users successfully fetched:', gaData.activeUsers, `(${stats.monthlyReaders})`);
      }
      if (gaData.pageViews !== null) {
        stats.blog.views30Days = formatReaders(gaData.pageViews);
        console.log('GA4 page views successfully fetched:', gaData.pageViews, `(${stats.blog.views30Days})`);
      }
    } catch (err) {
      console.warn('WARNING: Failed to fetch GA4 stats (falling back to stats.json):', err.message);
    }
  } else {
    console.warn('GA4 credentials (GA4_PROPERTY_ID, GA4_CLIENT_EMAIL, GA4_PRIVATE_KEY) not configured. Skipping GA4 fetch.');
  }

  // 4. Write back to stats.json
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

main().catch((err) => {
  console.error('\n=============================================');
  console.error(`BUILD FAILED: ${err.message}`);
  console.error('=============================================\n');
  process.exit(1);
});
