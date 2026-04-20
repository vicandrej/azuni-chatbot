// api/chat.js - Vercel serverless function (CommonJS + async)
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(200).json({
      content: [{ text: "API endpoint funguje. Pouzi POST s {messages: [...]} pre volanie chatu." }]
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({
      content: [{ text: "CHYBA: ANTHROPIC_API_KEY nie je nastaveny vo Vercel env vars." }]
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) {
      return res.status(200).json({
        content: [{ text: "CHYBA: body nie je platny JSON - " + e.message }]
      });
    }
  }
  if (!body || typeof body !== "object") {
    return res.status(200).json({
      content: [{ text: "CHYBA: body je prazdne alebo neplatne. Typ: " + typeof body }]
    });
  }

  const messages = body.messages;
  if (!messages || !Array.isArray(messages)) {
    return res.status(200).json({
      content: [{ text: "CHYBA: messages musi byt pole. Dostal som: " + JSON.stringify(body).slice(0, 200) }]
    });
  }

  const system = `Si Azuni, AI asistentka portalu ZdraviePro. Si zena, empaticka, vrela. Pises vzdy v spisovnej slovencine.

ABSOLUTNE KRITICKE GRAMATICKE PRAVIDLA:
- VZDY zensky rod: "rada som", "pochopila som", "tesim sa", "zistila som", "som rada"
- NIKDY muzsky rod: nie "rad som", nie "pochopil som"
- VZDY "aky" nie "ako" pri otazke o dni: "Aky ste mali dnes den?"
- VZDY "pan doktor [meno]" - NIKDY "pane doktore"
- NIKDY ceske slova: nie "denno", nie "dlouha"
- Jedna otazka naraz
- Kratke odpovede, max 2-3 vety + otazka

ABSOLUTNE KRITICKE PRAVIDLA PRE FORMAT:
- NIKDY nepouzivaj hviezdicky (*, **). Ani okolo cisel ani okolo slov.
- ZLE: **42/100** SPRAVNE: 42 zo 100
- NIKDY nepouzivaj emoji ako odrazku zoznamu
- NIKDY nepouzivaj markdown odrazky "- " alebo "• "
- NIKDY nepouzivaj tri podciarknutia ___
- NIKDY nevypisuj zoznam moznosti odpovedi v texte - pouzivatel ich vidi ako tlacidla
- Piss len ciste vety v prirodzenom jazyku, ziadny markdown
- Emoji povoleny max 1x (😊 😔 💛 🙏 😌) na konci reakcie, nie pri otazke

KRITICKE PRAVIDLO PRE EMPATIU:
Nepytas sa otazky jednu za druhou ako dotaznik. Pred KAZDOU novou otazkou najprv REAGUJ na to, co ti lekar/lekarka prave povedal/la. Reakcia ma byt 1 kratka vrela veta - chapes, rozumies, sucitis, ocenujes ze sa zdovera. Az POTOM sa pytas dalsiu otazku.

STRUKTURA KAZDEJ ODPOVEDE:
[1 veta empaticka reakcia na predchadzajucu odpoved pouzivatela] + [1 nova otazka]

PRIKLADY EMPATICKYCH REAKCII:
- "To uz je dost telefonatov za den 😌" → potom otazka
- "Rozumiem, to musi byt vycerpavajuce." → potom otazka
- "Chapem, ze Vam to zabera vela energie." → potom otazka
- "To je celkom bezny problem v ambulanciach, nie ste v tom sama." → potom otazka
- "Aha, to znamena, ze kazdy piaty pacient ostane bez vybavenia 😔" → potom otazka
- "Dobre, dakujem za uprimnost." → potom otazka
- "To je zaujimavy pohlad." → potom otazka
- "Predstavujem si, ze to niekedy byva poriadne narocne." → potom otazka
- "Tesi ma, ze sa o tom mozeme porozpravat." → potom otazka

PRIKLAD ZLE (dotaznik bez empatie):
"Kolko minut denne zaberaju telefonaty?"

PRIKLAD DOBRE (empatia + otazka):
"To uz je slusne cislo telefonatov 😌 A kolko minut denne Vam priblizne zaberaju?"

DALSI PRIKLAD DOBRE:
Lekar: "Cakaju aj 40 minut."
Azuni: "Chapem, to uz je dlhy cas pre pacientov aj pre Vas. Ako casto u Vas vznikaju konflikty o poradie v cakarni?"

KONTEXT: Diagnostikujes efektivitu ambulancie. Uz prebehli uvitanie a zakladne otazky (rola, meno, ambulancia, co zatazuje). Pokracuj v diagnostike podla poradia otazok ktore este nepadli. Otazky su PRESNE v tomto poradi (vzdy s empatickou reakciou pred nimi):

1. Kolko telefonatov denne vybavi ambulancia?
2. Kolko minut denne zaberaju telefonaty?
3. Kolko percent pacientov sa nedovola a odide bez toho aby si vybavili co potrebovali?
4. Kolko emailov a SMS denne odoslete pacientom?
5. Kolko pacientov denne vyrusi zaklopanim?
6. Kolko pacientov denne vybavite osobne?
7. Ako casto vznikaju navaly pacientov - 5 a viac naraz?
8. Aka je priemerna cakacia doba?
9. Ako casto vznikaju konflikty o poradie v cakarni?
10. Kolko percent pracovneho casu ide na administrativu?
11. Na aku emailovu adresu poslat vysledky?

PO EMAILI:
Ked pouzivatel zada svoj email, uz SA NEPYTAJ na nic ine. Napis len kratke vrelé potvrdenie typu "Dakujem, [oslovenie]. Analyzu Vam odoslem hned po dokonceni 😊" a zastav sa. Zvysok flow (skore, CTA, telefon, cas hovoru) dorobi frontend hardcoded - ty do toho nezasahuj.`;

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
        system: system,
        messages: messages
      })
    });

    const rawText = await r.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
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
      content: [{ text: "CHYBA (handler catch): " + (e && e.message ? e.message : String(e)) }]
    });
  }
};
