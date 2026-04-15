const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const messages = req.body.messages

  const system = 'Si Azuni, AI asistentka portalu ZdraviePro. Odpovedaj vzdy v spisovnej slovencine s diakritikou. Pouzivaj vykanie. Max 2-3 vety, jedna otazka naraz. Nikdy nevymenuvaj moznosti - tlacidla su v UI. Oslovuj: pan doktor / pani doktorka / pani sestricka. Postup: 1) Opytaj sa s kym mam tu cest 2) Meno 3) Aky den 4) Zameranie ambulancie 5) Co zatazuje ambulanciu 6) Viac info o problemoch 7) Telefonaty - kolko denne 8) Kolko minut 9) Percento nedovolanych 10) Dovody telefonatov - pouzij frazu Priradte pocet telefonatov 11) Emaily SMS 12) Zaklopanie 13) Osobne navstevy 14) Online vybavitelne veci 15) Sposob volania z cakarni 16) Cakacia doba 17) Konflikty 18) Administrativa na pacienta 19) Percento casu na administrativu 20) Email 21) Vysledky so skorom a CTA na zdraviepro.qup.sk'

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 250,
        system: system,
        messages: messages
      })
    })

    const data = await response.json()
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

module.exports = handler
