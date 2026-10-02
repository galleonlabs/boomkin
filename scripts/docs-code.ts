import type { Tokens } from 'marked';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const labels: Record<string, string> = {bash:'Shell',sh:'Shell',shell:'Shell',json:'JSON',js:'JavaScript',javascript:'JavaScript',ts:'TypeScript',typescript:'TypeScript',python:'Python',text:'Plain text'};

/** Render literal Markdown code separately from its controls, without trimming it. */
export function createDocsCodeRenderer() {
  let index = 0;
  return ({text, lang}: Tokens.Code) => {
    const language = lang?.trim().split(/\s+/)[0] ?? '';
    const label = labels[language.toLowerCase()] ?? (language || 'Code');
    const description = label === 'Code' ? 'code' : `${label} code`;
    const id = `doc-code-${++index}`;
    const languageClass = /^[\w+-]+$/.test(language) ? ` class="language-${language}"` : '';
    return `<div class="doc-code"><div class="doc-code-header"><span>${escape(label)}</span><button type="button" class="copy doc-code-copy" data-copy-target="${id}" data-copy-exact aria-label="Copy ${escape(description)}"><span data-copy-label>Copy</span></button></div><pre tabindex="0" aria-label="${escape(description)}"><code id="${id}"${languageClass}>${escape(text)}</code></pre></div>\n`;
  };
}
