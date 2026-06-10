import fs from 'node:fs';
import crypto from 'node:crypto';

const API = 'https://api.appstoreconnect.apple.com';
const keyId = 'GL8UDBLWYF';
const issuerId = 'ff871bef-0835-4aca-81d6-709743a64d44';
const keyPath = `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`;
const appId = '6758918094';
const versionId = '3a4ff16f-8805-45f3-82d3-4b9f5e98f9c2';

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
  if (res.status >= 400) throw new Error(`${method} ${path} => ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

async function run() {
  // 1. Get localizations
  const locs = await api('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  for (const loc of locs.data) {
    console.log(`Updating whatsNew for locale ${loc.attributes.locale} (ID: ${loc.id})...`);
    await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: {
        type: 'appStoreVersionLocalizations',
        id: loc.id,
        attributes: {
          whatsNew: "- 修复了 iOS 设备连接 ESP32 时可能导致的卡顿和无法绑定问题。\n- 优化了首页和比赛中心的快捷选人逻辑。\n- 移除了选人下拉列表里多余占空间的提示文本。\n- 新增了 ESP32 端等待开局时的已绑定位置显示。"
        }
      }
    });
  }

  console.log('Submitting for review...');
  const subRes = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      relationships: { app: { data: { type: 'apps', id: appId } } }
    }
  });
  const subId = subRes.data.id;

  await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } }
      }
    }
  });

  const finalRes = await api('PATCH', `/v1/reviewSubmissions/${subId}`, {
    data: { type: 'reviewSubmissions', id: subId, attributes: { submitted: true } }
  });

  console.log(`🎉 SUBMITTED TO APP STORE FOR REVIEW!`);
  console.log('State:', finalRes.data.attributes.state);
}

run().catch(console.error);
