// /api/wallet-balances.js (for Vercel backend)
export default async function handler(req, res) {
  const wallets = [
    "akgSyoqae5tWyiuAxZJv5VKzthtHruUkQxgSuPmhWRa",
    "Fqi2c66QRr4wLghXNnhNg4Dr9u4LV4Djy3aL9jcsM5fi"
  ];

  const API_KEY = process.env.SOLSCAN_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Missing SOLSCAN_API_KEY" });
  }

  const headers = {
    accept: "application/json",
    token: API_KEY,
  };

  async function fetchWalletUSD(wallet) {
    try {
      const response = await fetch(`https://public-api.solscan.io/account/${wallet}`, { headers });
      if (!response.ok) {
        console.error(`Solscan API error for ${wallet}:`, response.statusText);
        return 0;
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.tokens)) {
        console.warn(`Unexpected response format for ${wallet}:`, data);
        return 0;
      }

      return data.tokens.reduce((sum, token) => {
        const price = typeof token.price === "number" ? token.price : 0;
        const amount = token.tokenAmount?.uiAmount ?? 0;
        return sum + price * amount;
      }, 0);
    } catch (err) {
      console.error(`Fetch error for ${wallet}:`, err.message);
      return 0;
    }
  }

  try {
    const values = await Promise.all(wallets.map(fetchWalletUSD));
    const total = values.reduce((a, b) => a + b, 0);
    res.status(200).json({ total: total.toFixed(2) });
  } catch (err) {
    console.error("Unexpected error:", err.message);
    res.status(500).json({ error: "Failed to calculate total" });
  }
}
