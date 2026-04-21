// api/send-email.js
// Odosiela 2 emaily cez Resend po dokonceni diagnostiky:
//  1. Interny lead na andrej@qup.sk
//  2. Personalizovana analyza lekarovi (2 varianty - s/bez telefonu)

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY nie je nastaveny');
    return res.status(200).json({ 
      error: 'RESEND_API_KEY nie je nastaveny vo Vercel env vars',
      ok: false
    });
  }

  const FROM_EMAIL = 'Azuni <azuni@zdravie.pro>';
  const INTERNAL_EMAIL = 'andrej@qup.sk';
  const WEB_URL = 'https://zdraviepro.qup.sk';
  const MAIN_WEB = 'https://www.zdravie.pro';

  let leadData;
  try {
    leadData = req.body?.leadData;
    if (!leadData || !leadData.email) {
      return res.status(400).json({ error: 'leadData.email je povinny' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Neplatny body: ' + e.message });
  }

  const oslovenie = 
    leadData.role === 'lekar' ? 'pán doktor ' + leadData.name :
    leadData.role === 'lekarka' ? 'pani doktorka ' + leadData.name :
    'pani sestrička ' + leadData.name;

  // Detekcia ci dal telefon (Variant A vs B)
  const hasPhone = leadData.telefon && leadData.telefon.trim().length > 3 && 
                   leadData.preferovanyCas !== 'Záujem odmietol';

  // Formatuj konverzaciu pre interny email
  const conversationText = (leadData.conversation || [])
    .filter(m => m.content && m.content !== 'Zacni rozhovor.')
    .map(m => {
      const who = m.role === 'user' ? (leadData.name || 'Lekár') : 'Azuni';
      return `${who}:\n${m.content}\n`;
    })
    .join('\n---\n\n');

  // ===== EMAIL 1: INTERNY LEAD =====
  const internalSubject = `Nový lead — ${leadData.name || 'Neznámy'}, ${leadData.ambulancia || 'neznáma ambulancia'}`;
  
  const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f7f9fc;">
  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e0e5ef;">
    <h2 style="color:#1A8A8A;margin:0 0 16px 0;">🎯 Nový lead z Azuni</h2>
    
    <div style="background:${hasPhone ? '#E8F5E8' : '#FFF3E0'};border-radius:8px;padding:12px 16px;margin-bottom:20px;">
      <strong style="color:${hasPhone ? '#2E7D32' : '#E65100'};">
        ${hasPhone ? '✅ Súhlasil s hovorom — kontaktuj ho' : '⚠️ Nesúhlasil s hovorom — email ho ešte môže vrátiť'}
      </strong>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 0;color:#7A7FAD;width:40%;">Meno:</td><td style="padding:8px 0;color:#1E2060;font-weight:600;">${escapeHtml(oslovenie)}</td></tr>
      <tr><td style="padding:8px 0;color:#7A7FAD;">Rola:</td><td style="padding:8px 0;color:#1E2060;">${escapeHtml(leadData.role || '-')}</td></tr>
      <tr><td style="padding:8px 0;color:#7A7FAD;">Ambulancia:</td><td style="padding:8px 0;color:#1E2060;">${escapeHtml(leadData.ambulancia || '-')}</td></tr>
      <tr><td style="padding:8px 0;color:#7A7FAD;">Email:</td><td style="padding:8px 0;color:#1E2060;"><a href="mailto:${escapeHtml(leadData.email)}" style="color:#1A8A8A;">${escapeHtml(leadData.email)}</a></td></tr>
      <tr><td style="padding:8px 0;color:#7A7FAD;">Telefón:</td><td style="padding:8px 0;color:#1E2060;font-weight:600;">${escapeHtml(leadData.telefon || '— nenechal —')}</td></tr>
      <tr><td style="padding:8px 0;color:#7A7FAD;">Preferovaný čas:</td><td style="padding:8px 0;color:#1E2060;font-weight:600;">${escapeHtml(leadData.preferovanyCas || '-')}</td></tr>
      <tr><td style="padding:8px 0;color:#7A7FAD;">Skóre efektivity:</td><td style="padding:8px 0;color:#1A8A8A;font-weight:700;font-size:18px;">${leadData.skore || '-'} / 100</td></tr>
    </table>

    <div style="background:#f7f9fc;border-left:3px solid #2FB8B8;padding:12px 16px;margin-bottom:20px;border-radius:4px;">
      <div style="color:#7A7FAD;font-size:12px;margin-bottom:6px;">Čo ambulanciu zaťažuje (výber):</div>
      <div style="color:#1E2060;font-weight:500;">${escapeHtml(leadData.zatazOptions || '-')}</div>
    </div>

    <details style="margin-top:20px;">
      <summary style="cursor:pointer;color:#1A8A8A;font-weight:600;padding:8px 0;">📝 Celá konverzácia</summary>
      <pre style="white-space:pre-wrap;background:#f7f9fc;padding:16px;border-radius:8px;font-size:12px;color:#1E2060;margin-top:8px;">${escapeHtml(conversationText)}</pre>
    </details>
  </div>
  <div style="text-align:center;color:#7A7FAD;font-size:12px;margin-top:16px;">
    Odoslané automaticky z Azuni · azuni-chatbot.vercel.app
  </div>
</body>
</html>`;

  // ===== EMAIL 2: LEKAROVI =====
  const doctorSubject = `Výsledky Vašej diagnostiky — ZdraviePro`;
  
  // Generuj personalizovanu analyzu podla zatazenia
  const zatazTextLower = (leadData.zatazOptions || '').toLowerCase();
  const hasTel = zatazTextLower.includes('telefon');
  const hasAdmin = zatazTextLower.includes('administr');
  const hasNaval = zatazTextLower.includes('naval');
  const hasKonflikt = zatazTextLower.includes('konflikt');
  const hasRutina = zatazTextLower.includes('rutin');

  // Top personalizovane oblasti - max 3 ktore si sam vybral
  const personalBlocks = [];
  if(hasTel) personalBlocks.push({
    icon: '📞',
    title: 'Telefonáty Vás už nebudú vyčerpávať',
    text: 'Vaši pacienti sa objednajú online, dostanú automatické pripomienky a nemusia Vás zbytočne volať. Ušetrený čas môžete venovať tomu, na čom skutočne záleží — pacientom vo Vašej ambulancii.'
  });
  if(hasAdmin) personalBlocks.push({
    icon: '📋',
    title: 'Menej papierovania, viac medicíny',
    text: 'Digitálne formuláre, automatický zápis do karty a integrácia so zdravotnými systémami Vám vrátia hodiny týždenne, ktoré ste predtým strávili administratívou.'
  });
  if(hasNaval) personalBlocks.push({
    icon: '⏱️',
    title: 'Pokojnejšia čakáreň bez návalov',
    text: 'Online objednávací systém rozloží pacientov rovnomerne počas dňa. Žiadne ranné fronty, žiadny chaos — pacienti prídu vtedy, keď majú termín.'
  });
  if(hasKonflikt) personalBlocks.push({
    icon: '🤝',
    title: 'Pokoj v čakárni a jasné poradie',
    text: 'Digitálny vyvolávací systém a transparentné online termíny odstránia zmätky okolo poradia. Vaša čakáreň bude pôsobiť profesionálne a upokojujúco.'
  });
  if(hasRutina) personalBlocks.push({
    icon: '🔄',
    title: 'Automatizácia rutiny ktorú robíte ručne',
    text: 'Recepty, pripomienky, potvrdenia, výsledky — to všetko môže robiť systém automaticky za Vás. Pacienti dostanú čo potrebujú, Vy získate späť svoj čas.'
  });

  // Ak nevybral nic, daj univerzalne benefity
  if(personalBlocks.length === 0) {
    personalBlocks.push(
      { icon: '📞', title: 'Menej telefonátov', text: 'Pacienti sa objednávajú online, dostávajú automatické pripomienky — telefóny zvonia výrazne menej.' },
      { icon: '📋', title: 'Menej administratívy', text: 'Digitalizácia ručných činností Vám vráti hodiny týždenne.' },
      { icon: '⏱️', title: 'Spokojnejší pacienti', text: 'Kratšie čakanie, lepšia organizácia, moderný prístup.' }
    );
  }

  const top3 = personalBlocks.slice(0, 3);

  const personalBlocksHtml = top3.map(b => `
    <div style="background:#fff;border:1px solid #e0e5ef;border-radius:10px;padding:16px 18px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span style="font-size:22px;">${b.icon}</span>
        <strong style="color:#1A8A8A;font-size:15px;">${b.title}</strong>
      </div>
      <div style="color:#1E2060;font-size:14px;line-height:1.65;">${b.text}</div>
    </div>
  `).join('');

  // Zaverecna casť - lisi sa podla A/B variantu
  const closingBlock = hasPhone ? `
    <div style="background:linear-gradient(135deg,rgba(47,184,184,0.15),rgba(43,45,126,0.08));border:1.5px solid #2FB8B8;border-radius:12px;padding:20px;margin:24px 0;">
      <div style="color:#1A8A8A;font-size:16px;font-weight:700;margin-bottom:10px;">📞 Tešíme sa na náš rozhovor</div>
      <p style="color:#1E2060;font-size:14px;line-height:1.7;margin:0 0 10px 0;">
        Ďakujem, že ste si na diagnostiku našli čas. Ozveme sa Vám v dohodnutom čase <strong>${escapeHtml(leadData.preferovanyCas || 'podľa dohody')}</strong> na číslo <strong>${escapeHtml(leadData.telefon || '')}</strong>.
      </p>
      <p style="color:#1E2060;font-size:14px;line-height:1.7;margin:0;">
        Počas hovoru sa pokojne pozrieme na to, ktoré z týchto oblastí Vás trápia najviac a ako Vám vieme reálne pomôcť — bez tlaku, bez záväzkov.
      </p>
    </div>

    <div style="text-align:center;margin:24px 0 12px 0;">
      <p style="color:#7A7FAD;font-size:13px;margin:0 0 10px 0;">Ak sa chcete dovtedy dozvedieť viac o ZdraviePro:</p>
      <a href="${WEB_URL}" style="display:inline-block;color:#1A8A8A;text-decoration:none;border:1.5px solid #2FB8B8;padding:10px 22px;border-radius:10px;font-weight:600;font-size:14px;">Pozrieť ZdraviePro →</a>
    </div>
  ` : `
    <div style="background:linear-gradient(135deg,rgba(47,184,184,0.10),rgba(43,45,126,0.06));border:1.5px solid rgba(47,184,184,0.30);border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
      <p style="color:#1E2060;font-size:15px;line-height:1.7;margin:0 0 16px 0;font-weight:500;">
        Ak by Vás zaujímalo ako to funguje v praxi a či by to malo zmysel aj pre Vašu ambulanciu, rada si s Vami nezáväzne zavolám. 15 minút, bez tlaku, bez záväzkov.
      </p>
      <a href="${WEB_URL}" style="display:inline-block;background:linear-gradient(135deg,#5BC8C8,#1A8A8A);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">Dohodnúť nezáväzný hovor →</a>
    </div>

    <div style="text-align:center;margin:16px 0;">
      <p style="color:#7A7FAD;font-size:13px;margin:0 0 8px 0;">Alebo si najprv preštudujte viac:</p>
      <a href="${WEB_URL}" style="color:#1A8A8A;text-decoration:none;font-weight:500;font-size:14px;">www.zdravie.pro →</a>
    </div>
  `;

  const doctorHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#f7f9fc;">

  <!-- HERO -->
  <div style="background:linear-gradient(135deg,#5BC8C8,#1A8A8A);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
    <div style="color:#fff;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.9;margin-bottom:10px;">ZdraviePro · Vy liečite – my organizujeme</div>
    <h1 style="color:#fff;font-size:24px;margin:0;line-height:1.3;">Výsledky Vašej diagnostiky</h1>
  </div>

  <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px;border:1px solid #e0e5ef;border-top:none;">
    
    <p style="color:#1E2060;font-size:16px;line-height:1.7;margin:0 0 16px 0;">Dobrý deň, ${escapeHtml(oslovenie)},</p>
    
    <p style="color:#1E2060;font-size:15px;line-height:1.7;margin:0 0 20px 0;">
      ďakujem, že ste si našli čas na našu diagnostiku. Pozrela som sa na Vaše odpovede a chcela by som sa s Vami podeliť o to, čo z nich vyšlo.
    </p>

    <!-- SKORE -->
    <div style="background:linear-gradient(135deg,rgba(47,184,184,0.10),rgba(43,45,126,0.06));border:2px solid #2FB8B8;border-radius:12px;padding:24px;text-align:center;margin:20px 0 24px 0;">
      <div style="color:#7A7FAD;font-size:13px;margin-bottom:8px;">Vaše skóre efektivity</div>
      <div style="color:#1A8A8A;font-size:48px;font-weight:800;line-height:1;">${leadData.skore || 42}<span style="font-size:22px;color:#7A7FAD;font-weight:400;"> / 100</span></div>
      <div style="color:#7A7FAD;font-size:12px;margin-top:10px;font-style:italic;">Ambulancie s Google recenziou 4,5+ dosahujú priemerne 85+ bodov</div>
    </div>

    <!-- CONTEXT -->
    <p style="color:#1E2060;font-size:15px;line-height:1.7;margin:0 0 12px 0;">
      Z toho, čo ste zdieľali, vidím že najviac Vás zaťažuje <strong>${escapeHtml((leadData.zatazOptions || '').toLowerCase())}</strong>. A to je presne oblasť, kde Vám vieme veľmi konkrétne pomôcť.
    </p>

    <p style="color:#1E2060;font-size:15px;line-height:1.7;margin:0 0 20px 0;">
      ZdraviePro <strong>komplexne zastrešuje online služby aj manažment čakárne</strong>. Odbremeňuje Vás od činností, ktoré sa v ambulanciách stále robia ručne — pričom ich dnes už môže robiť systém automatizovane za Vás.
    </p>

    <!-- TOP 3 PERSONALIZOVANE -->
    <h3 style="color:#2B2D7E;font-size:17px;margin:24px 0 14px 0;">Tri veci, ktoré by sa u Vás zmenili najvýraznejšie</h3>
    ${personalBlocksHtml}

    <!-- AGREGATNE VYSLEDKY -->
    <div style="background:#f7f9fc;border-radius:10px;padding:18px 20px;margin:24px 0;">
      <div style="color:#2B2D7E;font-size:14px;font-weight:700;margin-bottom:12px;">Priemerné výsledky ambulancií používajúcich ZdraviePro:</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#1E2060;font-size:13px;">📞 Pokles telefonátov</td><td style="padding:6px 0;color:#1A8A8A;font-weight:700;text-align:right;font-size:14px;">−60,28 %</td></tr>
        <tr><td style="padding:6px 0;color:#1E2060;font-size:13px;">⏱️ Kratšie čakanie pacientov</td><td style="padding:6px 0;color:#1A8A8A;font-weight:700;text-align:right;font-size:14px;">−57,12 %</td></tr>
        <tr><td style="padding:6px 0;color:#1E2060;font-size:13px;">📋 Menej administratívy</td><td style="padding:6px 0;color:#1A8A8A;font-weight:700;text-align:right;font-size:14px;">−46,3 %</td></tr>
        <tr><td style="padding:6px 0;color:#1E2060;font-size:13px;">📅 Menej neprítomností na termíne</td><td style="padding:6px 0;color:#1A8A8A;font-weight:700;text-align:right;font-size:14px;">−75 %</td></tr>
      </table>
    </div>

    <!-- ZAVER - A alebo B -->
    ${closingBlock}

    <!-- PODPIS -->
    <p style="color:#1E2060;font-size:14px;line-height:1.7;margin:28px 0 0 0;">
      S pozdravom,<br/>
      <strong>Azuni</strong><br/>
      <span style="color:#7A7FAD;">AI asistentka · ZdraviePro</span>
    </p>

    <p style="color:#7A7FAD;font-size:12px;line-height:1.6;margin:24px 0 0 0;border-top:1px solid #e0e5ef;padding-top:16px;">
      Ak máte akékoľvek otázky, stačí odpovedať priamo na tento e-mail.
    </p>
  </div>

  <!-- FOOTER -->
  <div style="text-align:center;color:#7A7FAD;font-size:11px;margin-top:16px;padding:0 16px;line-height:1.6;">
    ZdraviePro · system.zdravie.pro<br/>
    <a href="https://www.zdravie.pro/ochrana-osobnych-udajov" style="color:#7A7FAD;">Ochrana osobných údajov</a>
  </div>
</body>
</html>`;

  // Odoslat oba emaily
  const results = { internal: null, doctor: null };
  
  try {
    const r1 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [INTERNAL_EMAIL],
        subject: internalSubject,
        html: internalHtml,
        reply_to: leadData.email
      })
    });
    const d1 = await r1.json();
    results.internal = { status: r1.status, data: d1 };
    if (!r1.ok) console.error('Internal email failed:', d1);
  } catch(e) {
    results.internal = { error: e.message };
    console.error('Internal email exception:', e);
  }

  try {
    const r2 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [leadData.email],
        subject: doctorSubject,
        html: doctorHtml,
        reply_to: INTERNAL_EMAIL
      })
    });
    const d2 = await r2.json();
    results.doctor = { status: r2.status, data: d2 };
    if (!r2.ok) console.error('Doctor email failed:', d2);
  } catch(e) {
    results.doctor = { error: e.message };
    console.error('Doctor email exception:', e);
  }

  return res.status(200).json({ 
    ok: true, 
    variant: hasPhone ? 'A (s hovorom)' : 'B (bez hovoru)',
    results 
  });
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
