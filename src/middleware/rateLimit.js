export function rateLimit(options = {}) {
    const {
        windowMs = 60 * 1000, // 1 minute
        max = 100, // requests per window
        message = 'Too many requests',
        standardHeaders = true,
        legacyHeaders = false,
    } = options;

    return async (request, env) => {
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const key = `rate_limit:${clientIP}`;

        try {
            // Get current count from KV
            const current = await env.SOIL_CACHE.get(key);
            const count = current ? parseInt(current) : 0;

            if (count >= max) {
                return new Response(JSON.stringify({ error: message }), {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        ...(standardHeaders && {
                            'X-RateLimit-Limit': max.toString(),
                            'X-RateLimit-Remaining': '0',
                            'X-RateLimit-Reset': (Date.now() + windowMs).toString(),
                        }),
                    },
                });
            }

            // Increment counter
            await env.SOIL_CACHE.put(key, (count + 1).toString(), {
                expirationTtl: Math.ceil(windowMs / 1000),
            });

            // Add rate limit headers to response
            return (response) => {
                if (response && standardHeaders) {
                    response.headers.set('X-RateLimit-Limit', max.toString());
                    response.headers.set('X-RateLimit-Remaining', (max - count - 1).toString());
                    response.headers.set('X-RateLimit-Reset', (Date.now() + windowMs).toString());
                }
                return response;
            };
        } catch (error) {
            console.error('Rate limit error:', error);
            // Allow request to proceed if rate limiting fails
            return null;
        }
    };
}