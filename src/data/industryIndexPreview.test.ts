import { afterEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_INDEX_STORAGE_KEY } from './customIndexStorage';
import {
  buildIndustryIndexPreview,
  consumeIndustryIndexPreview,
  loadIndustryIndexPreview,
  saveIndustryIndexPreview,
  toIndustryIndexPreviewHash,
} from './industryIndexPreview';
import type { CanvasNode } from './industryCanvas';

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    values,
  };
}

const branch: CanvasNode = {
  id: 'root', name: '新能源',
  stocks: [
    { code: '300750', name: '宁德时代', industry: '电池', change: 1, marketCap: 100, pe: 20 },
    { code: '', name: '空代码', change: null, marketCap: null, pe: null },
  ],
  children: [{
    id: 'child', name: '材料',
    stocks: [
      { code: '300750', name: '重复公司', change: 2, marketCap: 200, pe: 21 },
      { code: 'abc', name: '无效代码', change: null, marketCap: null, pe: null },
      { code: '510300', name: '沪深300ETF', industry: 'ETF', change: 0, marketCap: null, pe: null },
    ],
    children: [],
  }],
};

describe('industry index preview', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('recursively collects, validates, and deduplicates branch securities', () => {
    const preview = buildIndustryIndexPreview(branch, 'equal', ['新能源', '材料'], () => 'preview id');
    expect(preview.index.components).toEqual([
      { code: '300750', name: '宁德时代', industry: '电池', marketCap: 100 },
      { code: '510300', name: '沪深300ETF', industry: 'ETF', marketCap: undefined },
    ]);
    expect(preview.index).toMatchObject({ id: 'preview id', name: '新能源 指数', tags: ['行业预览'], weightMethod: 'equal', rebalanceFrequency: 'monthly', baseValue: 100 });
    expect(preview).toMatchObject({ sourcePath: ['新能源', '材料'], totalCompanyCount: 2 });
  });

  it('normalizes codes before deduplicating securities', () => {
    const node: CanvasNode = {
      id: 'trimmed', name: '规范化', children: [],
      stocks: [
        { code: '300750 ', name: '带空格', change: null, marketCap: null, pe: null },
        { code: '300750', name: '无空格', change: null, marketCap: null, pe: null },
      ],
    };
    expect(buildIndustryIndexPreview(node, 'equal', ['规范化'], () => 'trimmed').index.components).toEqual([
      expect.objectContaining({ code: '300750', name: '带空格' }),
    ]);
  });

  it('stores previews by id without touching custom-index local storage', () => {
    const session = fakeStorage();
    const local = fakeStorage();
    const first = buildIndustryIndexPreview(branch, 'equal', ['新能源'], () => 'same');
    const replacement = { ...first, totalCompanyCount: 99 };
    saveIndustryIndexPreview(first, session);
    saveIndustryIndexPreview(replacement, session);
    expect(loadIndustryIndexPreview('same', session)?.totalCompanyCount).toBe(99);
    expect(local.getItem(CUSTOM_INDEX_STORAGE_KEY)).toBeNull();
    expect(session.getItem(CUSTOM_INDEX_STORAGE_KEY)).toBeNull();
  });

  it('consumes a saved preview so refresh cannot load it again', () => {
    const session = fakeStorage();
    const preview = buildIndustryIndexPreview(branch, 'equal', ['行业'], () => 'consume-me');
    saveIndustryIndexPreview(preview, session);
    expect(consumeIndustryIndexPreview('consume-me', session)).toEqual(preview);
    expect(loadIndustryIndexPreview('consume-me', session)).toBeNull();
  });

  it('returns null for missing or corrupt preview JSON', () => {
    const storage = fakeStorage();
    expect(loadIndustryIndexPreview('missing', storage)).toBeNull();
    storage.setItem('industry-index-preview:bad', '{');
    expect(loadIndustryIndexPreview('bad', storage)).toBeNull();
  });

  it.each([
    ['missing components', (value: Record<string, any>) => { delete value.index.components; }],
    ['non-string source path', (value: Record<string, any>) => { value.sourcePath = ['行业', 1]; }],
    ['negative count', (value: Record<string, any>) => { value.totalCompanyCount = -1; }],
    ['invalid weight method', (value: Record<string, any>) => { value.index.weightMethod = 'random'; }],
    ['invalid component', (value: Record<string, any>) => { value.index.components = [{ code: '300750', name: 3, industry: '电池' }]; }],
    ['invalid optional index field', (value: Record<string, any>) => { value.index.baseDate = 20260101; }],
  ])('returns null for valid JSON with %s', (_label, mutate) => {
    const storage = fakeStorage();
    const preview = buildIndustryIndexPreview(branch, 'equal', ['新能源'], () => 'malformed');
    const value = JSON.parse(JSON.stringify(preview)) as Record<string, any>;
    mutate(value);
    storage.setItem('industry-index-preview:malformed', JSON.stringify(value));
    expect(loadIndustryIndexPreview('malformed', storage)).toBeNull();
  });

  it('rejects a non-finite company count encoded as valid JSON', () => {
    const storage = fakeStorage();
    const preview = buildIndustryIndexPreview(branch, 'equal', ['新能源'], () => 'infinite');
    const raw = JSON.stringify(preview).replace(`"totalCompanyCount":${preview.totalCompanyCount}`, '"totalCompanyCount":1e400');
    storage.setItem('industry-index-preview:infinite', raw);
    expect(loadIndustryIndexPreview('infinite', storage)).toBeNull();
  });

  it('uses window sessionStorage by default without touching localStorage', () => {
    const sessionStorage = fakeStorage();
    const localStorage = fakeStorage();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    const preview = buildIndustryIndexPreview(branch, 'equal', ['新能源'], () => 'default-session');
    saveIndustryIndexPreview(preview);
    expect(loadIndustryIndexPreview('default-session')).toEqual(preview);
    expect(sessionStorage.getItem('industry-index-preview:default-session')).not.toBeNull();
    expect(localStorage.values.size).toBe(0);
  });

  it('encodes preview ids in the toolbox hash', () => {
    expect(toIndustryIndexPreviewHash('预览 / 1')).toBe('toolbox?tool=index&preview=%E9%A2%84%E8%A7%88%20%2F%201');
  });
});
