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

// Get URANUS token balance from first wallet
async function fetchUranusTokenBalance(walletAddress) {
  const URANUS_TOKEN_MINT = "BFgdzMkTPdKKJeTipv2njtDEwhKxkgFueJQfJGt1jups"
  
  try {
    // Get token accounts for the wallet
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
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    if (response.data.error) {
      console.log(`No URANUS token account found for ${walletAddress}`)
      return 0
    }

    if (!response.data.result.value || response.data.result.value.length === 0) {
      console.log(`No URANUS tokens in wallet ${walletAddress}`)
      return 0
    }

    // Get token balance
    const tokenInfo = response.data.result.value[0].account.data.parsed.info
    const tokenAmount = parseFloat(tokenInfo.tokenAmount.uiAmount || 0)

    if (tokenAmount === 0) {
      return 0
    }

    // Try to get URANUS price from Jupiter API (Solana DEX aggregator)
    try {
      const priceResponse = await axios.get(`https://price.jup.ag/v4/price?ids=${URANUS_TOKEN_MINT}`)
      const uranusPrice = priceResponse.data.data[URANUS_TOKEN_MINT]?.price || 0
      
      console.log(`URANUS balance: ${tokenAmount}, Price: ${uranusPrice}`)
      return tokenAmount * uranusPrice
    } catch (priceError) {
      console.log('Could not fetch URANUS price from Jupiter, trying alternative...')
      
      // Alternative: Try DexScreener API
      try {
        const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${URANUS_TOKEN_MINT}`)
        const pairData = dexResponse.data.pairs?.[0]
        const uranusPrice = parseFloat(pairData?.priceUsd || 0)
        
        console.log(`URANUS balance: ${tokenAmount}, Price: ${uranusPrice} (from DexScreener)`)
        return tokenAmount * uranusPrice
      } catch (dexError) {
        console.log(`Could not fetch URANUS price. Token amount: ${tokenAmount}`)
        return 0
      }
    }
  } catch (error) {
    console.error(`Error fetching URANUS token balance for ${walletAddress}:`, error.message)
    return 0
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
    console.error(`Error fetching SOL balance for ${walletAddress}:`, error.message)
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
    return await fetchSolBalanceRPC(walletAddress)
  }
}

app.get("/api/wallet-balances", async (req, res) => {
  console.log("Fetching wallet balances...")
  
  try {
    let totalUsdValue = 0

    // First wallet: SOL + URANUS token
    const firstWallet = WALLETS[0]
    console.log(`Fetching SOL balance for first wallet: ${firstWallet}`)
    const firstWalletSol = await fetchSolBalanceRPC(firstWallet)
    
    console.log(`Fetching URANUS token balance for first wallet: ${firstWallet}`)
    const uranusValue = await fetchUranusTokenBalance(firstWallet)
    
    const firstWalletTotal = firstWalletSol + uranusValue
    console.log(`First wallet total: ${firstWalletTotal} (SOL: ${firstWalletSol}, URANUS: ${uranusValue})`)
    
    // Second wallet: SOL only
    const secondWallet = WALLETS[1]
    console.log(`Fetching SOL balance for second wallet: ${secondWallet}`)
    const secondWalletSol = await fetchSolBalanceRPC(secondWallet)
    console.log(`Second wallet total: ${secondWalletSol}`)
    
    totalUsdValue = firstWalletTotal + secondWalletSol
    console.log(`Grand total: ${totalUsdValue}`)

    // Just return the sum as requested
    res.json({
      total: Math.round(totalUsdValue * 100) / 100 // Round to 2 decimal places
    })
  } catch (error) {
    console.error("Error in /api/wallet-balances endpoint:", error)
    res.status(500).json({ 
      error: "Failed to fetch balances",
      message: error.message 
    })
  }
}))

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
