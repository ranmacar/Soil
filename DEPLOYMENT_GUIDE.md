# SOIL Platform - Cloudflare Workers Deployment Guide

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Node.js**: Version 16 or higher
3. **Wrangler CLI**: Install with `npm install -g wrangler`

## Environment Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file (or use Cloudflare dashboard):
```bash
# Required for Cardano integration
BLOCKFROST_API_KEY=your_blockfrost_preprod_api_key

# Admin wallet address (for admin functions)
ADMIN_WALLET_ADDRESS=addr_test1...

# Intermediary wallet for anonymous transfers
INTERMEDIARY_WALLET_ADDRESS=addr_test1...

# Policy IDs (replace with your actual policy IDs)
NFT_POLICY_ID=your_nft_policy_id
BIT_TOKEN_POLICY_ID=your_bit_token_policy_id
ASSET_POLICY_ID=your_asset_policy_id
```

### 3. Set up Cloudflare Resources

#### Create R2 Buckets
```bash
wrangler r2 bucket create soil-platform-data
wrangler r2 bucket create soil-platform-metadata
```

#### Create KV Namespaces
```bash
wrangler kv:namespace create SOIL_SECRETS
wrangler kv:namespace create SOIL_CACHE
```

#### Update wrangler.toml
Update the IDs in `wrangler.toml` with your actual IDs from the commands above.

## Deployment Steps

### 1. Development
```bash
wrangler dev
```

### 2. Staging
```bash
wrangler deploy --env staging
```

### 3. Production
```bash
wrangler deploy --env production
```

## API Testing

### Test Endpoints
```bash
# Test health check
curl https://your-worker-domain.workers.dev/

# Test ideas endpoint
curl https://your-worker-domain.workers.dev/ideas

# Test creating an idea
curl -X POST https://your-worker-domain.workers.dev/ideas \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Idea","description":"Test description","submitter":"addr_test1..."}'
```

## Frontend Integration

Update the frontend `API_URL` in `deploy/index.html`:
```javascript
API_URL: 'https://your-worker-domain.workers.dev'
```

## Security Notes

1. **Rate Limiting**: 100 requests per minute per IP
2. **Input Validation**: All endpoints validate input
3. **CORS**: Configured for all origins (adjust as needed)
4. **Authentication**: Simple token-based auth (upgrade to JWT for production)

## Monitoring

### Logs
```bash
wrangler tail
```

### Metrics
- Check Cloudflare dashboard for usage metrics
- Monitor R2 storage usage
- Track KV namespace usage

## Troubleshooting

### Common Issues
1. **CORS errors**: Ensure CORS headers are properly set
2. **Rate limiting**: Check KV namespace configuration
3. **Storage issues**: Verify R2 bucket permissions
4. **Cardano integration**: Ensure Blockfrost API key is valid

### Debug Mode
Set `ENVIRONMENT=development` in wrangler.toml for detailed error messages.