import { Storage } from '../utils/storage';
import { CardanoService } from '../utils/cardano';

export const handleUsers = {
    async getAll(request, env) {
        const storage = new Storage(env);
        const users = await storage.getJson('users.json') || [];

        const safeUsers = users.map(user => ({
            id: user.id,
            address: user.address,
            name: user.name,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
        }));

        return new Response(JSON.stringify(safeUsers), {
            headers: { 'Content-Type': 'application/json' },
        });
    },

    async getVerified(request, env) {
        const storage = new Storage(env);
        const users = await storage.getJson('users.json') || [];
        const cardano = new CardanoService(env);

        const verifiedUsers = [];
        for (const user of users) {
            const hasNFT = await cardano.hasAsset(user.address, env.NFT_POLICY_ID);
            if (hasNFT) {
                verifiedUsers.push({
                    id: user.id,
                    address: user.address,
                    name: user.name,
                    isVerified: true,
                    createdAt: user.createdAt,
                });
            }
        }

        return new Response(JSON.stringify(verifiedUsers), {
            headers: { 'Content-Type': 'application/json' },
        });
    },

    async getByAddress(request, env, params) {
        const { address } = params;
        const storage = new Storage(env);
        const users = await storage.getJson('users.json') || [];

        const user = users.find(u => u.address === address);
        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const cardano = new CardanoService(env);
        const hasNFT = await cardano.hasAsset(user.address, env.NFT_POLICY_ID);

        const userWithBalance = {
            id: user.id,
            address: user.address,
            name: user.name,
            isVerified: hasNFT,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            balances: {
                nfts: hasNFT ? 1 : 0,
                bits: await cardano.getAssetBalance(user.address, env.BIT_TOKEN_POLICY_ID),
                assets: await cardano.getAssetBalance(user.address, env.ASSET_POLICY_ID),
            }
        };

        return new Response(JSON.stringify(userWithBalance), {
            headers: { 'Content-Type': 'application/json' },
        });
    },

    async getUserIdeas(request, env, params) {
        const { address } = params;
        const storage = new Storage(env);
        const ideas = await storage.getJson('ideas.json') || [];

        const userIdeas = ideas.filter(idea => idea.submitter === address);

        return new Response(JSON.stringify(userIdeas), {
            headers: { 'Content-Type': 'application/json' },
        });
    },

    async getUserProducts(request, env, params) {
        const { address } = params;
        const storage = new Storage(env);
        const products = await storage.getJson('products.json') || [];

        const userProducts = products.filter(product => product.creator === address);

        return new Response(JSON.stringify(userProducts), {
            headers: { 'Content-Type': 'application/json' },
        });
    },

    async getUserTransactions(request, env, params) {
        const { address } = params;
        const storage = new Storage(env);
        const transactions = await storage.getJson('transactions.json') || [];

        const userTransactions = transactions.filter(tx =>
            tx.userAddress === address ||
            tx.receiver === address ||
            tx.intermediaryAddress === address
        );

        return new Response(JSON.stringify(userTransactions), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
};