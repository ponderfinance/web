# Zora Starter App

A minimal implementation showcasing Zora's SDK. This project demonstrates how to build a simple Zora client using Zora's SDKs, focusing on essential features for NFT minting, collecting, buying and selling.

## Features

### Creator Client

- Create ERC1155 tokens (Timed editions)
- IPFS file uploading for NFT media
- Metadata form for token details

### Collector Client

- Mint tokens
- Buy tokens on secondary market
- Sell tokens on secondary market

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/your-username/zora-starter-app.git
```

2. Install dependencies:

```bash
npm install
# or
yarn
# or
pnpm install
```

3. Set up environment variables:

```env
# Create a .env.local file with:
NEXT_PUBLIC_PRIVY_APP_ID=your_project_id
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
```

4. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

### Creating NFTs

1. Connect your wallet using the Login button in the header
2. Navigate to the Create page
3. Upload supported media (JPEG, PNG, GIF, WEBP)
4. Fill in token details (title, description)
5. Click "Create" to mint your NFT
6. View transaction status and access block explorer links

### Collecting NFTs

1. Connect your wallet
2. Navigate to the Collect page
3. View available NFTs for primary sale or secondary market
4. Click "Mint" to collect from primary sale
5. Click "Buy" to purchase from secondary market
6. Click "Sell" to list your NFTs on the secondary market

## Contributing

This is a starter template for building with Zora's SDKs. Feel free to fork and modify for your own projects. If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

## Learn More

- [Zora Documentation](https://docs.zora.co/)
- [Next.js Documentation](https://nextjs.org/docs)
- [WalletConnect Documentation](https://docs.walletconnect.com/)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
