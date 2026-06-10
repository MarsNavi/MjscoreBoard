import fs from 'node:fs';
import crypto from 'node:crypto';

const API = 'https://api.appstoreconnect.apple.com';
const keyId = 'GL8UDBLWYF';
const issuerId = 'ff871bef-0835-4aca-81d6-709743a64d44';
const keyPath = `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`;
const appId = '6758918094';
const privateKey = fs.readFileSync(keyPath, 'utf8');
const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

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
  if (res.status >= 400) throw new Error(`${method} ${path} => ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

async function uploadFile(url, buffer) {
  const res = await fetch(url, {
    method: 'PUT',
    body: buffer,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
}

async function run() {
  const versions = await api('GET', `/v1/apps/${appId}/appStoreVersions?filter[versionString]=1.7.2`);
  const versionId = versions.data[0].id;
  const versionLocsRes = await api('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  
  for (const loc of versionLocsRes.data) {
    const locale = loc.attributes.locale;
    if (locale !== 'en-US' && locale !== 'ja') continue;
    
    console.log(`Processing ${locale}...`);
    
    let setId;
    try {
      const setRes = await api('POST', '/v1/appScreenshotSets', {
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: 'APP_IPHONE_65' },
          relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } }
        }
      });
      setId = setRes.data.id;
    } catch(e) {
      console.log(`Set might already exist for ${locale}, fetching it...`);
      const existingSets = await api('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
      setId = existingSets.data.find(s => s.attributes.screenshotDisplayType === 'APP_IPHONE_65')?.id;
    }

    if (!setId) {
       console.log('Failed to get or create screenshot set!');
       continue;
    }
    
    const filePath = `screenshots/${locale}_1.png`;
    const buffer = fs.readFileSync(filePath);
    
    const shotRes = await api('POST', '/v1/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: { fileSize: buffer.length, fileName: `${locale}_1.png` },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } }
      }
    });
    const shotId = shotRes.data.id;
    
    const uploadUrl = shotRes.data.attributes.uploadOperations[0].url;
    console.log(`Uploading bytes...`);
    await uploadFile(uploadUrl, buffer);
    
    console.log(`Committing screenshot ${shotId}...`);
    await api('PATCH', `/v1/appScreenshots/${shotId}`, {
      data: { type: 'appScreenshots', id: shotId, attributes: { uploaded: true } }
    });
    
    console.log(`Finished ${locale}. Wait 5s for processing...`);
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('Submitting for review...');
  try {
    const subs = await api('GET', `/v1/apps/${appId}/reviewSubmissions?filter[state]=READY_FOR_REVIEW`);
    let subId;
    if (subs.data.length > 0) {
      subId = subs.data[0].id;
    } else {
      const subRes = await api('POST', '/v1/reviewSubmissions', {
        data: { type: 'reviewSubmissions', relationships: { app: { data: { type: 'apps', id: appId } } } }
      });
      subId = subRes.data.id;
      await api('POST', '/v1/reviewSubmissionItems', {
        data: {
          type: 'reviewSubmissionItems',
          relationships: {
            reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } },
            appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } }
          }
        }
      });
    }

    await api('PATCH', `/v1/reviewSubmissions/${subId}`, {
      data: { type: 'reviewSubmissions', id: subId, attributes: { submitted: true } }
    });
    console.log('🎉 SUCCESSFULLY SUBMITTED!');
  } catch(e) {
    console.log('Error submitting review:', e.message);
  }
}

run().catch(console.error);
