// api/wallet-balances.js
const express = require("express")
const axios = require("axios")
const cors = require("cors")

const app = express()

// Configure CORS to allow requests from your Next.js frontend domain
const corsOptions = {
  origin: ["https://normiescoin.com", "http://localhost:3000"], // Added localhost for testing
  optionsSuccessStatus: 200,
}
app.use(cors(corsOptions))

const WALLETS = [
  "akgSyoqae5tWyiuAxZJv5VKzthtHruUkQxgSuPmhWRa", 
  "Fqi2c66QRr4wLghXNnhNg4Dr9u4LV4Djy3aL9jcsM5fi"
]

// Alternative function using Solana RPC directly
async function fetchWalletBalanceRPC(walletAddress) {
  try {
    const response = await axios.post('https://api.mainnet-beta.solana.com', {
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [walletAddress]
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    if (response.data.error) {
      throw new Error(response.data.error.message)
    }

    // Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
    const solBalance = response.data.result.value / 1000000000

    // Get SOL price from CoinGecko
    const priceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
    const solPrice = priceResponse.data.solana.usd

    return solBalance * solPrice
  } catch (error) {
    console.error(`Error fetching balance for ${walletAddress}:`, error.message)
    return 0
  }
}

// Fixed Solscan function with correct endpoint
async function fetchWalletBalanceSolscan(walletAddress, solscanApiKey) {
  try {
    // Using the correct Solscan API v1 endpoint
    const response = await axios.get(`https://public-api.solscan.io/account/${walletAddress}`, {
      headers: {
        'token': solscanApiKey, // Solscan uses 'token' header, not 'Authorization'
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    const data = response.data

    if (!data.success) {
      throw new Error('Solscan API returned unsuccessful response')
    }

    let walletTotal = 0

    // Add SOL balance (lamports to SOL conversion)
    if (data.data && data.data.lamports) {
      const solBalance = data.data.lamports / 1000000000
      
      // Get SOL price
      const priceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
      const solPrice = priceResponse.data.solana.usd
      
      walletTotal += solBalance * solPrice
    }

    // Add token balances (if available and you have token price data)
    // This part depends on having token price information
    
    return walletTotal
  } catch (error) {
    console.error(`Solscan API error for ${walletAddress}:`, error.message)
    if (error.response) {
      console.error("Error response data:", error.response.data)
      console.error("Error response status:", error.response.status)
    }
    
    // Fallback to RPC method
    console.log(`Falling back to RPC method for ${walletAddress}`)
    return await fetchWalletBalanceRPC(walletAddress)
  }
}

app.get("/api/wallet-balances", async (req, res) => {
  const solscanApiKey = process.env.SOLSCAN_API_KEY

  console.log("API key present:", !!solscanApiKey)
  console.log("Fetching balances for wallets:", WALLETS)

  try {
    let totalUsdValue = 0
    const walletBalances = []

    for (const wallet of WALLETS) {
      console.log(`Fetching balance for wallet: ${wallet}`)
      
      let balance = 0
      
      if (solscanApiKey) {
        // Try Solscan first if API key is available
        balance = await fetchWalletBalanceSolscan(wallet, solscanApiKey)
      } else {
        console.log("No Solscan API key, using RPC method")
        // Use RPC method as fallback
        balance = await fetchWalletBalanceRPC(wallet)
      }
      
      console.log(`Wallet ${wallet} balance: $${balance}`)
      totalUsdValue += balance
      walletBalances.push({
        address: wallet,
        usdValue: balance
      })
    }

    console.log(`Total USD value: $${totalUsdValue}`)

    res.json({
      total: totalUsdValue,
      wallets: walletBalances, // Added for debugging
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in /api/wallet-balances endpoint:", error)
    res.status(500).json({ 
      error: "Failed to fetch balances",
      message: error.message 
    })
  }
})

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.SOLSCAN_API_KEY 
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

module.exports = app
