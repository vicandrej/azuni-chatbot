// api/send-email.js
// Odosiela 2 emaily cez Resend po dokonceni diagnostiky:
//  1. Interny lead na andrej@qup.sk
//  2. Personalizovana analyza lekarovi

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
    
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 0;color:#7A7FAD;width:40%;">Meno:</td><td style="padding:8px 0;color:#1E2060;font-weight:600;">${escapeHtml(oslovenie)}</td></tr>
      <tr><td style="padding:8px 0;color:#7A7FAD;">Rola:</td><td style="padding:8px 0;color:#1E2060;">${escapeHtml(leadData.role || '-')}</td></tr>
      <tr><td style="padding:8px 0;color:#7A7FAD;">Ambulancia:</td><td style="padding:8px 0;color:#1E2060;">${escapeHtml(leadData.ambulancia || '-')}</td></tr>
      <tr><td style="padding:8px 0;color:#7A7FAD;">Email:</td><td style="padding:8px 0;color:#1E2060;"><a href="mailto:${escapeHtml(leadData.email)}" style="color:#1A8A8A;">${escapeHtml(leadData.email)}</a></td></tr>
      <tr><td style="padding:8px 0;color:#7A7FAD;">Telefón:</td><td style="padding:8px 0;color:#1E2060;font-weight:600;">${escapeHtml(leadData.telefon || '-')}</td></tr>
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
  const doctorSubject = `Výsledky diagnostiky Vašej ambulancie — ZdraviePro`;
  
  // Generuj personalizovany text o zatazi
  const zatazTextLower = (leadData.zatazOptions || '').toLowerCase();
  const hasTel = zatazTextLower.includes('telefon');
  const hasAdmin = zatazTextLower.includes('administr');
  const hasNaval = zatazTextLower.includes('naval');
  const hasKonflikt = zatazTextLower.includes('konflikt');
  const hasRutina = zatazTextLower.includes('rutin');

  let personalizovanaAnalyza = '';
  if(hasTel) personalizovanaAnalyza += '<li><strong>Telefonáty</strong> zaberajú nadpriemerne veľa času Vášho tímu. Klienti ZdraviePro reportujú priemerný <strong>pokles telefonátov o 60,28 %</strong> vďaka online objednávaniu a automatizovaným pripomienkam.</li>';
  if(hasAdmin) personalizovanaAnalyza += '<li><strong>Administratíva</strong> Vám berie čas, ktorý by ste mohli venovať pacientom. Systém ZdraviePro znižuje administratívnu záťaž o priemerne <strong>46,3 %</strong> cez digitálne formuláre, automatické zápisy a integráciu so zdravotnou kartou.</li>';
  if(hasNaval) personalizovanaAnalyza += '<li><strong>Návaly pacientov</strong> v čakárni spôsobujú stres aj pre Vás, aj pre pacientov. Online objednávací systém rozloží pacientov rovnomerne — ambulancie používajúce ZdraviePro hlásia <strong>o 57,12 % kratšie čakanie</strong>.</li>';
  if(hasKonflikt) personalizovanaAnalyza += '<li><strong>Konflikty v čakárni</strong> často vznikajú z nejasného poradia. Digitálny vyvolávací systém a jasné online termíny eliminujú tieto situácie.</li>';
  if(hasRutina) personalizovanaAnalyza += '<li><strong>Rutinná komunikácia</strong> (recepty, výsledky, potvrdenia) sa dá zautomatizovať. Pacienti dostanú čo potrebujú, Vy ušetríte hodiny týždenne.</li>';
  
  if(!personalizovanaAnalyza) {
    personalizovanaAnalyza = '<li>ZdraviePro prináša v priemere <strong>60,28 % pokles telefonátov</strong>, <strong>57,12 % kratšie čakanie</strong> a <strong>46,3 % menej administratívy</strong>.</li>';
  }

  const doctorHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#f7f9fc;">
  <div style="background:linear-gradient(135deg,#5BC8C8,#1A8A8A);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
    <div style="color:#fff;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;margin-bottom:8px;">ZdraviePro</div>
    <h1 style="color:#fff;font-size:24px;margin:0;">Výsledky diagnostiky Vašej ambulancie</h1>
  </div>

  <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px;border:1px solid #e0e5ef;border-top:none;">
    <p style="color:#1E2060;font-size:16px;line-height:1.7;">Dobrý deň, ${escapeHtml(oslovenie)},</p>
    
    <p style="color:#1E2060;font-size:15px;line-height:1.7;">
      ďakujem za čas, ktorý ste venovali diagnostike. Na základe Vašich odpovedí som pre Vás pripravila personalizovanú analýzu.
    </p>

    <div style="background:linear-gradient(135deg,rgba(47,184,184,0.10),rgba(43,45,126,0.06));border:2px solid #2FB8B8;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
      <div style="color:#7A7FAD;font-size:13px;margin-bottom:8px;">Vaše skóre efektivity</div>
      <div style="color:#1A8A8A;font-size:48px;font-weight:800;line-height:1;">${leadData.skore || 42}<span style="font-size:24px;color:#7A7FAD;font-weight:400;"> / 100</span></div>
    </div>

    <h3 style="color:#2B2D7E;font-size:18px;margin:28px 0 12px 0;">Čo Vám ukázala diagnostika</h3>
    <p style="color:#1E2060;font-size:14px;line-height:1.7;">
      Na základe Vašich odpovedí vidíme, že Vaša ambulancia stráca čas a kapacitu najmä v týchto oblastiach:
    </p>
    <ul style="color:#1E2060;font-size:14px;line-height:1.8;padding-left:20px;">
      ${personalizovanaAnalyza}
    </ul>

    <h3 style="color:#2B2D7E;font-size:18px;margin:28px 0 12px 0;">Čo by ste mohli získať so ZdraviePro</h3>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">
      <tr><td style="padding:10px 0;border-bottom:1px solid #e0e5ef;color:#1E2060;font-size:14px;">📞 Pokles telefonátov</td><td style="padding:10px 0;border-bottom:1px solid #e0e5ef;color:#1A8A8A;font-weight:700;text-align:right;">−60,28 %</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e0e5ef;color:#1E2060;font-size:14px;">⏱️ Kratšie čakanie pacientov</td><td style="padding:10px 0;border-bottom:1px solid #e0e5ef;color:#1A8A8A;font-weight:700;text-align:right;">−57,12 %</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e0e5ef;color:#1E2060;font-size:14px;">📋 Menej administratívy</td><td style="padding:10px 0;border-bottom:1px solid #e0e5ef;color:#1A8A8A;font-weight:700;text-align:right;">−46,3 %</td></tr>
      <tr><td style="padding:10px 0;color:#1E2060;font-size:14px;">📅 Menej neprítomností na termíne</td><td style="padding:10px 0;color:#1A8A8A;font-weight:700;text-align:right;">−75 %</td></tr>
    </table>

    <div style="text-align:center;margin:32px 0 16px 0;">
      <a href="https://zdraviepro.qup.sk" style="display:inline-block;background:linear-gradient(135deg,#5BC8C8,#1A8A8A);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">Dohodnúť nezáväzný hovor →</a>
    </div>

    <p style="color:#7A7FAD;font-size:13px;line-height:1.7;margin-top:24px;text-align:center;">
      Ak máte akékoľvek otázky, stačí odpovedať na tento e-mail.
    </p>

    <p style="color:#1E2060;font-size:14px;line-height:1.7;margin-top:24px;">
      S pozdravom,<br/>
      <strong>Azuni</strong><br/>
      <span style="color:#7A7FAD;">AI asistentka · ZdraviePro</span>
    </p>
  </div>

  <div style="text-align:center;color:#7A7FAD;font-size:12px;margin-top:16px;padding:0 16px;">
    ZdraviePro · system.zdravie.pro<br/>
    <a href="https://www.zdravie.pro/ochrana-osobnych-udajov" style="color:#7A7FAD;">Ochrana osobných údajov</a>
  </div>
</body>
</html>`;

  // Odoslat oba emaily
  const results = { internal: null, doctor: null };
  
  try {
    // Email 1: interny
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
    // Email 2: lekarovi
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
