import fs from 'node:fs';
import crypto from 'node:crypto';

const API = 'https://api.appstoreconnect.apple.com';
const keyId = 'GL8UDBLWYF';
const issuerId = 'ff871bef-0835-4aca-81d6-709743a64d44';
const keyPath = `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`;
const appId = '6758918094';
const targetVersion = '1.6';

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
  if (res.status >= 400) console.error(`Error ${res.status}:`, text);
  return text ? JSON.parse(text) : null;
}

async function run() {
  const versions = await api('GET', `/v1/apps/${appId}/appStoreVersions`);
  const existingVersion = versions.data.find(v => v.attributes.versionString === targetVersion);
  console.log('App Store Version:', existingVersion ? existingVersion.attributes.appStoreState : 'Not Found');
  
  if (existingVersion) {
    const versionId = existingVersion.id;
    console.log('Version ID:', versionId);
    
    // check attached build
    const buildLink = existingVersion.relationships.build.links.related;
    const buildInfo = await api('GET', buildLink.replace(API, ''));
    if (buildInfo && buildInfo.data) {
        console.log('Attached Build ID:', buildInfo.data.id, 'Version:', buildInfo.data.attributes.version);
    } else {
        console.log('No build attached.');
    }

    // check submissions
    const submissionsResponse = await api('GET', `/v1/apps/${appId}/reviewSubmissions`);
    if (submissionsResponse && submissionsResponse.data) {
       for (const sub of submissionsResponse.data) {
          console.log(`Submission ID: ${sub.id}, State: ${sub.attributes.state}`);
       }
    }
  }
}
run();
