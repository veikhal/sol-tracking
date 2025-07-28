const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

// Configure CORS to allow requests from your frontend domain
const corsOptions = {
  origin: ["https://www.normiescoin.com", "http://localhost:3000"],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Wallet addresses
const WALLETS = [
  "akgSyoqae5tWyiuAxZJv5VKzthtHruUkQxgSuPmhWRa",
  "Fqi2c66QRr4wLghXNnhNg4Dr9u4LV4Djy3aL9jcsM5fi",
];

// Fetch token price in USD
async function fetchTokenPrice(tokenAddress, solscanApiKey) {
  try {
    const response = await axios.get(`https://pro-api.solscan.io/v2.0/market/token?address=${tokenAddress}`, {
      headers: {
        "Api-Key": solscanApiKey,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      timeout: 10000,
    });
    const price = Number.parseFloat(response.data.data?.priceUsdt);
    if (isNaN(price)) {
      console.error(`Invalid price for ${tokenAddress}:`, response.data.data);
      return null;
    }
    return price;
  } catch (error) {
    console.error(`Error fetching price for ${tokenAddress}:`, error.message);
    if (error.response) {
      console.error("Status:", error.response.status, "Data:", error.response.data);
    }
    return null;
  }
}

// Fetch wallet balance and convert to USD
async function fetchWalletBalance(walletAddress, solscanApiKey) {
  try {
    const response = await axios.get(`https://pro-api.solscan.io/v2.0/account/tokens?account=${walletAddress}`, {
      headers: {
        "Api-Key": solscanApiKey,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      timeout: 10000,
    });
    const data = response.data.data || [];
    console.log(`Response for ${walletAddress}:`, JSON.stringify(data, null, 2)); // Debug log
    let walletTotal = 0;

    // Fetch SOL price
    const solPrice = await fetchTokenPrice("So11111111111111111111111111111111111111112", solscanApiKey);

    for (const token of data) {
      const amount = Number.parseFloat(token.amount) / Math.pow(10, token.tokenDecimals || 0);
      if (isNaN(amount)) {
        console.error(`Invalid amount for ${token.tokenAddress} in ${walletAddress}:`, token);
        continue;
      }
      if (token.tokenAddress === "So11111111111111111111111111111111111111112") {
        if (solPrice) {
          walletTotal += amount * solPrice;
        } else {
          console.error(`No SOL price for ${walletAddress}`);
        }
      } else {
        const price = await fetchTokenPrice(token.tokenAddress, solscanApiKey);
        if (price) {
          walletTotal += amount * price;
        } else {
          console.error(`No price for ${token.tokenAddress} in ${walletAddress}`);
        }
      }
    }

    return walletTotal;
  } catch (error) {
    console.error(`Error fetching balance for ${walletAddress}:`, error.message);
    if (error.response) {
      console.error("Status:", error.response.status, "Data:", error.response.data);
    }
    return 0;
  }
}

// API route to return total USD value
app.get("/api/wallet-balances", async (req, res) => {
  const solscanApiKey = process.env.SOLSCAN_API_KEY;

  if (!solscanApiKey) {
    console.error("SOLSCAN_API_KEY is not set in environment variables.");
    return res.status(500).json({ total: 0 });
  }

  try {
    let totalUsdValue = 0;
    for (const wallet of WALLETS) {
      const balance = await fetchWalletBalance(wallet, solscanApiKey);
      totalUsdValue += balance;
    }

    res.json({ total: Number(totalUsdValue.toFixed(2)) });
  } catch (error) {
    console.error("Error in /api/wallet-balances endpoint:", error.message);
    res.status(500).json({ total: 0 });
  }
});

// Export for Vercel
module.exports = app;
