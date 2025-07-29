import { Storage } from '../utils/storage';

export const handleProducts = {
    async getAll(request, env) {
        const storage = new Storage(env);
        const products = await storage.getJson('products.json') || [];

        return new Response(JSON.stringify(products), {
            headers: { 'Content-Type': 'application/json' },
        });
    },

    async getById(request, env, params) {
        const { id } = params;
        const storage = new Storage(env);
        const products = await storage.getJson('products.json') || [];

        const product = products.find(p => p.id === id);
        if (!product) {
            return new Response(JSON.stringify({ error: 'Product not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify(product), {
            headers: { 'Content-Type': 'application/json' },
        });
    },

    async create(request, env) {
        try {
            const body = await request.json();
            const { name, description, price, creator } = body;

            if (!name || !description || !creator) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const storage = new Storage(env);
            const products = await storage.getJson('products.json') || [];

            const newProduct = {
                id: `product_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                name,
                description,
                price: price || 0,
                creator,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                associatedIdeas: [],
            };

            products.push(newProduct);
            await storage.putJson('products.json', products);

            return new Response(JSON.stringify(newProduct), {
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

    async update(request, env, params) {
        try {
            const { id } = params;
            const body = await request.json();
            const { name, description, price } = body;

            const storage = new Storage(env);
            const products = await storage.getJson('products.json') || [];

            const productIndex = products.findIndex(p => p.id === id);
            if (productIndex === -1) {
                return new Response(JSON.stringify({ error: 'Product not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            products[productIndex] = {
                ...products[productIndex],
                name: name || products[productIndex].name,
                description: description || products[productIndex].description,
                price: price !== undefined ? price : products[productIndex].price,
                updatedAt: new Date().toISOString(),
            };

            await storage.putJson('products.json', products);

            return new Response(JSON.stringify(products[productIndex]), {
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: 'Invalid request body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },

    async delete(request, env, params) {
        const { id } = params;
        const storage = new Storage(env);
        const products = await storage.getJson('products.json') || [];

        const productIndex = products.findIndex(p => p.id === id);
        if (productIndex === -1) {
            return new Response(JSON.stringify({ error: 'Product not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        products.splice(productIndex, 1);
        await storage.putJson('products.json', products);

        return new Response(JSON.stringify({ message: 'Product deleted' }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
};