// api/wallet-balances.js
const express = require("express")
const axios = require("axios")
const cors = require("cors")

const app = express()

// Configure CORS to allow requests from your Next.js frontend domain
const corsOptions = {
  origin: "https://normiescoin.com",
  optionsSuccessStatus: 200,
}
app.use(cors(corsOptions))

const WALLETS = ["akgSyoqae5tWyiuAxZJv5VKzthtHruUkQxgSuPmhWRa", "Fqi2c66QRr4wLghXNnhNg4Dr9u4LV4Djy3aL9jcsM5fi"]

async function fetchWalletBalance(walletAddress, solscanApiKey) {
  try {
    // Updated to use the new Pro API endpoint and pass address as a query parameter
    const response = await axios.get(`https://pro-api.solscan.io/v2.0/account/detail?address=${walletAddress}`, {
      headers: {
        Authorization: `Bearer ${solscanApiKey}`,
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
      },
      timeout: 10000,
    })
    const data = response.data
    let walletTotal = 0

    // Assuming the response structure for SOL balance and tokens is similar
    // You might need to adjust these parsing lines if the Pro API returns data in a different format.
    walletTotal += Number.parseFloat(data.solBalance) || 0

    if (data.tokens) {
      for (const token of data.tokens) {
        if (token.tokenPriceUsd) {
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
    if (error.response) {
      console.error("Error response data:", error.response.data)
      console.error("Error response status:", error.response.status)
      console.error("Error response headers:", error.response.headers)
    }
    return 0
  }
}

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
    })
  } catch (error) {
    console.error("Error in /api/wallet-balances endpoint:", error)
    res.status(500).json({ error: "Failed to fetch balances" })
  }
})

module.exports = app
