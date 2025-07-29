export async function auth(request, env) {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const token = authHeader.substring(7);

    try {
        // Verify token (simple implementation - in production use JWT)
        const userData = await env.SOIL_SECRETS.get(`auth:${token}`);

        if (!userData) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Add user to request context
        request.user = JSON.parse(userData);
        return null; // Continue to next handler
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function adminAuth(request, env) {
    const result = await auth(request, env);
    if (result) return result;

    if (!request.user.isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return null;
}