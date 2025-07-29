import { Storage } from '../utils/storage';
import { CardanoService } from '../utils/cardano';

export const handleAuth = {
    async register(request, env) {
        try {
            const body = await request.json();
            const { address, name } = body;

            if (!address || !name) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const cardano = new CardanoService(env);
            if (!cardano.isValidAddress(address)) {
                return new Response(JSON.stringify({ error: 'Invalid Cardano address' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const storage = new Storage(env);
            const users = await storage.getJson('users.json') || [];

            const existingUser = users.find(u => u.address === address);
            if (existingUser) {
                return new Response(JSON.stringify({ error: 'User already exists' }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const newUser = {
                id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                address,
                name,
                isVerified: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            users.push(newUser);
            await storage.putJson('users.json', users);

            const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            await env.SOIL_SECRETS.put(`auth:${token}`, JSON.stringify(newUser), {
                expirationTtl: 24 * 60 * 60,
            });

            return new Response(JSON.stringify({
                user: newUser,
                token,
                message: 'User registered successfully'
            }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: 'Invalid request body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },

    async login(request, env) {
        try {
            const body = await request.json();
            const { address } = body;

            if (!address) {
                return new Response(JSON.stringify({ error: 'Address is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const storage = new Storage(env);
            const users = await storage.getJson('users.json') || [];

            const user = users.find(u => u.address === address);
            if (!user) {
                return new Response(JSON.stringify({ error: 'User not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            await env.SOIL_SECRETS.put(`auth:${token}`, JSON.stringify(user), {
                expirationTtl: 24 * 60 * 60,
            });

            return new Response(JSON.stringify({
                user,
                token,
                message: 'Login successful'
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: 'Invalid request body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },

    async verify(request, env) {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const token = authHeader.substring(7);

        try {
            const userData = await env.SOIL_SECRETS.get(`auth:${token}`);

            if (!userData) {
                return new Response(JSON.stringify({ error: 'Invalid token' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const user = JSON.parse(userData);
            const cardano = new CardanoService(env);
            const hasNFT = await cardano.hasAsset(user.address, env.NFT_POLICY_ID);

            return new Response(JSON.stringify({
                user: { ...user, isVerified: hasNFT },
                verified: hasNFT
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: 'Token verification failed' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },

    async logout(request, env) {
        const authHeader = request.headers.get('Authorization');

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            await env.SOIL_SECRETS.delete(`auth:${token}`);
        }

        return new Response(JSON.stringify({ message: 'Logged out successfully' }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
};