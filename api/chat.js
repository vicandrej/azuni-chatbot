// api/chat.js - Vercel serverless function (CommonJS)
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

  // Diagnostika API kluca
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ 
      content: [{ text: "CHYBA: ANTHROPIC_API_KEY nie je nastaveny vo Vercel env vars. Chod do Vercel dashboard -> Settings -> Environment Variables a pridaj ho. Potom spust Redeploy." }] 
    });
  }

  let messages;
  try {
    messages = req.body?.messages;
    if (!messages || !Array.isArray(messages)) {
      return res.status(200).json({ 
        content: [{ text: "CHYBA: messages musi byt pole. Dostal som: " + JSON.stringify(req.body).slice(0, 200) }] 
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
- NIKDY markdown hvezdicky
- NIKDY ceske slova: nie "denno", nie "dlouha"
- Jedna otazka naraz
- Kratke odpovede, max 2 vety + otazka

KONTEXT: Diagnostikujes efektivitu ambulancie. Uz prebehli uvitanie a zakladne otazky. Pokracuj v diagnostike podla poradia otazok ktore este nepadli. Otazky su:
7. Kolko telefonatov denne vybavi ambulancia?
8. Kolko minut denne zaberaju telefonaty?
9. Kolko percent pacientov sa nedovola a odide bez toho aby si vybavili co potrebovali?
10. Priradte pocet telefonatov k jednotlivemu dovodu: (tabulka pride sama)
11. Kolko emailov a SMS denne odoslete pacientom?
12. Kolko pacientov denne vyrusi zaklopanim?
13. Kolko pacientov denne vybavite osobne?
14. Kolko percent pride kvoli veciam ktore by sa dali vybavit online?
15. Akym sposobom volate pacienta z cakarni?
16. Ako casto vznikaju navaly pacientov - 5 a viac naraz?
17. Aka je priemerna cakacia doba?
18. Ako casto vznikaju konflikty o poradie v cakarni?
19. Kolko minut stravite administrativou na jedneho pacienta - vratane triaze, identifikacie a zapisu do karty?
20. Kolko percent pracovneho casu ide na administrativu?
21. Na aku emailovu adresu poslat vysledky?
22. Po emaili: ukaz skore X/100. Napis presne: "Ambulancie ktore pouzivaju ZdraviePro dosahuju: 📞 Pokles telefonatov o 60,28 % | ⏱️ Cakacia doba skratena o 57,12 % | 📋 Administrativa klesa o 46,3 % | 📅 75% menej nepricitov na termin" Potom: "Zaujimalo by Vas ako si mozete zjednodusit pracu a znizit telefonaty az o 40%?"
23. Ak ano: "Na akom telefonnom cisle Vas mozeme zastihnut?"
24. "Kedy je pre Vas preferovany cas hovoru?"
25. "Dakujem za rozhovor [oslovenie]. Zavola Vam nas kolega. Pekny den!"`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        system,
        messages
      })
    });

    // Najprv ziskaj text - aby sme videli aj ne-JSON odpovede
    const rawText = await r.text();
    
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      // Anthropic vratila HTML/text namiesto JSON
      return res.status(200).json({ 
        content: [{ 
          text: "CHYBA: Anthropic API vratila neplatnu odpoved (status " + r.status + "). Prvych 300 znakov: " + rawText.slice(0, 300) 
        }] 
      });
    }

    if (data.error) {
      return res.status(200).json({ 
        content: [{ 
          text: "CHYBA: " + data.error.type + " - " + data.error.message 
        }] 
      });
    }

    return res.status(200).json(data);

  } catch (e) {
    return res.status(200).json({ 
      content: [{ text: "CHYBA (handler catch): " + e.message }] 
    });
  }
};
