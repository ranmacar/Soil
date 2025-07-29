// Simple router implementation since we can't use external dependencies
class Router {
    constructor() {
        this.routes = [];
    }

    get(path, handler) {
        this.routes.push({ method: 'GET', path, handler });
        return this;
    }

    post(path, handler) {
        this.routes.push({ method: 'POST', path, handler });
        return this;
    }

    put(path, handler) {
        this.routes.push({ method: 'PUT', path, handler });
        return this;
    }

    delete(path, handler) {
        this.routes.push({ method: 'DELETE', path, handler });
        return this;
    }

    all(path, handler) {
        this.routes.push({ method: '*', path, handler });
        return this;
    }

    async handle(request, env) {
        const url = new URL(request.url);
        const method = request.method;
        const pathname = url.pathname;

        // Handle CORS preflight
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }

        // Rate limiting
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateLimitKey = `rate_limit:${clientIP}`;
        const current = await env.SOIL_CACHE.get(rateLimitKey);
        const count = current ? parseInt(current) : 0;

        if (count >= 100) {
            return new Response(JSON.stringify({ error: 'Too many requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        await env.SOIL_CACHE.put(rateLimitKey, (count + 1).toString(), {
            expirationTtl: 60,
        });

        // Route matching
        for (const route of this.routes) {
            const match = this.matchRoute(route.path, pathname);
            if (match && (route.method === '*' || route.method === method)) {
                try {
                    const response = await route.handler(request, env, match.params);
                    if (response) {
                        // Add CORS headers
                        response.headers.set('Access-Control-Allow-Origin', '*');
                        return response;
                    }
                } catch (error) {
                    console.error('Route handler error:', error);
                    return new Response(JSON.stringify({
                        error: 'Internal server error',
                        message: env.ENVIRONMENT === 'development' ? error.message : undefined
                    }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
            }
        }

        return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    matchRoute(routePath, pathname) {
        if (routePath === '*') return { params: {} };
        if (routePath === pathname) return { params: {} };

        const routeParts = routePath.split('/');
        const pathParts = pathname.split('/');

        if (routeParts.length !== pathParts.length) return null;

        const params = {};
        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                params[routeParts[i].substring(1)] = pathParts[i];
            } else if (routeParts[i] !== pathParts[i]) {
                return null;
            }
        }

        return { params };
    }
}

// Import route handlers
import { handleIdeas } from './src/handlers/ideas';
import { handleProducts } from './src/handlers/products';
import { handleAuth } from './src/handlers/auth';
import { handleTransactions } from './src/handlers/transactions';
import { handleAdmin } from './src/handlers/admin';
import { handleUsers } from './src/handlers/users';

// Create router
const router = new Router();

// Health check
router.get('/', () => new Response('SOIL Platform API - Cloudflare Workers', { status: 200 }));

// Ideas routes
router.get('/ideas', handleIdeas.getAll);
router.get('/ideas/:id', handleIdeas.getById);
router.post('/ideas', handleIdeas.create);
router.put('/ideas/:id', handleIdeas.update);
router.delete('/ideas/:id', handleIdeas.delete);

// Products routes
router.get('/products', handleProducts.getAll);
router.get('/products/:id', handleProducts.getById);
router.post('/products', handleProducts.create);
router.put('/products/:id', handleProducts.update);
router.delete('/products/:id', handleProducts.delete);

// Auth routes
router.post('/auth/register', handleAuth.register);
router.post('/auth/login', handleAuth.login);
router.get('/auth/verify', handleAuth.verify);
router.post('/auth/logout', handleAuth.logout);

// Transactions routes
router.post('/transactions/mint-bit', handleTransactions.mintBit);
router.post('/transactions/transfer-anonymous', handleTransactions.transferAnonymous);
router.post('/transactions/burn-for-asset', handleTransactions.burnForAsset);
router.get('/transactions/:id', handleTransactions.getById);
router.get('/transactions', handleTransactions.getAll);

// Admin routes
router.post('/admin/associate', handleAdmin.associate);
router.post('/admin/mint-nft', handleAdmin.mintNFT);
router.get('/admin/associations', handleAdmin.getAssociations);
router.get('/admin/stats', handleAdmin.getStats);

// Users routes
router.get('/users', handleUsers.getAll);
router.get('/users/verified', handleUsers.getVerified);
router.get('/users/:address', handleUsers.getByAddress);
router.get('/users/:address/ideas', handleUsers.getUserIdeas);
router.get('/users/:address/products', handleUsers.getUserProducts);
router.get('/users/:address/transactions', handleUsers.getUserTransactions);

// 404 handler
router.all('*', () => new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
}));

export default {
    async fetch(request, env, ctx) {
        return router.handle(request, env);
    }
};