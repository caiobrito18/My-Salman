const { MongoClient } = require('mongodb');
const connectionString = process.env.MONGODB_URL;
const client = new MongoClient(connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let dbConnection;

module.exports = {
  connectToServer: function () {
    client.connect(function (err, db) {
      if (err || !db) {
        return console.log(err);
      }

      dbConnection = db.db('mrdev');
      console.log('Successfully connected to MongoDB.');
    });
  },

  getDb: function () {
    return dbConnection;
  },
};
