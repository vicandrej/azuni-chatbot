module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  
  const { messages } = req.body;
  
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 250,
      system: "Si Azuni, AI asistentka ZdraviePro. Odpovedaj v slovenčine s diakritikou. Buď stručná - max 2-3 vety, jedna otázka naraz.",
      messages
    })
  });
  
  const data = await r.json();
  res.status(200).json(data);
};
