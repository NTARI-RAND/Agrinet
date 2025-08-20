const Listing = require("../marketplace/models/listings");
const Transaction = require("../models/transaction");
const User = require("../models/user");

async function importFederatedData(data) {
  for (const listing of data.listings || []) {
    await Listing.updateOne(
      { _id: listing._id },
      { $set: listing },
      { upsert: true }
    );
  }
  for (const transaction of data.transactions || []) {
    await Transaction.updateOne(
      { _id: transaction._id },
      { $set: transaction },
      { upsert: true }
    );
  }
  for (const user of data.users || []) {
    await User.updateOne(
      { _id: user._id },
      { $set: user },
      { upsert: true }
    );
  }
  return { success: true };
}

module.exports = { importFederatedData };
