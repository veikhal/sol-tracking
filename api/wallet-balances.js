// api/wallet-balances.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

// --- CORS Configuration ---
// This robustly checks if the request is coming from your frontend domains.
const allowedOrigins = [
  'https://normiescoin.com',
  'https://www.normiescoin.com',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('This request was blocked by CORS.'));
    }
  },
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// --- Wallet & Token Configuration ---
const WALLETS = [
  "akgSyoqae5tWyiuAxZJv5VKzthtHruUkQxgSuPmhWRa", 
  "Fqi2c66QRr4wLghXNnhNg4Dr9u4LV4Djy3aL9jcsM5fi"
];

// --- Data Fetching Functions (No changes needed in these) ---

// Get URANUS token balance from first wallet
async function fetchUranusTokenBalance(walletAddress) {
  const URANUS_TOKEN_MINT = "BFgdzMkTPdKKJeTipv2njtDEwhKxkgFueJQfJGt1jups"
  
  try {
    const response = await axios.post('https://api.mainnet-beta.solana.com', {
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        walletAddress,
        { mint: URANUS_TOKEN_MINT },
        { encoding: 'jsonParsed' }
      ]
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    if (response.data.error || !response.data.result.value || response.data.result.value.length === 0) {
      console.log(`No URANUS token account found for ${walletAddress}`);
      return 0;
    }

    const tokenAmount = parseFloat(response.data.result.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0);
    if (tokenAmount === 0) return 0;

    try {
      const priceResponse = await axios.get(`https://price.jup.ag/v4/price?ids=${URANUS_TOKEN_MINT}`);
      const uranusPrice = priceResponse.data.data[URANUS_TOKEN_MINT]?.price || 0;
      console.log(`URANUS balance: ${tokenAmount}, Price: $${uranusPrice}`);
      return tokenAmount * uranusPrice;
    } catch (priceError) {
      console.log('Could not fetch URANUS price from Jupiter, trying DexScreener...');
      const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${URANUS_TOKEN_MINT}`);
      const uranusPrice = parseFloat(dexResponse.data.pairs?.[0]?.priceUsd || 0);
      console.log(`URANUS balance: ${tokenAmount}, Price: $${uranusPrice} (from DexScreener)`);
      return tokenAmount * uranusPrice;
    }
  } catch (error) {
    console.error(`Error fetching URANUS token balance for ${walletAddress}:`, error.message);
    return 0;
  }
}

// SOL balance function using RPC
async function fetchSolBalanceRPC(walletAddress) {
  try {
    const response = await axios.post('https://api.mainnet-beta.solana.com', {
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [walletAddress]
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }
    
    const solBalance = response.data.result.value / 1000000000;
    const priceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const solPrice = priceResponse.data.solana.usd;

    return solBalance * solPrice;
  } catch (error) {
    console.error(`Error fetching SOL balance for ${walletAddress}:`, error.message);
    return 0;
  }
}

// --- API Endpoint ---
app.get("/api/wallet-balances", async (req, res) => {
  console.log("Fetching fresh wallet balances...");
  
  try {
    // We run all fetches at the same time to be faster and avoid Vercel timeouts.
    const [
      firstWalletSol,
      uranusValue,
      secondWalletSol
    ] = await Promise.all([
      fetchSolBalanceRPC(WALLETS[0]),
      fetchUranusTokenBalance(WALLETS[0]),
      fetchSolBalanceRPC(WALLETS[1])
    ]);
    
    const totalUsdValue = firstWalletSol + uranusValue + secondWalletSol;

    console.log(`Grand total: $${totalUsdValue.toFixed(2)}`);

    const responseData = {
      total: Math.round(totalUsdValue * 100) / 100
    };

    // This is the most important part for performance.
    // It tells Vercel to cache the successful response for 60 minutes.
    // Subsequent requests will be instant and won't time out.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=59');
    
    res.json(responseData);

  } catch (error) {
    console.error("Error in /api/wallet-balances endpoint:", error);
    // Tell Vercel and browsers not to cache error responses.
    res.setHeader('Cache-Control', 'no-cache');
    res.status(500).json({ 
      error: "Failed to fetch balances",
      message: error.message 
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
