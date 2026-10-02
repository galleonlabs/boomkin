import {expect, test} from 'bun:test';
import {marked} from 'marked';
import {createDocsCodeRenderer} from '../scripts/docs-code.ts';

function render(markdown: string) {
  const renderer = new marked.Renderer();
  renderer.code = createDocsCodeRenderer();
  return marked.parse(markdown, {renderer}) as string;
}

test('fenced code preserves indentation, literal entities, quotes and blank lines', () => {
  const html = render('```bash\n  echo "&amp; <tag>"\n\n```');
  expect(html).toContain('>  echo &quot;&amp;amp; &lt;tag&gt;&quot;\n</code>');
  expect(html).toContain('aria-label="Copy Shell code"');
  expect(html).toContain('data-copy-exact');
});

test('each block has its own copy target, including unlabelled blocks', () => {
  const html = render('```json\n{"ready": true}\n```\n\n```\nsecond block\n```');
  expect(html.match(/data-copy-target="doc-code-\d+"/g)).toEqual(['data-copy-target="doc-code-1"','data-copy-target="doc-code-2"']);
  expect(html).toContain('id="doc-code-2">second block</code>');
  expect(html).toContain('aria-label="Copy code"');
});

test('fence labels cannot create HTML or executable attributes', () => {
  const html = render('```<img/onerror=alert(1)>\n<script>alert(1)</script>\n```');
  expect(html).not.toContain('<img');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('class="language-<');
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
});
