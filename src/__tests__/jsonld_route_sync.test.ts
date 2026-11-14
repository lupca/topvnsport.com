// @vitest-environment jsdom
// Review 14/11 item 6: the server's Product JSON-LD must not outlive its page after in-app navigation.
import { describe, it, expect } from 'vitest';
import { readShellHead, syncHead } from '../utils/productHead';

const ld = () => Array.from(document.head.querySelectorAll('script[type="application/ld+json"]')).map(s => JSON.parse(s.textContent!));

describe('syncHead and JSON-LD', () => {
  it('replaces the product JSON-LD with the new page one, removes it off product pages', () => {
    document.head.innerHTML = '<title>T</title><script type="application/ld+json">{"name":"590"}</script><script type="application/ld+json">{"name":"dup"}</script>';
    const shell = readShellHead(document);
    syncHead(document, null, shell, { name: '551 </script>' });
    expect(ld()).toEqual([{ name: '551 </script>' }]);
    syncHead(document, null, shell);
    expect(ld()).toEqual([]);
    syncHead(document, null, shell, { name: '590' });
    expect(ld()).toEqual([{ name: '590' }]);
  });
});
