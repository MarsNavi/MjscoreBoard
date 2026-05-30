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

async function api(method, path, body, ok=[200,201,204]) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${makeToken()}`, ...(body ? {'Content-Type':'application/json'} : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!ok.includes(res.status)) throw new Error(`${method} ${path} ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

async function run() {
  try {
    console.log(`1. Fetching version ID for ${targetVersion}...`);
    const versions = await api('GET', `/v1/apps/${appId}/appStoreVersions`);
    const versionData = versions.data.find(v => v.attributes.versionString === targetVersion);
    if (!versionData) throw new Error(`Version ${targetVersion} not found!`);
    const versionId = versionData.id;
    console.log(`   Found Version ID: ${versionId}`);

    console.log('2. Handling Review Submission...');
    let reviewSubmissionId;
    const submissionsResponse = await api('GET', `/v1/apps/${appId}/reviewSubmissions?filter[state]=READY_FOR_REVIEW`);
    if (submissionsResponse.data && submissionsResponse.data.length > 0) {
      reviewSubmissionId = submissionsResponse.data[0].id;
      console.log(`   Found existing READY_FOR_REVIEW submission ID: ${reviewSubmissionId}`);
    } else {
      console.log('   No existing READY_FOR_REVIEW submission found. Creating one...');
      const createSubmissionPayload = {
        data: {
          type: 'reviewSubmissions',
          relationships: {
            app: { data: { type: 'apps', id: appId } }
          }
        }
      };
      const newSubmission = await api('POST', '/v1/reviewSubmissions', createSubmissionPayload);
      reviewSubmissionId = newSubmission.data.id;
      console.log(`   Review submission created successfully. ID: ${reviewSubmissionId}`);
    }

    console.log('   Checking review submission items...');
    const itemsResponse = await api('GET', `/v1/reviewSubmissions/${reviewSubmissionId}/items`);
    const hasVersion = itemsResponse.data && itemsResponse.data.some(item => 
      item.relationships?.appStoreVersion?.data?.id === versionId
    );

    if (!hasVersion) {
      console.log('   Adding app store version to review submission...');
      const createItemPayload = {
        data: {
          type: 'reviewSubmissionItems',
          relationships: {
            reviewSubmission: { data: { type: 'reviewSubmissions', id: reviewSubmissionId } },
            appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } }
          }
        }
      };
      await api('POST', '/v1/reviewSubmissionItems', createItemPayload);
      console.log('   App Store Version added to review submission.');
    } else {
      console.log('   App Store Version is already in the review submission.');
    }

    console.log('   Submitting review submission to Apple...');
    const submitPayload = {
      data: {
        type: 'reviewSubmissions',
        id: reviewSubmissionId,
        attributes: { submitted: true }
      }
    };
    const submitResponse = await api('PATCH', `/v1/reviewSubmissions/${reviewSubmissionId}`, submitPayload);
    console.log(`\n🎉 SUCCESSFULLY SUBMITTED TO APP STORE FOR REVIEW!`);
    console.log(`   Submission ID: ${reviewSubmissionId}`);
    console.log(`   Current State: ${submitResponse.data.attributes.state}`);

  } catch (e) {
    console.error('Error executing submission script:', e);
  }
}

run();
