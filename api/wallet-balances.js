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
      const response = await fetch(`https://public-api.solscan.io/v2/account/tokens?address=${wallet}`, { headers });

      if (!response.ok) {
        console.error(`Solscan API error for ${wallet}:`, response.statusText);
        return 0;
      }

      const tokens = await response.json();
      let total = 0;

      for (const token of tokens) {
        const price = token.tokenPrice?.usd || 0;
        const amount = token.tokenAmount?.uiAmount || 0;
        total += price * amount;
      }

      return total;
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
    res.status(500).json({ error: "Failed to calculate total" });
  }
}
