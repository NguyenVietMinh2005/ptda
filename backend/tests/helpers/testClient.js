// backend/tests/helpers/testClient.js

/**
 * Executes an HTTP request against an Express app on an ephemeral port
 * and automatically closes the server upon receiving the response.
 */
export async function makeRequest(app, path, options = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', async () => {
      try {
        const port = server.address().port;
        const url = `http://127.0.0.1:${port}${path}`;
        
        const fetchOptions = {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          },
        };

        if (options.body && typeof options.body === 'object') {
          fetchOptions.body = JSON.stringify(options.body);
        } else if (options.body) {
          fetchOptions.body = options.body;
        }

        const response = await fetch(url, fetchOptions);
        const text = await response.text();
        let body = null;
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }

        server.close(() => {
          resolve({
            status: response.status,
            body,
            headers: response.headers,
          });
        });
      } catch (err) {
        server.close(() => {
          reject(err);
        });
      }
    });
  });
}

