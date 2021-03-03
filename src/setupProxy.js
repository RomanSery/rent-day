const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: "https://rentday.coderdreams.com",
      changeOrigin: true,
      ws: true,
      router: {
        // when request.headers.host == 'dev.localhost:3000',
        "localhost:3000/api": "http://localhost:4000",
      },
    })
  );
};