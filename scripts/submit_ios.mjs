import fs from 'node:fs';
import crypto from 'node:crypto';

const API = 'https://api.appstoreconnect.apple.com';
const keyId = 'GL8UDBLWYF';
const issuerId = 'ff871bef-0835-4aca-81d6-709743a64d44';
const keyPath = `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`;
const appId = '6758918094';
const targetVersion = '1.6.7';

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
  // 0. Cancel any pending review submission
  console.log('0. Checking for pending review submissions...');
  try {
    const subs = await api('GET', `/v1/apps/${appId}/reviewSubmissions?filter[state]=WAITING_FOR_REVIEW,IN_REVIEW,READY_FOR_REVIEW`);
    for (const sub of (subs.data || [])) {
      console.log(`   Cancelling review submission ${sub.id} (state: ${sub.attributes.state})...`);
      try {
        await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, {
          data: { type: 'reviewSubmissions', id: sub.id, attributes: { canceled: true } }
        });
        console.log('   Cancelled.');
      } catch (e) {
        console.log(`   Could not cancel: ${e.message}`);
      }
    }
  } catch (e) {
    console.log(`   No pending submissions or error: ${e.message}`);
  }

  // 1. Create App Store Version 1.6.7
  console.log('\n1. Creating App Store Version 1.6.7...');
  const versions = await api('GET', `/v1/apps/${appId}/appStoreVersions`);
  let versionId;
  const existing = versions.data.find(v => v.attributes.versionString === targetVersion);
  if (existing) {
    versionId = existing.id;
    console.log(`   Version ${targetVersion} already exists. ID: ${versionId}, State: ${existing.attributes.appStoreState}`);
  } else {
    const createRes = await api('POST', '/v1/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: {
          versionString: targetVersion,
          platform: 'IOS',
          copyright: '2026 Rui Li',
          reviewType: 'APP_STORE'
        },
        relationships: {
          app: { data: { type: 'apps', id: appId } }
        }
      }
    });
    versionId = createRes.data.id;
    console.log(`   Created version ${targetVersion}. ID: ${versionId}`);
  }

  // 2. Update localization
  console.log('\n2. Updating version localization...');
  const locRes = await api('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  let locId;
  if (locRes.data && locRes.data.length > 0) {
    locId = locRes.data[0].id;
  } else {
    const newLoc = await api('POST', '/v1/appStoreVersionLocalizations', {
      data: {
        type: 'appStoreVersionLocalizations',
        attributes: {
          locale: 'zh-Hans',
          description: '国标麻将实时计分板是一款面向线下国标麻将比赛的计分工具。',
        },
        relationships: {
          appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } }
        }
      }
    });
    locId = newLoc.data.id;
  }
  await api('PATCH', `/v1/appStoreVersionLocalizations/${locId}`, {
    data: {
      type: 'appStoreVersionLocalizations',
      id: locId,
      attributes: {
        whatsNew: '1.6.7 更新内容：\n- 修复蓝牙后台连接断开问题\n- 修复 Android 14+ 蓝牙权限崩溃问题\n- 完善多语言支持（蓝牙连接、档案管理等页面）\n- 修复计分板模式视角跟随失效的问题\n- 修复蓝牙资源泄漏问题\n- 优化日期显示随语言切换'
      }
    }
  });
  console.log('   Localization updated.');

  // 3. Wait for build to be processed
  console.log('\n3. Waiting for build 1.6.7 to finish processing...');
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
        console.log(`   Processing: ${targetBuild.attributes.processingState}. Waiting 15s...`);
        await sleep(15000);
      }
    } else {
      console.log('   Build not found yet. Waiting 15s...');
      await sleep(15000);
    }
  }

  // 4. Export compliance
  console.log('\n4. Declaring export compliance...');
  try {
    await api('PATCH', `/v1/builds/${buildId}`, {
      data: { type: 'builds', id: buildId, attributes: { usesNonExemptEncryption: false } }
    });
    console.log('   Done.');
  } catch (e) {
    console.log('   Already set, skipping.');
  }

  // 5. Attach build to version
  console.log('\n5. Attaching build to version...');
  await api('PATCH', `/v1/appStoreVersions/${versionId}`, {
    data: {
      type: 'appStoreVersions', id: versionId,
      relationships: { build: { data: { type: 'builds', id: buildId } } }
    }
  });
  console.log('   Build attached.');

  // 6. Submit for review
  console.log('\n6. Submitting for review...');
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

  console.log('\n🎉 v1.6.7 SUBMITTED TO APP STORE FOR REVIEW!');
  console.log('State:', finalRes.data.attributes.state);
}

run().catch(console.error);
