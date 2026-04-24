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

  const FROM_EMAIL = 'Azuni, ZdraviePro <azuni@zdravie.pro>';
  const INTERNAL_EMAIL = 'andrej@qup.sk';
  const SYSTEM_URL = 'https://system.zdravie.pro';     // pre variant A (so zanechanym tel.)
  const LANDING_URL = 'https://zdraviepro.qup.sk';      // pre variant B (bez telefonu)
  const MAIN_WEB = 'https://www.zdravie.pro';
  const KIOSK_IMG = 'https://i.imgur.com/IBK9dxx.jpeg';

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
  
  // Personalizovana casť podla zatazenia (kratke reakcie do uvodneho odstavca)
  const zatazTextLower = (leadData.zatazOptions || '').toLowerCase();
  const hasTel = zatazTextLower.includes('telefon');
  const hasAdmin = zatazTextLower.includes('administr');
  const hasNaval = zatazTextLower.includes('naval');
  const hasKonflikt = zatazTextLower.includes('konflikt');
  const hasRutina = zatazTextLower.includes('rutin');

  // Personalizovana vstupna veta - reflektuje co si on vybral
  let personalIntro = '';
  const painPoints = [];
  if(hasTel) painPoints.push('telefonáty');
  if(hasAdmin) painPoints.push('administratíva');
  if(hasNaval) painPoints.push('návaly pacientov');
  if(hasKonflikt) painPoints.push('konflikty v čakárni');
  if(hasRutina) painPoints.push('rutinná komunikácia');

  if(painPoints.length > 0) {
    const painText = painPoints.length === 1 ? painPoints[0] :
                     painPoints.length === 2 ? painPoints.join(' a ') :
                     painPoints.slice(0,-1).join(', ') + ' a ' + painPoints.slice(-1);
    
    // Gramatika: viac pain pointov → mnozne ("zatazuju")
    // Jeden pain point → zalezi na tom aky je (administrativa/rutina = jednotne, ostatne mnozne)
    let verb = 'zaťažujú';
    if(painPoints.length === 1) {
      const single = painPoints[0];
      if(single === 'administratíva' || single === 'rutinná komunikácia') {
        verb = 'zaťažuje';
      }
    }
    
    personalIntro = `Z Vašich odpovedí vidím, že Vás najviac ${verb} <strong>${painText}</strong>. A práve to sú oblasti, ktoré ZdraviePro rieši úplne.`;
  } else {
    personalIntro = 'ZdraviePro komplexne zastrešuje všetky oblasti, ktoré v ambulanciách stále zaberajú čas — od manažmentu čakárne až po online služby pre pacientov.';
  }

  // Zaverecna casť - lisi sa podla A/B variantu
  const closingBlock = hasPhone ? `
    <div style="background:linear-gradient(135deg,rgba(47,184,184,0.15),rgba(43,45,126,0.08));border:1.5px solid #2FB8B8;border-radius:12px;padding:22px;margin:28px 0;">
      <div style="color:#1A8A8A;font-size:17px;font-weight:700;margin-bottom:10px;">📞 Tešíme sa na náš rozhovor</div>
      <p style="color:#1E2060;font-size:14px;line-height:1.7;margin:0 0 10px 0;">
        Ďakujem, že ste si na diagnostiku našli čas. Ozveme sa Vám v preferovanom čase <strong>${escapeHtml(leadData.preferovanyCas || 'podľa dohody')}</strong> na číslo <strong>${escapeHtml(leadData.telefon || '')}</strong>.
      </p>
      <p style="color:#1E2060;font-size:14px;line-height:1.7;margin:0;">
        Počas hovoru sa pokojne pozrieme na to, ktoré z týchto oblastí Vás trápia najviac a ako Vám vieme reálne pomôcť — bez tlaku, bez záväzkov.
      </p>
    </div>

    <div style="text-align:center;margin:24px 0 12px 0;">
      <p style="color:#7A7FAD;font-size:13px;margin:0 0 10px 0;">Ak sa chcete dovtedy pozrieť, ako systém vyzerá v praxi:</p>
      <a href="${SYSTEM_URL}" style="display:inline-block;color:#1A8A8A;text-decoration:none;border:1.5px solid #2FB8B8;padding:11px 24px;border-radius:10px;font-weight:600;font-size:14px;">Pozrieť systém ZdraviePro →</a>
    </div>
  ` : `
    <div style="background:linear-gradient(135deg,rgba(47,184,184,0.10),rgba(43,45,126,0.06));border:1.5px solid rgba(47,184,184,0.30);border-radius:12px;padding:22px;margin:28px 0;text-align:center;">
      <p style="color:#1E2060;font-size:15px;line-height:1.7;margin:0 0 18px 0;font-weight:500;">
        Ak by Vás zaujímalo, ako by to fungovalo konkrétne u Vás, rada si s Vami nezáväzne zavolám. 15 minút, bez tlaku, bez záväzkov. 😊
      </p>
      <a href="${LANDING_URL}" style="display:inline-block;background:linear-gradient(135deg,#5BC8C8,#1A8A8A);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">Dohodnúť nezáväzný hovor →</a>
    </div>

    <div style="text-align:center;margin:16px 0;">
      <p style="color:#7A7FAD;font-size:13px;margin:0 0 8px 0;">Alebo si najprv pozrite systém:</p>
      <a href="${SYSTEM_URL}" style="color:#1A8A8A;text-decoration:none;font-weight:500;font-size:14px;">system.zdravie.pro →</a>
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
      ďakujem, že ste si našli čas na našu diagnostiku. Pozrela som sa na Vaše odpovede a rada by som sa s Vami podelila o to, čo z nich vyšlo. 😊
    </p>

    <!-- SKORE -->
    <div style="background:linear-gradient(135deg,rgba(47,184,184,0.10),rgba(43,45,126,0.06));border:2px solid #2FB8B8;border-radius:12px;padding:24px;text-align:center;margin:20px 0 24px 0;">
      <div style="color:#7A7FAD;font-size:13px;margin-bottom:8px;">Vaše skóre efektivity</div>
      <div style="color:#1A8A8A;font-size:48px;font-weight:800;line-height:1;">${leadData.skore || 42}<span style="font-size:22px;color:#7A7FAD;font-weight:400;"> / 100</span></div>
      <div style="color:#7A7FAD;font-size:12px;margin-top:10px;font-style:italic;">Ambulancie, ktoré používajú systém ZdraviePro, dosahujú priemerne 85+ bodov</div>
    </div>

    <!-- PERSONALIZOVANY INTRO -->
    <p style="color:#1E2060;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
      ${personalIntro}
    </p>

    <!-- CO ZDRAVIE PRO PRINESIE - HLAVNA CAST -->
    <h2 style="color:#2B2D7E;font-size:20px;margin:28px 0 8px 0;">Ako Vám ZdraviePro pomôže</h2>
    <p style="color:#7A7FAD;font-size:13px;line-height:1.6;margin:0 0 20px 0;">
      Personalizovaná analýza na základe toho, čo Vás najviac zaťažuje.
    </p>

    <!-- PERSONALIZOVANE BLOKY -->
    <div style="margin-bottom:24px;">
      ${solutionBlocksHtml}
    </div>

    <!-- FOTKA KIOSKU -->
    <div style="margin:28px 0;text-align:center;">
      <img src="${KIOSK_IMG}" alt="Kiosk ZdraviePro v čakárni" style="max-width:100%;width:100%;border-radius:12px;border:1px solid #e0e5ef;display:block;"/>
      <p style="color:#7A7FAD;font-size:12px;font-style:italic;margin:10px 0 0 0;">Kiosk ZdraviePro v čakárni — samoobslužná identifikácia a poradové lístky</p>
    </div>

    <!-- HLAVNY COPY - ODBREMENENIE OD RUTINY -->
    <div style="background:linear-gradient(135deg,rgba(47,184,184,0.08),rgba(43,45,126,0.04));border-radius:12px;padding:22px 24px;margin:28px 0;">
      <p style="color:#1E2060;font-size:15px;line-height:1.75;margin:0;">
        <strong style="color:#1A8A8A;">ZdraviePro Vám zjednoduší prácu a odbremení Vás od rutinných úloh</strong>, ktoré dnes väčšina ambulancií robí ručne — zatiaľ čo ich už dnes za Vás môže robiť systém.
      </p>
    </div>

    <!-- REFERENCIA -->
    <div style="background:#fff;border:1px solid #e0e5ef;border-left:4px solid #2FB8B8;border-radius:10px;padding:22px 24px;margin:24px 0;">
      <div style="color:#1E2060;font-size:15px;line-height:1.75;font-style:italic;margin-bottom:14px;">
        "Pred ZdraviePro sme mali každé ráno telefón rozpálený. Dnes sa pacienti objednávajú sami online, čakáreň je pokojná a moji kolegovia konečne majú čas robiť to, na čo sú vyštudovaní — venovať sa pacientom. Neviem si už predstaviť ambulanciu bez tohto systému."
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#5BC8C8,#1A8A8A);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;">JK</div>
        <div>
          <div style="color:#1E2060;font-weight:600;font-size:14px;">MUDr. Ján Kováč</div>
          <div style="color:#7A7FAD;font-size:12px;">Všeobecný lekár · Bratislava</div>
        </div>
      </div>
    </div>

    <!-- AGREGATNE VYSLEDKY - ako sekundarny dokaz -->
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
    ZdraviePro · <a href="${SYSTEM_URL}" style="color:#7A7FAD;">system.zdravie.pro</a><br/>
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
