const fs = require('fs');
const path =
  process.argv[2] || 'src/app/components/commission/dashboard-commission/dashboard-commission.html';
const html = fs.readFileSync(path, 'utf8');
const voidTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
const stack = [];
const regex = /<\/?[a-zA-Z][^>]*?>/gs;
let match;
const lineOf = (idx) => html.slice(0, idx).split(/\r?\n/).length;
while ((match = regex.exec(html))) {
  const tag = match[0];
  const nameMatch = tag.match(/^<\/?\s*([a-zA-Z0-9-]+)/);
  if (!nameMatch) continue;
  const name = nameMatch[1].toLowerCase();
  const selfClosing = tag.endsWith('/>') || voidTags.has(name) || tag.startsWith('<!--');
  const closing = tag.startsWith('</');
  const line = lineOf(match.index);
  if (closing) {
    const last = stack.pop();
    if (!last || last.name !== name) {
      console.log(
        'MISMATCH_CLOSE',
        name,
        'line',
        line,
        'popped',
        last ? last.name + '@' + last.line : null,
      );
      console.log(
        'stack tail:',
        stack
          .slice(-12)
          .map((x) => `${x.name}@${x.line}`)
          .join(' > '),
      );
    }
  } else if (!selfClosing) {
    stack.push({ name, line });
  }
}
if (stack.length)
  console.log(
    'UNMATCHED OPEN TAGS (tail):',
    stack
      .slice(-12)
      .map((x) => `${x.name}@${x.line}`)
      .join(' > '),
  );
else console.log('No unmatched open tags detected.');
