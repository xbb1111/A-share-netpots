import { describe, expect, it } from 'vitest';
import { INDUSTRY_CHAINS, findChainNode, getChainBoardMatches } from './industryTaxonomy';

describe('industry taxonomy', () => {
  it('provides a set of popular chains for the quick switcher', () => {
    expect(INDUSTRY_CHAINS.map((item) => item.id)).toEqual(expect.arrayContaining(['new-energy-vehicle', 'ai-compute', 'semiconductor', 'robotics', 'photovoltaic', 'innovative-drug']));
  });

  it('models the new-energy vehicle chain in stage order', () => {
    const chain = INDUSTRY_CHAINS.find((item) => item.id === 'new-energy-vehicle');

    expect(chain?.stages.map((stage) => stage.id)).toEqual(['upstream', 'midstream', 'downstream']);
    expect(chain?.stages.every((stage) => stage.nodes.length > 0)).toBe(true);
    expect(findChainNode('new-energy-vehicle', 'power-battery')?.matchKeywords).toContain('动力电池');
  });

  it('matches live boards to a selected supply-chain node', () => {
    const matches = getChainBoardMatches('new-energy-vehicle', 'power-battery', [
      { name: '电池', code: 'BK1033' },
      { name: '动力电池回收', code: 'BK0992' },
      { name: '整车', code: 'BK0481' },
    ]);

    expect(matches.map((item) => item.code)).toEqual(['BK1033', 'BK0992']);
  });

  it('uses verified board codes when a supply-chain label does not exactly match the market taxonomy', () => {
    const matches = getChainBoardMatches('new-energy-vehicle', 'thermal-management', [
      { name: '制冷空调设备', code: 'BK1400' },
    ]);

    expect(matches.map((item) => item.code)).toEqual(['BK1400']);
  });
});
