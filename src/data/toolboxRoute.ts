export type ToolboxRoute = { tool: 'price' | 'index' | null; previewId: string | null };

export function parseToolboxRoute(hash: string): ToolboxRoute {
  const route = hash.replace(/^#/, '');
  const [page, query = ''] = route.split('?');
  if (page !== 'toolbox') return { tool: null, previewId: null };
  const params = new URLSearchParams(query);
  const tool = params.get('tool');
  return {
    tool: tool === 'price' || tool === 'index' ? tool : null,
    previewId: tool === 'index' ? params.get('preview') : null,
  };
}
