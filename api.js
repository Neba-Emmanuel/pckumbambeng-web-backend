const app = require('./dist/app').default || require('./dist/app');

module.exports = function handler(req, res) {
  app(req, res);
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
