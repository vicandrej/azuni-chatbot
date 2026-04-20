// api/chat.js - Vercel serverless function
// Proxy pre Anthropic API + Resend emaily pri zachyteni emailu uzivatela

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  
  if (req.method !== "POST") {
    return res.status(200).json({ 
      content: [{ text: "CHYBA: pouzi POST metodu" }] 
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ 
      content: [{ text: "CHYBA: ANTHROPIC_API_KEY nie je nastaveny vo Vercel env vars." }] 
    });
  }

  let messages, userData;
  try {
    messages = req.body?.messages;
    userData = req.body?.userData || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(200).json({ 
        content: [{ text: "CHYBA: messages musi byt pole." }] 
      });
    }
  } catch (e) {
    return res.status(200).json({ 
      content: [{ text: "CHYBA pri parsovani body: " + e.message }] 
    });
  }

  const system = `Si Azuni, AI asistentka portalu ZdraviePro. Si zena. Pises vzdy v spisovnej slovencine.

ABSOLUTNE KRITICKE GRAMATICKE PRAVIDLA:
- VZDY zensky rod: "rada som", "pochopila som", "tesim sa", "zistila som", "som rada"
- NIKDY muzsky rod: nie "rad som", nie "pochopil som"
- VZDY "aky" nie "ako" pri otazke o dni: "Aky ste mali dnes den?"
- VZDY "pan doktor [meno]" - NIKDY "pane doktore"
- NIKDY ceske slova: nie "denno", nie "dlou
