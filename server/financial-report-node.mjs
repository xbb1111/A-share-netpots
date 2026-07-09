import http from 'node:http';
import { handleFinancialReportRequest } from './financial-report-api.mjs';

const PORT = Number(process.env.FINANCIAL_REPORT_API_PORT ?? 8787);

const server = http.createServer(async (nodeRequest, nodeResponse) => {
  const request = await toWebRequest(nodeRequest);
  const response = await handleFinancialReportRequest(request);

  nodeResponse.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(PORT, () => {
  console.log(`Financial report API listening on http://localhost:${PORT}`);
});

function toWebRequest(nodeRequest) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    nodeRequest.on('data', (chunk) => {
      chunks.push(chunk);
    });
    nodeRequest.on('end', () => {
      const origin = `http://${nodeRequest.headers.host ?? `localhost:${PORT}`}`;
      const url = new URL(nodeRequest.url ?? '/', origin);
      resolve(
        new Request(url, {
          method: nodeRequest.method,
          headers: nodeRequest.headers,
          body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
          duplex: 'half',
        }),
      );
    });
    nodeRequest.on('error', reject);
  });
}
