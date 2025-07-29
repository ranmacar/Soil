import { Router } from 'itty-router';
import { Storage } from '../utils/storage';
import { CardanoService } from '../utils/cardano';

const router = Router();

// POST /admin/associate - Associate idea with product
router.post('/associate', async (request, env) => {
    try {
        const body = await request.json();
        const { ideaId, productId } = body;

        if (!ideaId || !productId) {
            return new Response(JSON.stringify({ error: 'Idea ID and Product ID are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const storage = new Storage(env);

        // Check if idea exists
        const ideas = await storage.getJson('ideas.json') || [];
        const idea = ideas.find(i => i.id === ideaId);
        if (!idea) {
            return new Response(JSON.stringify({ error: 'Idea not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Check if product exists
        const products = await storage.getJson('products.json') || [];
        const product = products.find(p => p.id === productId);
        if (!product) {
            return new Response(JSON.stringify({ error: 'Product not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Check if already associated
        if (product.associatedIdeas.includes(ideaId)) {
            return new Response(JSON.stringify({ error: 'Idea already associated with this product' }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Add association
        product.associatedIdeas.push(ideaId);
        product.updatedAt = new Date().toISOString();

        await storage.putJson('products.json', products);

        // Store association record
        const associations = await storage.getJson('associations.json') || [];
        associations.push({
            id: `assoc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            ideaId,
            productId,
            createdAt: new Date().toISOString(),
        });
        await storage.putJson('associations.json', associations);

        return new Response(JSON.stringify({
            message: 'Idea associated with product successfully',
            product,
            idea
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// POST /admin/mint-nft - Mint identity NFT for user
router.post('/mint-nft', async (request, env) => {
    try {
        const body = await request.json();
        const { userAddress } = body;

        if (!userAddress) {
            return new Response(JSON.stringify({ error: 'User address is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const cardano = new CardanoService(env);
        if (!cardano.isValidAddress(userAddress)) {
            return new Response(JSON.stringify({ error: 'Invalid Cardano address' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Check if user already has NFT
        const hasNFT = await cardano.hasAsset(userAddress, env.NFT_POLICY_ID);
        if (hasNFT) {
            return new Response(JSON.stringify({ error: 'User already has identity NFT' }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Create NFT minting transaction
        const nftTx = {
            id: `nft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type: 'mint_nft',
            userAddress,
            status: 'pending',
            txHash: null,
            createdAt: new Date().toISOString(),
        };

        // Store transaction record
        const storage = new Storage(env);
        const transactions = await storage.getJson('transactions.json') || [];
        transactions.push(nftTx);
        await storage.putJson('transactions.json', transactions);

        return new Response(JSON.stringify({
            transaction: nftTx,
            message: 'Identity NFT minting initiated'
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// GET /admin/associations - List all associations
router.get('/associations', async (request, env) => {
    const storage = new Storage(env);
    const associations = await storage.getJson('associations.json') || [];

    return new Response(JSON.stringify(associations), {
        headers: { 'Content-Type': 'application/json' },
    });
});

// GET /admin/stats - Get platform statistics
router.get('/stats', async (request, env) => {
    const storage = new Storage(env);

    const [
        users,
        ideas,
        products,
        transactions,
        associations
    ] = await Promise.all([
        storage.getJson('users.json') || [],
        storage.getJson('ideas.json') || [],
        storage.getJson('products.json') || [],
        storage.getJson('transactions.json') || [],
        storage.getJson('associations.json') || []
    ]);

    const cardano = new CardanoService(env);

    // Count verified users (those with NFTs)
    let verifiedUsers = 0;
    for (const user of users) {
        const hasNFT = await cardano.hasAsset(user.address, env.NFT_POLICY_ID);
        if (hasNFT) verifiedUsers++;
    }

    const stats = {
        totalUsers: users.length,
        verifiedUsers,
        totalIdeas: ideas.length,
        totalProducts: products.length,
        totalTransactions: transactions.length,
        totalAssociations: associations.length,
        transactionTypes: transactions.reduce((acc, tx) => {
            acc[tx.type] = (acc[tx.type] || 0) + 1;
            return acc;
        }, {}),
    };

    return new Response(JSON.stringify(stats), {
        headers: { 'Content-Type': 'application/json' },
    });
});

export const adminRouter = router;