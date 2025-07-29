import { Router } from 'itty-router';
import { Storage } from '../utils/storage';

const router = Router();

// GET /products - List all products
router.get('/', async (request, env) => {
    const storage = new Storage(env);
    const products = await storage.getJson('products.json') || [];

    return new Response(JSON.stringify(products), {
        headers: { 'Content-Type': 'application/json' },
    });
});

// GET /products/:id - Get specific product
router.get('/:id', async (request, env) => {
    const { id } = request.params;
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
});

// POST /products - Create new product
router.post('/', async (request, env) => {
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
});

// PUT /products/:id - Update product (owner only)
router.put('/:id', async (request, env) => {
    try {
        const { id } = request.params;
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

        // In a real implementation, check if user owns this product
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
});

// DELETE /products/:id - Delete product (owner only)
router.delete('/:id', async (request, env) => {
    const { id } = request.params;
    const storage = new Storage(env);
    const products = await storage.getJson('products.json') || [];

    const productIndex = products.findIndex(p => p.id === id);
    if (productIndex === -1) {
        return new Response(JSON.stringify({ error: 'Product not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // In a real implementation, check if user owns this product
    products.splice(productIndex, 1);
    await storage.putJson('products.json', products);

    return new Response(JSON.stringify({ message: 'Product deleted' }), {
        headers: { 'Content-Type': 'application/json' },
    });
});

export const productsRouter = router;