import { beforeEach, describe, expect, it } from 'vitest';
import { clearIndustryCompanyCache, fetchIndustryBoards, fetchIndustryCompanies } from './industryService';

describe('industry service', () => {
  beforeEach(() => clearIndustryCompanyCache());

  it('requests the complete board list and keeps board codes', async () => {
    const urls: string[] = [];
    const fetcher = async (url: string) => {
      urls.push(url);
      return {
        ok: true,
        json: async () => ({ data: { diff: [
          { f12: 'BK0475', f14: '银行', f3: 1.2, f62: 300_000_000, f104: 42, f128: '招商银行' },
        ] } }),
      };
    };

    const boards = await fetchIndustryBoards(fetcher);

    expect(urls[0]).toContain('pz=100');
    expect(urls[0]).toContain('pn=1');
    expect(boards[0]).toMatchObject({ code: 'BK0475', name: '银行', capitalFlow: 3, leaderName: '招商银行' });
  });

  it('continues loading board pages until the final partial page', async () => {
    const urls: string[] = [];
    const fetcher = async (url: string) => {
      urls.push(url);
      const page = Number(new URL(url).searchParams.get('pn'));
      const count = page === 1 ? 100 : page === 2 ? 1 : 0;
      return { ok: true, json: async () => ({ data: { diff: Array.from({ length: count }, (_, index) => ({ f12: `BK${page}${index}`, f14: `行业${page}-${index}`, f3: 0, f62: 0 })) } }) };
    };

    const boards = await fetchIndustryBoards(fetcher);

    expect(boards).toHaveLength(101);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('pn=2');
  });

  it('loads and normalizes companies for one board', async () => {
    const fetcher = async (url: string) => ({
      ok: true,
      json: async () => ({ companies: [
        { code: '300750', name: '宁德时代', price: 218.6, change: 2.41, capitalFlow: 9.2, marketCap: 987_000_000_000, industry: '电池' },
      ] }),
    });

    const rows = await fetchIndustryCompanies('BK1030', fetcher);

    expect(rows[0]).toEqual({
      code: '300750', name: '宁德时代', price: 218.6, change: 2.41,
      capitalFlow: 9.2, marketCap: 987_000_000_000, industry: '电池',
    });
  });

  it('caches successful constituent requests by board code', async () => {
    let requests = 0;
    const fetcher = async () => {
      requests += 1;
      return { ok: true, json: async () => ({ companies: [] }) };
    };

    await fetchIndustryCompanies('BK1030', fetcher);
    await fetchIndustryCompanies('BK1030', fetcher);

    expect(requests).toBe(1);
  });
});
