import fs from 'node:fs';
import crypto from 'node:crypto';

const API = 'https://api.appstoreconnect.apple.com';
const keyId = 'GL8UDBLWYF';
const issuerId = 'ff871bef-0835-4aca-81d6-709743a64d44';
const keyPath = `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`;
const appId = '6758918094';
const targetVersion = '1.7.1';

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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('1. Finding editable version...');
  const versions = await api('GET', `/v1/apps/${appId}/appStoreVersions`);
  let versionId;
  const editableStates = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'];
  let editable = versions.data.find(v => editableStates.includes(v.attributes.appStoreState));
  
  if (editable) {
    versionId = editable.id;
    console.log(`Found editable version ${editable.attributes.versionString} in state ${editable.attributes.appStoreState}. Updating to ${targetVersion}...`);
    if (editable.attributes.versionString !== targetVersion) {
      await api('PATCH', `/v1/appStoreVersions/${versionId}`, {
        data: { type: 'appStoreVersions', id: versionId, attributes: { versionString: targetVersion } }
      });
      console.log('Updated version string.');
    }
  } else {
    console.log(`No editable version found. Creating a new version ${targetVersion}...`);
    const newVersionRes = await api('POST', '/v1/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: { platform: 'IOS', versionString: targetVersion },
        relationships: { app: { data: { type: 'apps', id: appId } } }
      }
    });
    versionId = newVersionRes.data.id;
    console.log('Created new version:', versionId);
  }

  console.log(`2. Waiting for build ${targetVersion} to finish processing (this takes Apple 5-15 mins)...`);
  let buildId = null;
  while (!buildId) {
    const builds = await api('GET', `/v1/builds?filter[app]=${appId}&include=preReleaseVersion&limit=20&sort=-uploadedDate`);
    const targetBuild = builds.data.find(b => {
      const prvId = b.relationships?.preReleaseVersion?.data?.id;
      const prv = (builds.included || []).find(i => i.type === 'preReleaseVersions' && i.id === prvId);
      return prv && prv.attributes.version === targetVersion;
    });

    if (targetBuild) {
      if (targetBuild.attributes.processingState === 'VALID') {
        buildId = targetBuild.id;
        console.log(`   Found VALID build. ID: ${buildId}`);
      } else if (targetBuild.attributes.processingState === 'FAILED') {
        throw new Error('Build processing FAILED!');
      } else {
        console.log(`   Processing: ${targetBuild.attributes.processingState}. Waiting 30s...`);
        await sleep(30000);
      }
    } else {
      console.log('   Build not found yet. Waiting 30s...');
      await sleep(30000);
    }
  }

  console.log('3. Export compliance...');
  try {
    await api('PATCH', `/v1/builds/${buildId}`, {
      data: { type: 'builds', id: buildId, attributes: { usesNonExemptEncryption: false } }
    });
  } catch (e) { }

  console.log('4. Attaching build to version...');
  await api('PATCH', `/v1/appStoreVersions/${versionId}`, {
    data: {
      type: 'appStoreVersions', id: versionId,
      relationships: { build: { data: { type: 'builds', id: buildId } } }
    }
  });

  console.log('5. Submitting for review...');
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

  console.log(`🎉 ${targetVersion} SUBMITTED TO APP STORE FOR REVIEW!`);
  console.log('State:', finalRes.data.attributes.state);
}

run().catch(console.error);
