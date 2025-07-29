export class CardanoService {
    constructor(env) {
        this.env = env;
        this.network = 'preprod'; // Default to preprod
        this.blockfrostUrl = `https://cardano-${this.network}.blockfrost.io/api/v0`;
    }

    async get(endpoint) {
        const response = await fetch(`${this.blockfrostUrl}${endpoint}`, {
            headers: {
                'project_id': this.env.BLOCKFROST_API_KEY,
            },
        });

        if (!response.ok) {
            throw new Error(`Blockfrost API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    async post(endpoint, data) {
        const response = await fetch(`${this.blockfrostUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'project_id': this.env.BLOCKFROST_API_KEY,
                'Content-Type': 'application/cbor',
            },
            body: data,
        });

        if (!response.ok) {
            throw new Error(`Blockfrost API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    async getAddressInfo(address) {
        return this.get(`/addresses/${address}`);
    }

    async getAddressUtxos(address) {
        return this.get(`/addresses/${address}/utxos`);
    }

    async getTransactionInfo(txHash) {
        return this.get(`/txs/${txHash}`);
    }

    async submitTransaction(txCbor) {
        return this.post('/tx/submit', txCbor);
    }

    async getProtocolParameters() {
        return this.get('/epochs/latest/parameters');
    }

    async getAssetInfo(assetId) {
        return this.get(`/assets/${assetId}`);
    }

    async getAssetAddresses(assetId) {
        return this.get(`/assets/${assetId}/addresses`);
    }

    // Transaction building utilities
    async buildTransaction(inputs, outputs, metadata = null) {
        const protocolParams = await this.getProtocolParameters();

        // This is a simplified version - in production, use cardano-serialization-lib
        const txBody = {
            inputs,
            outputs,
            fee: 170000, // Default fee
            ttl: Math.floor(Date.now() / 1000) + 3600, // 1 hour TTL
        };

        if (metadata) {
            txBody.metadata = metadata;
        }

        return txBody;
    }

    // Check if address has specific asset
    async hasAsset(address, assetId) {
        try {
            const addressInfo = await this.getAddressInfo(address);
            const amount = addressInfo.amount.find(a => a.unit === assetId);
            return amount ? parseInt(amount.quantity) > 0 : false;
        } catch (error) {
            console.error('Error checking asset:', error);
            return false;
        }
    }

    // Get asset balance for address
    async getAssetBalance(address, assetId) {
        try {
            const addressInfo = await this.getAddressInfo(address);
            const amount = addressInfo.amount.find(a => a.unit === assetId);
            return amount ? parseInt(amount.quantity) : 0;
        } catch (error) {
            console.error('Error getting asset balance:', error);
            return 0;
        }
    }

    // Validate Cardano address
    isValidAddress(address) {
        // Basic validation - starts with addr1 or addr_test1
        return /^addr1[0-9a-z]+$/.test(address) || /^addr_test1[0-9a-z]+$/.test(address);
    }

    // Generate transaction hash
    generateTxHash(txBody) {
        // Simplified - in production use proper hashing
        return 'tx_' + Math.random().toString(36).substring(2, 15);
    }
}