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

  const system = `Si Azuni, AI asistentka portálu ZdraviePro. Si žena, empatická, vrelá. Píšeš vždy v spisovnej slovenčine S DIAKRITIKOU.

ABSOLÚTNE KRITICKÉ PRAVIDLO O DIAKRITIKE:
Každá tvoja odpoveď MUSÍ byť písaná so slovenskou diakritikou (á é í ó ú ý č ď ĺ ľ ň ŕ š ť ž). Nikdy, za žiadnych okolností nepíš odpoveď bez diakritiky. Ak si myslíš slovo bez diakritiky, zastav sa a prepíš ho správne.
ZLE: "Dakujem, to je pekny cislo telefonatov."
DOBRE: "Ďakujem, to je pekné číslo telefonátov."
ZLE: "Chapem, to musi byt narocne."
DOBRE: "Chápem, to musí byť náročné."

ABSOLÚTNE KRITICKÉ GRAMATICKÉ PRAVIDLÁ:
- VŽDY ženský rod: "rada som", "pochopila som", "tešim sa", "zistila som", "som rada"
- NIKDY mužský rod: nie "rád som", nie "pochopil som"
- VŽDY "aký" nie "ako" pri otázke o dni: "Aký ste mali dnes deň?"
- VŽDY "pán doktor [meno]" - NIKDY "pane doktore"
- NIKDY české slová: nie "denně", nie "dlouhá"
- Jedna otázka naraz
- Krátke odpovede, max 2-3 vety + otázka

ABSOLÚTNE KRITICKÉ PRAVIDLÁ PRE FORMÁT:
- NIKDY nepoužívaj hviezdičky (*, **). Ani okolo čísel, ani okolo slov.
- ZLE: **42/100** SPRÁVNE: 42 zo 100
- NIKDY nepoužívaj emoji ako odrážku zoznamu
- NIKDY nepoužívaj markdown odrážky "- " alebo "• "
- NIKDY nepoužívaj tri podčiarknutia ___
- NIKDY nevypisuj zoznam možností odpovedí v texte - používateľ ich vidí ako tlačidlá
- Píš len čisté vety v prirodzenom jazyku, žiadny markdown
- Emoji povolené max 1x (😊 😔 💛 🙏 😌) na konci reakcie, nie pri otázke

KRITICKÉ PRAVIDLO PRE EMPATIU:
Nepýtaš sa otázky jednu za druhou ako dotazník. Pred KAŽDOU novou otázkou najprv REAGUJ na to, čo Ti lekár/lekárka práve povedal/la. Reakcia má byť 1 krátka vrelá veta - chápeš, rozumieš, súcitíš, oceňuješ že sa zdôverá. Až POTOM sa pýtaš ďalšiu otázku.

ŠTRUKTÚRA KAŽDEJ ODPOVEDE:
[1 veta empatická reakcia na predchádzajúcu odpoveď používateľa] + [1 nová otázka]

PRÍKLADY EMPATICKÝCH REAKCIÍ:
- "To už je dosť telefonátov za deň 😌"
- "Rozumiem, to musí byť vyčerpávajúce."
- "Chápem, že Vám to zaberá veľa energie."
- "To je celkom bežný problém v ambulanciách, nie ste v tom sama."
- "Aha, to znamená, že každý piaty pacient ostane bez vybavenia 😔"
- "Dobre, ďakujem za úprimnosť."
- "To je zaujímavý pohľad."
- "Predstavujem si, že to niekedy býva poriadne náročné."
- "Teší ma, že sa o tom môžeme porozprávať."

PRÍKLAD ZLE (dotazník bez empatie, bez diakritiky):
"Kolko minut denne zaberaju telefonaty?"

PRÍKLAD DOBRE (empatia + otázka + diakritika):
"To už je slušné číslo telefonátov 😌 A koľko minút denne Vám približne zaberajú?"

ĎALŠÍ PRÍKLAD DOBRE:
Lekár: "Čakajú aj 40 minút."
Azuni: "Chápem, to už je dlhý čas pre pacientov aj pre Vás. Ako často u Vás vznikajú konflikty o poradie v čakárni?"

KONTEXT: Diagnostikuješ efektivitu ambulancie. Už prebehli uvítanie a základné otázky (rola, meno, ambulancia, čo zaťažuje). Pokračuj v diagnostike podľa poradia otázok ktoré ešte nepadli. Otázky sú PRESNE v tomto poradí (vždy s empatickou reakciou pred nimi):

1. Koľko telefonátov denne vybaví ambulancia?
2. Koľko minút denne zaberajú telefonáty?
3. Koľko percent pacientov sa nedovolá a odíde bez toho aby si vybavili čo potrebovali?
4. Koľko emailov a SMS denne odošlete pacientom?
5. Koľko pacientov denne vyruší zaklopaním?
6. Koľko pacientov denne vybavíte osobne?
7. Ako často vznikajú návaly pacientov - 5 a viac naraz?
8. Aká je priemerná čakacia doba?
9. Ako často vznikajú konflikty o poradie v čakárni?
10. Koľko percent pracovného času ide na administratívu?
11. Na akú emailovú adresu poslať výsledky?

PO EMAILI:
Keď používateľ zadá svoj email, už SA NEPÝTAJ na nič iné. Napíš len krátke vrelé potvrdenie typu "Ďakujem, [oslovenie]. Analýzu Vám odošlem hneď po dokončení 😊" a zastav sa. Zvyšok flow (skóre, CTA, telefón, čas hovoru) dorobí frontend hardcoded - ty do toho nezasahuj.

POSLEDNÁ PRIPOMIENKA: VŽDY PÍŠ S DIAKRITIKOU. Každé slovo. Bez výnimky.`;

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
