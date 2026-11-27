const endpoint = 'https://a-share-financial-report-api.2561340168.workers.dev/api/snapshot-refresh/report';
const identityUrl = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
identityUrl.searchParams.set('audience', endpoint);
const identity = await fetch(identityUrl, {
  headers: { Authorization: 'Bearer ' + process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN },
  signal: AbortSignal.timeout(15_000),
});
if (!identity.ok) throw new Error('Unable to get workflow identity: HTTP ' + identity.status);
const { value: token } = await identity.json();
const status = process.argv[2];
for (let attempt = 1; attempt <= 3; attempt++) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: process.env.REFRESH_ID, status }),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.ok) break;
  if (attempt === 3) throw new Error('Update status callback: HTTP ' + response.status);
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
