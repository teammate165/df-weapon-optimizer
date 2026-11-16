// Compatibility entry point for the local production browser regression.
process.env.ANYTIME_LOCAL='1';
process.env.ANYTIME_SITE_URL=process.env.LOCAL_SITE_URL||'http://127.0.0.1:8766/';
require('./anytime_browser.cjs');
