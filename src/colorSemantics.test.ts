import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const styles = readFileSync('src/styles.css', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

describe('market color semantics', () => {
  it('uses red for rising values and green for falling values across UI classes', () => {
    expect(styles).toMatch(/\.positive\s*\{\s*color:\s*var\(--red\);/);
    expect(styles).toMatch(/\.negative\s*\{\s*color:\s*var\(--green\);/);
    expect(styles).toMatch(/\.trend-badge--up\s*\{[^}]*color:\s*var\(--red\);/s);
    expect(styles).toMatch(/\.trend-badge--down\s*\{[^}]*color:\s*var\(--green\);/s);
  });

  it('uses red for up chart marks and green for down chart marks', () => {
    expect(app).toContain("item.trend === 'down' ? '#38b894' : item.trend === 'up' ? '#c7646d'");
    expect(app).toContain("row.close >= row.open ? '#c7646d' : '#38d6b2'");
  });

  it('renders moving averages as subdued dashed auxiliary lines', () => {
    expect(app).toContain('dataKey="ma5"');
    expect(app).toContain('strokeDasharray="8 4"');
    expect(app).toContain('strokeDasharray="5 5"');
    expect(app).toContain('strokeDasharray="3 6"');
    expect(app).toContain('strokeDasharray="10 5 2 5"');
    expect(app).toMatch(/dataKey="ma5"[^>]*strokeOpacity=\{0\.78\}/);
    expect(app).toMatch(/dataKey="ma60"[^>]*strokeOpacity=\{0\.66\}/);
    expect(app).toContain('name="MA5"');
    expect(app).toContain('name="MA60"');
  });
});
