import fs from 'node:fs';
import crypto from 'node:crypto';

const API = 'https://api.appstoreconnect.apple.com';
const keyId = 'GL8UDBLWYF';
const issuerId = 'ff871bef-0835-4aca-81d6-709743a64d44';
const keyPath = `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`;
const appId = '6758918094';

const privateKey = fs.readFileSync(keyPath, 'utf8');
const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  const signingInput = `${b64url({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${b64url({ iss: issuerId, aud: 'appstoreconnect-v1', iat: now, exp: now + 20 * 60 })}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${signingInput}.${signature}`;
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${makeToken()}`, ...(body ? {'Content-Type':'application/json'} : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (res.status >= 400) throw new Error(`Error ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function run() {
  const submissionsResponse = await api('GET', `/v1/apps/${appId}/reviewSubmissions`);
  const activeSubmission = submissionsResponse.data.find(s => ['WAITING_FOR_REVIEW', 'READY_FOR_REVIEW', 'IN_REVIEW'].includes(s.attributes.state));
  if (activeSubmission) {
    console.log(`Canceling existing submission ${activeSubmission.id} (State: ${activeSubmission.attributes.state})...`);
    await api('PATCH', `/v1/reviewSubmissions/${activeSubmission.id}`, {
      data: { type: 'reviewSubmissions', id: activeSubmission.id, attributes: { canceled: true } }
    });
    console.log('Canceled.');
  } else {
    console.log('No active submission found.');
  }
}

run().catch(console.error);
