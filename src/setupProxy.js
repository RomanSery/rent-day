const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: "https://rentday.coderdreams.com/api",
      logLevel: 'debug',
      changeOrigin: true,      
    })
  );
};