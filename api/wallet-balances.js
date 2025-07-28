const express = require("express")
const axios = require("axios")
const cors = require("cors") // Import cors middleware

const app = express()

// Configure CORS to allow requests from your Next.js frontend domain
// IMPORTANT: This has been updated to your frontend domain.
const corsOptions = {
  origin: "https://www.normiescoin.com", // <--- UPDATED THIS TO YOUR FRONTEND DOMAIN!
  optionsSuccessStatus: 200, // For legacy browser support
}
app.use(cors(corsOptions)) // Use CORS middleware

const WALLETS = ["akgSyoqae5tWyiuAxZJv5VKzthtHruUkQxgSuPmhWRa", "Fqi2c66QRr4wLghXNnhNg4Dr9u4LV4Djy3aL9jcsM5fi"]

// This function will fetch the SOL balance and token balances for a given wallet
async function fetchWalletBalance(walletAddress, solscanApiKey) {
  try {
    const response = await axios.get(`https://public-api.solscan.io/account/${walletAddress}`, {
      headers: {
        Authorization: `Bearer ${solscanApiKey}`,
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
      },
      timeout: 10000, // 10 seconds timeout
    })
    const data = response.data
    let walletTotal = 0

    // Add SOL balance
    // Solscan API returns solBalance as a string, convert to float
    walletTotal += Number.parseFloat(data.solBalance) || 0

    // Add token balances
    if (data.tokens) {
      for (const token of data.tokens) {
        // Ensure tokenPriceUsd exists and is a valid number
        if (token.tokenPriceUsd && !isNaN(Number.parseFloat(token.tokenPriceUsd))) {
          const amount =
            Number.parseFloat(token.tokenAmount?.amount || "0") /
            Math.pow(10, Number.parseFloat(token.tokenAmount?.decimals || "0"))
          walletTotal += amount * Number.parseFloat(token.tokenPriceUsd)
        }
      }
    }
    return walletTotal
  } catch (error) {
    console.error(`Error fetching balance for ${walletAddress}:`, error.message)
    // Log full error response if available for debugging Cloudflare issues
    if (error.response) {
      console.error("Error response data:", error.response.data)
      console.error("Error response status:", error.response.status)
      console.error("Error response headers:", error.response.headers)
    }
    return 0 // Return 0 if there's an error fetching a specific wallet
  }
}

// Define the API route
app.get("/api/wallet-balances", async (req, res) => {
  const solscanApiKey = process.env.SOLSCAN_API_KEY

  if (!solscanApiKey) {
    console.error("SOLSCAN_API_KEY is not set in backend environment variables.")
    return res.status(500).json({ error: "Backend API key not configured." })
  }

  try {
    let totalUsdValue = 0
    for (const wallet of WALLETS) {
      const balance = await fetchWalletBalance(wallet, solscanApiKey)
      totalUsdValue += balance
    }

    res.json({
      total: totalUsdValue,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in /api/wallet-balances endpoint:", error)
    res.status(500).json({ error: "Failed to fetch balances" })
  }
})

// Export the app for Vercel Serverless Functions
module.exports = app
