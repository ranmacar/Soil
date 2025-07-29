export function cors(options = {}) {
    const {
        origin = '*',
        methods = 'GET,HEAD,PUT,PATCH,POST,DELETE',
        headers = 'Content-Type,Authorization,X-Requested-With',
        credentials = 'true'
    } = options;

    return (request) => {
        const responseHeaders = {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': methods,
            'Access-Control-Allow-Headers': headers,
            'Access-Control-Allow-Credentials': credentials,
        };

        // Handle preflight requests
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: responseHeaders,
            });
        }

        // Add CORS headers to actual responses
        return (response) => {
            if (response) {
                Object.entries(responseHeaders).forEach(([key, value]) => {
                    response.headers.set(key, value);
                });
            }
            return response;
        };
    };
}