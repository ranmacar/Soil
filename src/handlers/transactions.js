import { Storage } from '../utils/storage';
import { CardanoService } from '../utils/cardano';

export const handleTransactions = {
    async mintBit(request, env) {
        try {
            const body = await request.json();
            const { userAddress, amount = 1 } = body;

            if (!userAddress) {
                return new Response(JSON.stringify({ error: 'User address is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const cardano = new CardanoService(env);

            // Check if user is verified (has identity NFT)
            const hasNFT = await cardano.hasAsset(userAddress, env.NFT_POLICY_ID);
            if (!hasNFT) {
                return new Response(JSON.stringify({ error: 'User must be verified to mint bit tokens' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const currentBalance = await cardano.getAssetBalance(userAddress, env.BIT_TOKEN_POLICY_ID);

            const mintTx = {
                id: `mint_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                type: 'mint_bit',
                userAddress,
                amount,
                status: 'pending',
                txHash: null,
                createdAt: new Date().toISOString(),
            };

            const storage = new Storage(env);
            const transactions = await storage.getJson('transactions.json') || [];
            transactions.push(mintTx);
            await storage.putJson('transactions.json', transactions);

            return new Response(JSON.stringify({
                transaction: mintTx,
                message: 'Bit token minting initiated',
                newBalance: currentBalance + amount
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
    },

    async transferAnonymous(request, env) {
        try {
            const body = await request.json();
            const { amount, receiver } = body;

            if (!amount || !receiver) {
                return new Response(JSON.stringify({ error: 'Amount and receiver address are required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            if (amount <= 0 || amount > 10) {
                return new Response(JSON.stringify({ error: 'Amount must be between 1 and 10' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const cardano = new CardanoService(env);

            if (!cardano.isValidAddress(receiver)) {
                return new Response(JSON.stringify({ error: 'Invalid receiver address' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const transferTx = {
                id: `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                type: 'anonymous_transfer',
                amount,
                receiver,
                intermediaryAddress: env.INTERMEDIARY_WALLET_ADDRESS,
                status: 'pending',
                txHash: null,
                createdAt: new Date().toISOString(),
            };

            const storage = new Storage(env);
            const transactions = await storage.getJson('transactions.json') || [];
            transactions.push(transferTx);
            await storage.putJson('transactions.json', transactions);

            return new Response(JSON.stringify({
                transaction: transferTx,
                message: 'Anonymous transfer initiated'
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
    },

    async burnForAsset(request, env) {
        try {
            const body = await request.json();
            const { userAddress, ideaId, amount } = body;

            if (!userAddress || !ideaId || !amount) {
                return new Response(JSON.stringify({ error: 'User address, idea ID, and amount are required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const cardano = new CardanoService(env);
            const bitBalance = await cardano.getAssetBalance(userAddress, env.BIT_TOKEN_POLICY_ID);

            if (bitBalance < amount) {
                return new Response(JSON.stringify({ error: 'Insufficient bit tokens' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const storage = new Storage(env);
            const ideas = await storage.getJson('ideas.json') || [];
            const idea = ideas.find(i => i.id === ideaId);

            if (!idea) {
                return new Response(JSON.stringify({ error: 'Idea not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const burnTx = {
                id: `burn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                type: 'burn_for_asset',
                userAddress,
                ideaId,
                amount,
                assetShares: amount,
                status: 'pending',
                txHash: null,
                createdAt: new Date().toISOString(),
            };

            const transactions = await storage.getJson('transactions.json') || [];
            transactions.push(burnTx);
            await storage.putJson('transactions.json', transactions);

            return new Response(JSON.stringify({
                transaction: burnTx,
                message: 'Asset shares minting initiated',
                newBitBalance: bitBalance - amount,
                newAssetShares: amount
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
    },

    async getById(request, env, params) {
        const { id } = params;
        const storage = new Storage(env);
        const transactions = await storage.getJson('transactions.json') || [];

        const transaction = transactions.find(t => t.id === id);
        if (!transaction) {
            return new Response(JSON.stringify({ error: 'Transaction not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify(transaction), {
            headers: { 'Content-Type': 'application/json' },
        });
    },

    async getAll(request, env) {
        const url = new URL(request.url);
        const type = url.searchParams.get('type');
        const userAddress = url.searchParams.get('userAddress');
        const status = url.searchParams.get('status');

        const storage = new Storage(env);
        let transactions = await storage.getJson('transactions.json') || [];

        if (type) {
            transactions = transactions.filter(t => t.type === type);
        }
        if (userAddress) {
            transactions = transactions.filter(t => t.userAddress === userAddress);
        }
        if (status) {
            transactions = transactions.filter(t => t.status === status);
        }

        transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return new Response(JSON.stringify(transactions), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
};