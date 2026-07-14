import { describe, expect, it } from 'vitest';
import { parseToolboxRoute } from './toolboxRoute';

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
});
