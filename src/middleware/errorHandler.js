export function errorHandler() {
    return async (request) => {
        try {
            // Let the request proceed
            const response = await request.next();
            return response;
        } catch (error) {
            console.error('API Error:', error);

            const isDev = request.env?.ENVIRONMENT === 'development';

            return new Response(
                JSON.stringify({
                    error: 'Internal server error',
                    message: isDev ? error.message : 'Something went wrong',
                    stack: isDev ? error.stack : undefined,
                }),
                {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
    };
}