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
  if (method === 'DELETE' && res.status === 204) return null;
  const text = await res.text();
  if (res.status >= 400) throw new Error(`Error ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('1. Finding App Store Version 1.6...');
  const versions = await api('GET', `/v1/apps/${appId}/appStoreVersions`);
  const version = versions.data.find(v => v.attributes.versionString === targetVersion);
  if (!version) throw new Error('Version 1.6 not found.');
  const versionId = version.id;
  console.log('Version ID:', versionId, 'State:', version.attributes.appStoreState);

  console.log('\n2. Checking Review Submissions...');
  const submissionsResponse = await api('GET', `/v1/apps/${appId}/reviewSubmissions`);
  const activeSubmission = submissionsResponse.data.find(s => ['WAITING_FOR_REVIEW', 'READY_FOR_REVIEW'].includes(s.attributes.state));
  if (activeSubmission) {
    console.log(`Canceling existing submission ${activeSubmission.id} (State: ${activeSubmission.attributes.state})...`);
    await api('PATCH', `/v1/reviewSubmissions/${activeSubmission.id}`, {
      data: {
        type: 'reviewSubmissions',
        id: activeSubmission.id,
        attributes: { canceled: true }
      }
    });
    console.log('Submission canceled.');
  }

  console.log('\n3. Waiting for Build 2 to finish processing on App Store Connect...');
  let newBuildId = null;
  while (!newBuildId) {
    const builds = await api('GET', `/v1/builds?filter[app]=${appId}&include=preReleaseVersion&limit=20&sort=-uploadedDate`);
    const targetBuild = builds.data.find(b => {
      const prvId = b.relationships?.preReleaseVersion?.data?.id;
      const prv = (builds.included || []).find(i => i.type === 'preReleaseVersions' && i.id === prvId);
      return prv && prv.attributes.version === targetVersion && b.attributes.version === '2';
    });

    if (targetBuild) {
      if (targetBuild.attributes.processingState === 'VALID') {
        newBuildId = targetBuild.id;
        console.log(`Found VALID Build 2. Build ID: ${newBuildId}`);
      } else if (targetBuild.attributes.processingState === 'FAILED') {
        throw new Error(`Build 2 processing FAILED!`);
      } else {
        console.log(`Build 2 found but processing state is ${targetBuild.attributes.processingState}. Waiting 15s...`);
        await sleep(15000);
      }
    } else {
      console.log(`Build 2 not found yet. Waiting 15s...`);
      await sleep(15000);
    }
  }

  console.log('\n4. Declaring Export Compliance for Build 2...');
  await api('PATCH', `/v1/builds/${newBuildId}`, {
    data: {
      type: 'builds',
      id: newBuildId,
      attributes: { usesNonExemptEncryption: false }
    }
  });

  console.log('\n4.1. Detaching old build and attaching Build 2...');
  await api('PATCH', `/v1/appStoreVersions/${versionId}`, {
    data: {
      type: 'appStoreVersions',
      id: versionId,
      relationships: {
        build: {
          data: { type: 'builds', id: newBuildId }
        }
      }
    }
  });
  console.log('Build 2 attached successfully.');

  console.log('\n5. Re-submitting for review...');
  const createSubRes = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      relationships: { app: { data: { type: 'apps', id: appId } } }
    }
  });
  const subId = createSubRes.data.id;
  console.log('Created new submission:', subId);

  await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } }
      }
    }
  });
  console.log('Added App Store Version to submission.');

  const submitRes = await api('PATCH', `/v1/reviewSubmissions/${subId}`, {
    data: {
      type: 'reviewSubmissions',
      id: subId,
      attributes: { submitted: true }
    }
  });
  console.log('\n🎉 NEW BUILD SUCCESSFULLY SUBMITTED TO APP STORE FOR REVIEW!');
  console.log('Submission State:', submitRes.data.attributes.state);
}

run().catch(console.error);
