import { describe, expect, it } from 'vitest';
import { parseToolboxRoute, removePreviewFromToolboxHash } from './toolboxRoute';

describe('toolbox route', () => {
  it('parses the requested index preview', () => {
    expect(parseToolboxRoute('#toolbox?tool=index&preview=preview%20id')).toEqual({ tool: 'index', previewId: 'preview id' });
  });

  it('keeps the price tool route distinct from index previews', () => {
    expect(parseToolboxRoute('#toolbox?tool=price&code=300750')).toEqual({ tool: 'price', previewId: null });
  });

  it('ignores tool parameters outside the toolbox page', () => {
    expect(parseToolboxRoute('#industries?tool=index&preview=old')).toEqual({ tool: null, previewId: null });
  });

  it('removes only the encoded preview parameter from a toolbox hash', () => {
    expect(removePreviewFromToolboxHash('#toolbox?tool=index&preview=%E9%A2%84%E8%A7%88%20%2F%201&source=industry'))
      .toBe('toolbox?tool=index&source=industry');
  });

  it('produces a route that cannot reactivate an exited preview', () => {
    const exited = removePreviewFromToolboxHash('#toolbox?tool=index&preview=abandoned&source=industry');
    expect(parseToolboxRoute(`#${exited}`)).toEqual({ tool: 'index', previewId: null });
  });
});
