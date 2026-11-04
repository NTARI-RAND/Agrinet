// Claims the email of every existing account in UserEmails. Run once after
// creating that table, before deploying the code that requires it, and again
// after the deploy. It only adds claims; Users rows are never changed.
try {
  require('dotenv').config();
} catch { /* Environment may be supplied by the process. */ }
const { claimExistingEmails } = require('../models/userEmail');

claimExistingEmails().then((report) => {
  console.log(`Claimed ${report.claimed} emails; ${report.alreadyClaimed} were already claimed.`);
  for (const ids of report.needsReview) {
    console.log(`Needs review, accounts sharing one email: ${ids.join(', ')}`);
  }
  if (report.needsReview.length) process.exitCode = 1;
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
