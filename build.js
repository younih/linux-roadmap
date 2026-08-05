#!/usr/bin/env node
/* build.js — README-fa.md → linux-roadmap-fa.html (interactive RTL course) */
const fs = require('fs');

const md = fs.readFileSync('README-fa.md', 'utf8');
const tpl = fs.readFileSync('template.html', 'utf8');

/* ---------------- inline markdown ---------------- */
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inline(s){
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}
function escapeAttr(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ---------------- blocks ---------------- */
function codeblock(lang, code){
  const label = lang === 'bash' ? 'bash' : lang === 'text' ? 'text' : lang === 'ini' ? 'ini' : 'terminal';
  const escC = escapeAttr(code);
  const hl = escC.split('\n').map(l => /^\s*#/.test(l) ? '<span class="c-cm">'+l+'</span>' : l).join('\n');
  return '<div class="codeblock"><div class="cb-head"><span class="lang">'+label+'</span>'+
         '<button class="copy-btn" data-code="'+escC+'">📋 کپی</button></div>'+
         '<pre><code>'+hl+'</code></pre></div>';
}
function tableHtml(rows){
  const cells = r => r.replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
  let html = '<div class="table-wrap"><table>';
  const head = cells(rows[0]);
  html += '<thead><tr>'+head.map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead>';
  html += '<tbody>';
  for (let i=1;i<rows.length;i++){
    if (/^[\s|\-:]+$/.test(rows[i].replace(/\|/g,''))) continue;
    html += '<tr>'+cells(rows[i]).map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

/* parse one section's line list -> {html, commands, cards} */
function parseSection(lines, secIdx){
  const out = [];
  const commands = [];
  const cards = [];
  let exN = 0, clN = 0;
  let i = 0;
  const N = lines.length;
  const STOP = /^(```|###|>|\||[-*]\s|\d+\.\s|---+$)/;
  while (i < N){
    const line = lines[i].trim();
    if (!line){ i++; continue; }
    if (/^---+$/.test(line)){ i++; continue; }
    if (line.startsWith('```')){
      const lang = line.slice(3).trim() || 'terminal';
      const buf = [];
      i++;
      while (i < N && !lines[i].trim().startsWith('```')){ buf.push(lines[i]); i++; }
      i++;
      const code = buf.join('\n');
      code.split('\n').forEach(s=>{
        const t = s.trim();
        if (!t) return;
        if (!t.startsWith('#')) commands.push(t);
        const m = t.match(/^(\S.*?)\s+#\s+(.+)$/);
        if (m) cards.push({ cmd: m[1], meaning: m[2] });
      });
      out.push(codeblock(lang, code));
      continue;
    }
    if (line.startsWith('###')){
      out.push('<h4>'+inline(line.replace(/^###\s*/,''))+'</h4>'); i++; continue;
    }
    if (line.startsWith('>')){
      const buf = [];
      while (i < N && lines[i].trim().startsWith('>')){ buf.push(lines[i].trim().replace(/^>\s?/,'')); i++; }
      out.push('<div class="callout">'+parseSection(buf, secIdx).html+'</div>');
      continue;
    }
    if (line.startsWith('|')){
      const rows = [];
      while (i < N && lines[i].trim().startsWith('|')){ rows.push(lines[i].trim()); i++; }
      out.push(tableHtml(rows));
      continue;
    }
    if (/^-\s*\[[ x]\]/.test(line)){
      while (i < N && /^-\s*\[[ x]\]/.test(lines[i].trim())){
        const m = lines[i].trim().match(/^-\s*\[[ x]\]\s*(.*)$/);
        out.push('<label class="checkline"><input type="checkbox" data-k="cl-'+secIdx+'-'+clN+'"><span>'+inline(m[1])+'</span></label>');
        clN++; i++;
      }
      continue;
    }
    if (/^[-*]\s+/.test(line)){
      const items = [];
      while (i < N && /^[-*]\s+/.test(lines[i].trim())){ items.push(lines[i].trim().replace(/^[-*]\s+/,'')); i++; }
      out.push('<ul>'+items.map(t=>'<li>'+inline(t)+'</li>').join('')+'</ul>');
      continue;
    }
    if (/^\d+\.\s+/.test(line)){
      const items = [];
      while (i < N && /^\d+\.\s+/.test(lines[i].trim())){ items.push(lines[i].trim().replace(/^\d+\.\s+/,'')); i++; }
      out.push('<ol>'+items.map(t=>'<li>'+inline(t)+'</li>').join('')+'</ol>');
      continue;
    }
    /* paragraph */
    const buf = [];
    while (i < N && lines[i].trim() !== '' && !STOP.test(lines[i].trim())){ buf.push(lines[i].trim()); i++; }
    const text = buf.join(' ');
    if (/^\*\*تمرین/.test(text)){
      const body = text.replace(/^\*\*تمرین([^*]*(?:\([^)]*\))?):\*\*\s*/, '');
      out.push('<div class="exercise"><span class="ex-ico">🎯</span><div class="ex-body"><div class="ex-label">تمرین</div>'+
               '<p>'+inline(body)+'</p></div><span class="ex-check"><input type="checkbox" data-k="ex-'+secIdx+'-'+exN+'">'+
               '<label>انجام شد</label></span></div>');
      exN++;
    } else {
      out.push('<p>'+inline(text)+'</p>');
    }
  }
  return { html: out.join('\n'), commands, cards };
}

/* ---------------- section splitting ---------------- */
const lines = md.split('\n');
const GROUPS = ['شروع کار', 'بخش اول · تئوری', 'بخش دوم · عملی', 'بخش سوم · پیشرفته'];
let group = GROUPS[0];
let introLines = [];
let i = 0;
while (i < lines.length && !lines[i].startsWith('## ')){ introLines.push(lines[i]); i++; }

const GROUP_H1 = /^#\s*(بخش اول|بخش دوم|بخش سوم)/;
let cur = null;
const sections = [];
let inGroupIntro = false;
for (; i < lines.length; i++){
  const l = lines[i];
  if (GROUP_H1.test(l)){
    if (/بخش اول|تئوری/.test(l)) group = GROUPS[1];
    else if (/بخش دوم/.test(l)) group = GROUPS[2];
    else if (/بخش سوم/.test(l)) group = GROUPS[3];
    inGroupIntro = true;
    continue;
  }
  if (l.startsWith('## ')){
    if (cur) sections.push(cur);
    cur = { title: l.replace(/^##\s+/,'').trim(), body: [], group };
    inGroupIntro = false;
    continue;
  }
  if (cur && !inGroupIntro) cur.body.push(l);
}
if (cur) sections.push(cur);

/* ---------------- emoji & badge ---------------- */
const EMO = [
  ['کانتینری','🐳'],['Kubernetes','⛵'],['Ansible','🔁'],['مانیتورینگ','📈'],['کارایی','🏎️'],
  ['شبکه و فایروال','🛰️'],['LVM','🗄️'],['KVM','💻'],['روزمره','🚑'],
  ['کالی','🐉'],['توزیع','🐧'],['ترمینال','⌨️'],['پوسته','🐚'],['لینوکس در واقع','🧬'],
  ['فضای هسته','🛡️'],['فرآیندها: تولد','🔄'],['مدیریت حافظه','🧠'],['inode','🗂️'],['بوت شدن','⚡'],
  ['مفسر','💬'],['ناوبری','📂'],['فایل‌ها و پوشه‌ها','📁'],['مشاهده و ویرایش متن','📝'],
  ['مجوزهای دسترسی','🔐'],['کاربران','👥'],['مدیریت بسته','📦'],['ویرایشگرهای','✏️'],['جستجوی','🔍'],
  ['لوله‌ها','🧵'],['تغییر مسیر','🔀'],['فرآیندها و سیگنال','⚙️'],['systemd و سرویس','🚀'],
  ['لاگ‌ها','📜'],['شبکه','🌐'],['فایروال','🧱'],['آرشیو','🗜️'],['متغیرهای محیطی','🌱'],
  ['لینک‌ها','🔗'],['اسکریپت‌نویسی','🧾'],['دیسک‌ها','💾'],['Cron','⏰'],['SSH','🔑'],
  ['سورس کد','🏗️'],['عیب‌یابی','🛠️'],['پروژه‌هایی','🎯'],['ترفندها','🧠'],['محافظت از سرور','🛡️'],
  ['هک اخلاقی','🕵️'],['چک‌لیست','✅'],['برگه تقلب','⚡'],['واژه‌نامه','📖'],['مسیرهای بعدی','🚀'],
  ['مدیریت پیشرفته','🛠️'],['کتاب‌های','📚'],['تلگرامی','✈️'],['اصل اساسی','💡'],
  ['نمودار','📊'],['پروژه‌ها','🎯'],['لینوکس','🐧']
];
function emojiFor(title){
  for (const [k,e] of EMO){ if (title.includes(k)) return e; }
  return '🐧';
}
function badgeFor(title){
  let m = title.match(/^(T\d+|A\d+)\b/);
  if (m) return m[1];
  m = title.match(/^([۰-۹0-9]+)/);
  if (m) return m[1];
  return '»';
}
function strip(html){ return html.replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ').trim(); }

/* ---------------- render sections ---------------- */
const glossary = [];
const cheatsheet = [];
const cards = [];
const seenCards = new Set();
let commandCount = 0;

sections.forEach((s, idx) => {
  s.key = 'sec-'+idx;
  s.emoji = emojiFor(s.title);
  s.numBadge = badgeFor(s.title);
  const r = parseSection(s.body, idx);
  if (s.title.includes('نمودارهای بصری')){
    s.html = '<div class="callout"><b>📊 این بخش به‌صورت نمودارهای تعاملی در دسترس است.</b><br>'+
      'از منوی بالا، تب «نمودارها» را باز کنید — ۷ نمودار با کیفیت بالا: لایه‌های سیستم، درخت فایل، بوت، چرخه حیات فرآیند، لوله، مجوزهای rwx و لینک‌ها.</div>';
    s.commands = [];
    r.cards = [];
  } else {
    s.html = r.html;
    s.commands = r.commands;
  }
  (r.cards || []).forEach(c => {
    if (seenCards.has(c.cmd)) return;
    seenCards.add(c.cmd);
    cards.push({ id: 'fc-'+cards.length, cmd: c.cmd, meaning: c.meaning, secIdx: idx, secTitle: s.title });
  });
  commandCount += s.commands.length;

  if (s.title.includes('برگه تقلب')){
    const rows = s.body.filter(l => l.trim().startsWith('|'));
    rows.forEach((row, ri) => {
      if (ri === 0) return;
      const cells = row.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
      if (cells.length >= 2){
        cheatsheet.push({ task: esc(cells[0]), cmd: esc(cells[1].replace(/`/g,'')) });
      }
    });
  }
  if (s.title.includes('واژه‌نامه')){
    s.body.forEach(l => {
      const m = l.trim().match(/^-\s*\*\*([^*]+)\*\*\s*[-—]\s*(.+)$/);
      if (m) glossary.push({ term: esc(m[1]), def: inline(m[2]) });
    });
  }
  s.plain = strip(s.html);
});

/* ---------------- intro ---------------- */
const introFiltered = introLines.filter(l => {
  const t = l.trim();
  if (!t || /^# /.test(t) || /^---+$/.test(t)) return false;
  if (/^(\d+\.\s*\[|\-\s*\[|\*\*بخش)/.test(t)) return false;
  return true;
});
const introHtml = parseSection(introFiltered, -1).html;
/* point the repo-relative secure-server-setup.sh link at its GitHub source */
let _h = introHtml;
for (let si = 0; si < sections.length; si++){
  sections[si].html = sections[si].html.replace(/href="secure-server-setup\.sh"/g,
    'href="https://raw.githubusercontent.com/amhasani2a/linuxfullroadmap/main/secure-server-setup.sh"');
}

/* ---------------- SVG diagrams ---------------- */
const ARW = '<defs><marker id="arw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#45547a"/></marker></defs>';

const D1 = `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="لایه‌های سیستم">
${ARW}
<rect class="dg-box" x="70" y="18" width="500" height="86"/>
<text class="dg-tb" x="320" y="46" text-anchor="middle">برنامه‌های شما (user space)</text>
<text class="dg-mono" x="320" y="80" text-anchor="middle">bash · nginx · python · ls · vim</text>
<line class="dg-arr" x1="320" y1="104" x2="320" y2="138"/>
<text class="dg-t" x="336" y="128" font-size="11">فراخوانی‌های سیستم (open/read/write/fork…)</text>
<rect class="dg-box-hi" x="70" y="142" width="500" height="98"/>
<text class="dg-tb" x="320" y="170" text-anchor="middle">هسته لینوکس (kernel space)</text>
<text class="dg-t" x="320" y="206" text-anchor="middle">فرآیندها · حافظه · سیستم‌فایل · شبکه · درایورها</text>
<line class="dg-arr" x1="320" y1="240" x2="320" y2="274"/>
<text class="dg-t" x="336" y="264" font-size="11">درایورهای سخت‌افزار</text>
<rect class="dg-box" x="70" y="278" width="500" height="70"/>
<text class="dg-t" x="320" y="316" text-anchor="middle" font-size="13.5">سخت‌افزار: پردازنده · رم · دیسک‌ها · شبکه</text>
</svg>`;

const D2 = `<svg viewBox="0 0 880 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="درخت سیستم فایل">
${ARW}
<rect class="dg-box-hi" x="390" y="14" width="100" height="44"/>
<text class="dg-tb" x="440" y="41" text-anchor="middle" font-size="16">/</text>
<g font-size="11">
<line class="dg-arr" x1="440" y1="58" x2="125" y2="108"/>
<line class="dg-arr" x1="440" y1="58" x2="315" y2="108"/>
<line class="dg-arr" x1="440" y1="58" x2="440" y2="108"/>
<line class="dg-arr" x1="440" y1="58" x2="565" y2="108"/>
<line class="dg-arr" x1="440" y1="58" x2="125" y2="238"/>
<line class="dg-arr" x1="440" y1="58" x2="315" y2="238"/>
<line class="dg-arr" x1="440" y1="58" x2="440" y2="238"/>
<line class="dg-arr" x1="440" y1="58" x2="565" y2="238"/>
</g>
<rect class="dg-box" x="40" y="110" width="170" height="54"/>
<text class="dg-tb" x="125" y="134" text-anchor="middle">bin, usr/bin</text>
<text class="dg-td" x="125" y="152" text-anchor="middle">برنامه‌ها</text>
<rect class="dg-box" x="230" y="110" width="170" height="54"/>
<text class="dg-tb" x="315" y="134" text-anchor="middle">etc</text>
<text class="dg-td" x="315" y="152" text-anchor="middle">فایل‌های پیکربندی (متنی)</text>
<rect class="dg-box" x="420" y="110" width="170" height="54"/>
<text class="dg-tb" x="505" y="134" text-anchor="middle">home/</text>
<text class="dg-td" x="505" y="152" text-anchor="middle">~/.bashrc · ~/.ssh/</text>
<rect class="dg-box" x="610" y="110" width="170" height="54"/>
<text class="dg-tb" x="695" y="134" text-anchor="middle">var/</text>
<text class="dg-td" x="695" y="152" text-anchor="middle">لاگ‌ها، کش‌ها، DB (var/log/)</text>
<rect class="dg-box" x="40" y="240" width="170" height="54"/>
<text class="dg-tb" x="125" y="264" text-anchor="middle">tmp/</text>
<text class="dg-td" x="125" y="282" text-anchor="middle">فایل‌های موقت (پس از ریبوت پاک می‌شوند)</text>
<rect class="dg-box" x="230" y="240" width="170" height="54"/>
<text class="dg-tb" x="315" y="264" text-anchor="middle">dev/</text>
<text class="dg-td" x="315" y="282" text-anchor="middle">فایل‌های دستگاه‌ها (دیسک‌ها، ترمینال‌ها)</text>
<rect class="dg-box" x="420" y="240" width="170" height="54"/>
<text class="dg-tb" x="505" y="264" text-anchor="middle">proc/, sys/</text>
<text class="dg-td" x="505" y="282" text-anchor="middle">سیستم‌فایل‌های مجازی (اطلاعات هسته)</text>
<rect class="dg-box" x="610" y="240" width="170" height="54"/>
<text class="dg-tb" x="695" y="264" text-anchor="middle">boot/</text>
<text class="dg-td" x="695" y="282" text-anchor="middle">هسته (vmlinuz) و بوت‌لودر</text>
<text class="dg-td" x="440" y="330" text-anchor="middle">بدون C: یا D: — همه‌چیز زیر ریشه /</text>
<text class="dg-td" x="440" y="352" text-anchor="middle">diagram tree</text>
</svg>`;

const D3 = `<svg viewBox="0 0 880 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="بوت سیستم">
${ARW}
<g font-size="12.5">
<rect class="dg-box" x="20" y="18" width="150" height="54"/><text class="dg-t" x="95" y="48" text-anchor="middle">برق / پاور</text>
<rect class="dg-box" x="200" y="18" width="150" height="54"/><text class="dg-t" x="275" y="48" text-anchor="middle">BIOS / UEFI</text>
<rect class="dg-box" x="380" y="18" width="150" height="54"/><text class="dg-t" x="455" y="48" text-anchor="middle">GRUB</text>
<rect class="dg-box" x="560" y="18" width="150" height="54"/><text class="dg-t" x="635" y="48" text-anchor="middle">هسته + initramfs</text>
<rect class="dg-box" x="740" y="18" width="120" height="54"/><text class="dg-t" x="800" y="48" text-anchor="middle" font-size="11.5">سوار کردن /</text>
<line class="dg-arr" x1="170" y1="45" x2="196" y2="45"/>
<line class="dg-arr" x1="350" y1="45" x2="376" y2="45"/>
<line class="dg-arr" x1="530" y1="45" x2="556" y2="45"/>
<line class="dg-arr" x1="710" y1="45" x2="736" y2="45"/>
</g>
<path class="dg-arr" d="M800 72 L800 118 L95 118 L95 146"/>
<g font-size="12.5">
<rect class="dg-box-hi" x="20" y="150" width="150" height="54"/><text class="dg-tb" x="95" y="180" text-anchor="middle">systemd (PID 1)</text>
<rect class="dg-box" x="250" y="150" width="190" height="54"/><text class="dg-t" x="345" y="172" text-anchor="middle">اجرای سرویس‌ها</text><text class="dg-t" x="345" y="190" text-anchor="middle" font-size="11">بر اساس وابستگی‌ها</text>
<rect class="dg-box" x="520" y="150" width="130" height="54"/><text class="dg-t" x="585" y="180" text-anchor="middle">target</text>
<rect class="dg-box" x="730" y="150" width="130" height="54"/><text class="dg-t" x="795" y="180" text-anchor="middle">ورود</text>
<line class="dg-arr" x1="170" y1="177" x2="246" y2="177"/>
<line class="dg-arr" x1="440" y1="177" x2="516" y2="177"/>
<line class="dg-arr" x1="650" y1="177" x2="726" y2="177"/>
</g>
</svg>`;

const D4 = `<svg viewBox="0 0 640 330" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="چرخه حیات فرآیند">
${ARW}
<rect class="dg-box" x="20" y="20" width="130" height="52"/>
<text class="dg-tb" x="85" y="49" text-anchor="middle">والد</text>
<line class="dg-arr" x1="150" y1="46" x2="192" y2="46"/>
<text class="dg-mono" x="171" y="36" text-anchor="middle">fork()</text>
<rect class="dg-box" x="196" y="20" width="130" height="52"/>
<text class="dg-tb" x="261" y="49" text-anchor="middle">فرزند</text>
<line class="dg-arr" x1="326" y1="46" x2="368" y2="46"/>
<text class="dg-mono" x="347" y="36" text-anchor="middle">execve()</text>
<rect class="dg-box" x="372" y="20" width="150" height="52"/>
<text class="dg-tb" x="447" y="49" text-anchor="middle">برنامه جدید</text>
<line class="dg-arr" x1="447" y1="72" x2="447" y2="104"/>
<text class="dg-mono" x="460" y="96" text-anchor="start">exit(کد خروج)</text>
<rect class="dg-box" x="377" y="108" width="140" height="40"/>
<text class="dg-t" x="447" y="132" text-anchor="middle" font-size="12">پایان فرآیند</text>
<line class="dg-arr" x1="447" y1="148" x2="447" y2="168"/>
<text class="dg-t" x="447" y="188" text-anchor="middle" font-size="12.5">والد زنده است؟</text>
<line class="dg-arr" x1="430" y1="196" x2="255" y2="196"/>
<line class="dg-arr" x1="255" y1="196" x2="255" y2="228"/>
<text class="dg-mono" x="360" y="190" text-anchor="middle">بله</text>
<line class="dg-arr" x1="462" y1="196" x2="540" y2="196"/>
<line class="dg-arr" x1="540" y1="196" x2="540" y2="228"/>
<text class="dg-mono" x="505" y="190" text-anchor="middle">خیر</text>
<rect class="dg-box" x="165" y="232" width="180" height="64"/>
<text class="dg-tb" x="255" y="256" text-anchor="middle">Z (زامبی)</text>
<text class="dg-td" x="255" y="278" text-anchor="middle">منتظر تابع wait والد</text>
<rect class="dg-box-hi" x="450" y="232" width="180" height="64"/>
<text class="dg-tb" x="540" y="256" text-anchor="middle">یتیم</text>
<text class="dg-td" x="540" y="278" text-anchor="middle">تحت سرپرستی PID 1</text>
</svg>`;

const D5 = `<svg viewBox="0 0 880 130" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="لوله">
${ARW}
<g font-size="10.5">
<rect class="dg-box-hi" x="12" y="10" width="130" height="48"/><text class="dg-mono" x="77" y="38" text-anchor="middle">cat access.log</text>
<rect class="dg-box" x="156" y="10" width="130" height="48"/><text class="dg-mono" x="221" y="38" text-anchor="middle">awk '{print $1}'</text>
<rect class="dg-box" x="300" y="10" width="130" height="48"/><text class="dg-mono" x="365" y="38" text-anchor="middle">sort</text>
<rect class="dg-box" x="444" y="10" width="130" height="48"/><text class="dg-mono" x="509" y="38" text-anchor="middle">uniq -c</text>
<rect class="dg-box" x="588" y="10" width="130" height="48"/><text class="dg-mono" x="653" y="38" text-anchor="middle">sort -rn</text>
<rect class="dg-box-hi" x="732" y="10" width="130" height="48"/><text class="dg-mono" x="797" y="38" text-anchor="middle">head</text>
<line class="dg-arr" x1="142" y1="34" x2="152" y2="34"/>
<line class="dg-arr" x1="286" y1="34" x2="296" y2="34"/>
<line class="dg-arr" x1="430" y1="34" x2="440" y2="34"/>
<line class="dg-arr" x1="574" y1="34" x2="584" y2="34"/>
<line class="dg-arr" x1="718" y1="34" x2="728" y2="34"/>
</g>
<g class="dg-td" font-size="11">
<text x="77" y="86" text-anchor="middle">کل لاگ</text>
<text x="221" y="86" text-anchor="middle">فقط IPها</text>
<text x="365" y="86" text-anchor="middle">مرتب‌سازی</text>
<text x="509" y="86" text-anchor="middle">شمارش</text>
<text x="653" y="86" text-anchor="middle">ترتیب نزولی</text>
<text x="797" y="86" text-anchor="middle">۱۰ تای برتر</text>
</g>
<text class="dg-t" x="440" y="118" text-anchor="middle" font-size="11.5">cat access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head</text>
</svg>`;

const D6 = `<svg viewBox="0 0 640 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="مجوزهای دسترسی">
${ARW}
<rect class="dg-box" x="40" y="16" width="60" height="76"/>
<text class="dg-mono" x="70" y="60" text-anchor="middle" font-size="22">-</text>
<rect class="dg-box-hi" x="110" y="16" width="150" height="76"/>
<text class="dg-mono" x="185" y="60" text-anchor="middle" font-size="20">rwx</text>
<rect class="dg-box" x="270" y="16" width="150" height="76"/>
<text class="dg-mono" x="345" y="60" text-anchor="middle" font-size="20">r-x</text>
<rect class="dg-box" x="430" y="16" width="150" height="76"/>
<text class="dg-mono" x="505" y="60" text-anchor="middle" font-size="20">r--</text>
<g class="dg-t" font-size="12.5">
<text x="70" y="116" text-anchor="middle">نوع</text>
<text x="185" y="116" text-anchor="middle">مالک</text>
<text x="345" y="116" text-anchor="middle">گروه</text>
<text x="505" y="116" text-anchor="middle">سایرین</text>
</g>
<g class="dg-td" font-size="11.5">
<text x="185" y="138" text-anchor="middle">7 = دسترسی کامل</text>
<text x="345" y="138" text-anchor="middle">5 = خواندن + اجرا</text>
<text x="505" y="138" text-anchor="middle">4 = فقط خواندنی</text>
<text x="70" y="138" text-anchor="middle">- فایل، d پوشه، l لینک</text>
</g>
<text class="dg-mono" x="320" y="180" text-anchor="middle" font-size="13">r = 4 · w = 2 · x = 1</text>
<line class="dg-arr" x1="320" y1="192" x2="320" y2="220"/>
<rect class="dg-box-hi" x="110" y="226" width="420" height="56"/>
<text class="dg-mono" x="320" y="258" text-anchor="middle" font-size="13.5">chmod 754 file → 7=rwx 5=r-x 4=r--</text>
<g class="dg-td" font-size="11.5">
<text x="320" y="310" text-anchor="middle">755 → برنامه‌ها و پوشه‌ها</text>
<text x="320" y="330" text-anchor="middle">644 → فایل‌های معمولی · 600 → کلیدها و فایل‌های حساس</text>
</g>
</svg>`;

const D7 = `<svg viewBox="0 0 640 330" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="لینک‌های سخت و نمادین">
${ARW}
<text class="dg-tb" x="320" y="24" text-anchor="middle" font-size="13">لینک سخت — ورودی‌های مختلف، اینود یکسان</text>
<rect class="dg-box" x="20" y="44" width="110" height="44"/>
<text class="dg-mono" x="75" y="70" text-anchor="middle">نام۱</text>
<line class="dg-arr" x1="130" y1="66" x2="182" y2="66"/>
<rect class="dg-box-hi" x="186" y="38" width="150" height="56"/>
<text class="dg-mono" x="261" y="62" text-anchor="middle">inode #1234</text>
<text class="dg-td" x="261" y="82" text-anchor="middle" font-size="10">متاداده + موقعیت داده‌ها</text>
<line class="dg-arr" x1="336" y1="66" x2="388" y2="66"/>
<rect class="dg-box" x="392" y="44" width="150" height="44"/>
<text class="dg-t" x="467" y="70" text-anchor="middle" font-size="12.5">داده‌ها روی دیسک</text>
<rect class="dg-box" x="20" y="120" width="110" height="44"/>
<text class="dg-mono" x="75" y="146" text-anchor="middle">نام۲</text>
<line class="dg-arr" x1="130" y1="142" x2="182" y2="86"/>
<text class="dg-td" x="430" y="118" text-anchor="middle" font-size="11">فایل تا وقتی زنده است که یک پیوند داشته باشد</text>
<text class="dg-tb" x="320" y="190" text-anchor="middle" font-size="13">لینک نمادین — فایل کوچکِ حاوی مسیر مقصد</text>
<rect class="dg-box" x="20" y="210" width="110" height="44"/>
<text class="dg-mono" x="75" y="236" text-anchor="middle">symlink</text>
<line class="dg-arr" x1="130" y1="232" x2="182" y2="232"/>
<rect class="dg-box" x="186" y="204" width="200" height="56"/>
<text class="dg-mono" x="286" y="228" text-anchor="middle">inode #5678</text>
<text class="dg-mono" x="286" y="248" text-anchor="middle" font-size="10.5">«مسیر/به/مقصد»</text>
<line class="dg-arr" x1="386" y1="232" x2="436" y2="232" style="stroke-dasharray:6 4"/>
<rect class="dg-box" x="440" y="210" width="150" height="44"/>
<text class="dg-mono" x="515" y="236" text-anchor="middle">نام۱</text>
<text class="dg-td" x="320" y="296" text-anchor="middle" font-size="11">با حذف فایل مقصد، لینک نمادین خراب می‌شود — برخلاف لینک سخت</text>
</svg>`;

/* ---------------- assemble ---------------- */
const DATA = {
  groups: GROUPS.filter(g => sections.some(s => s.group === g)),
  sections: sections.map((s, idx) => ({
    i: idx, key: s.key, title: s.title, group: s.group, emoji: s.emoji,
    numBadge: s.numBadge, html: s.html, plain: s.plain, commands: s.commands
  })),
  glossary, cheatsheet, cards, commandCount, introHtml
};

let html = tpl;
html = html.replace('__APP_DATA__', JSON.stringify(DATA).replace(/</g,'\\u003c'));
const S = {D1,D2,D3,D4,D5,D6,D7};
Object.keys(S).forEach(k=>{ html = html.replace("'__"+k+"__'", JSON.stringify(S[k])); });

fs.writeFileSync('linux-roadmap-fa.html', html);
fs.writeFileSync('index.html', html); // GitHub Pages needs index.html
// copy PWA assets alongside the HTML
const pwaAssets = ['linux-roadmap-sw.js','linux-roadmap-manifest.json','linux-roadmap-icon.svg'];
pwaAssets.forEach(f => { try { fs.copyFileSync(f, f); } catch(_){} });
console.log('OK — sections:', sections.length, '| commands:', commandCount, '| glossary:', glossary.length, '| cheatsheet:', cheatsheet.length, '| size:', (html.length/1024).toFixed(0)+'KB');
