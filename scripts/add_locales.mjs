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
  if (res.status >= 400) throw new Error(`${method} ${path} => ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

const localesData = {
  'en-US': {
    name: 'MCR Mahjong Scoreboard',
    subtitle: 'For 1998 Official Rules',
    description: 'A professional scoreboard application designed specifically for Mahjong Competition Rules (MCR), officially published by the General Administration of Sport of China in 1998. Features include real-time scoring, multi-device synchronization via Bluetooth, detailed battle stats, and score sharing.',
    keywords: 'mahjong,MCR,competition,scoreboard,tracker,1998 rules,chinese mahjong,calculator',
    whatsNew: 'Version 1.7.1 update:\n- Fixed hanging issues when multiple devices connect simultaneously.\n- Optimized Bluetooth stability and timeout handling.'
  },
  'ja': {
    name: '国標麻雀スコアボード',
    subtitle: '中国公式ルール(1998)専用',
    description: '中国国家体育総局が1998年に制定した「国標麻雀（国際公式ルール）」専用のリアルタイムスコアボードアプリです。Bluetooth通信を利用した複数デバイスの同期、成績統計データの共有など、競技麻雀に最適な機能を備えています。',
    keywords: '麻雀,国標麻雀,中国麻雀,スコアボード,点数計算,国際公式ルール,競技麻雀,MCR',
    whatsNew: 'バージョン 1.7.1 アップデート:\n- 複数デバイスの同時接続時のフリーズを修正\n- Bluetooth接続の安定性とタイムアウト処理を最適化'
  }
};

async function run() {
  console.log('0. Checking and Cancelling Review Submission...');
  try {
    const subs = await api('GET', `/v1/apps/${appId}/reviewSubmissions?filter[state]=WAITING_FOR_REVIEW,IN_REVIEW,READY_FOR_REVIEW`);
    for (const sub of (subs.data || [])) {
      console.log(`   Cancelling review submission ${sub.id}...`);
      await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { canceled: true } } });
      console.log('   Cancelled.');
    }
  } catch (e) {
    console.log(`   No pending submissions or error: ${e.message}`);
  }

  const appInfoRes = await api('GET', `/v1/apps/${appId}/appInfos`);
  const appInfoId = appInfoRes.data[0].id;

  const appInfoLocsRes = await api('GET', `/v1/appInfos/${appInfoId}/appInfoLocalizations`);
  const existingAppInfoLocales = appInfoLocsRes.data.map(l => ({ id: l.id, locale: l.attributes.locale, privacyPolicyUrl: l.attributes.privacyPolicyUrl }));

  const defaultPrivacyPolicy = existingAppInfoLocales.find(l => l.locale === 'zh-Hans')?.privacyPolicyUrl || 'https://example.com/privacy';

  console.log('\n1. Updating App Info Localizations (Name, Subtitle)...');
  for (const [locale, data] of Object.entries(localesData)) {
    const existing = existingAppInfoLocales.find(l => l.locale === locale);
    if (existing) {
      console.log(`   Updating App Info for ${locale}...`);
      await api('PATCH', `/v1/appInfoLocalizations/${existing.id}`, {
        data: { type: 'appInfoLocalizations', id: existing.id, attributes: { name: data.name, subtitle: data.subtitle } }
      });
    } else {
      console.log(`   Creating App Info for ${locale}...`);
      await api('POST', '/v1/appInfoLocalizations', {
        data: {
          type: 'appInfoLocalizations',
          attributes: { locale, name: data.name, subtitle: data.subtitle, privacyPolicyUrl: defaultPrivacyPolicy },
          relationships: { appInfo: { data: { type: 'appInfos', id: appInfoId } } }
        }
      });
    }
  }

  console.log('\n2. Updating App Store Version Localizations (Description, Keywords)...');
  const versions = await api('GET', `/v1/apps/${appId}/appStoreVersions?filter[versionString]=1.7.1`);
  if (!versions.data.length) throw new Error('Version 1.7.1 not found!');
  const versionId = versions.data[0].id;

  const versionLocsRes = await api('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  const existingVersionLocales = versionLocsRes.data.map(l => ({ id: l.id, locale: l.attributes.locale }));

  for (const [locale, data] of Object.entries(localesData)) {
    const existing = existingVersionLocales.find(l => l.locale === locale);
    if (existing) {
      console.log(`   Updating Version Loc for ${locale}...`);
      await api('PATCH', `/v1/appStoreVersionLocalizations/${existing.id}`, {
        data: { type: 'appStoreVersionLocalizations', id: existing.id, attributes: { description: data.description, keywords: data.keywords, whatsNew: data.whatsNew } }
      });
    } else {
      console.log(`   Creating Version Loc for ${locale}...`);
      await api('POST', '/v1/appStoreVersionLocalizations', {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: { locale, description: data.description, keywords: data.keywords, whatsNew: data.whatsNew },
          relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } }
        }
      });
    }
  }

  console.log('\n3. Resubmitting for review...');
  const subRes = await api('POST', '/v1/reviewSubmissions', {
    data: { type: 'reviewSubmissions', relationships: { app: { data: { type: 'apps', id: appId } } } }
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
  await api('PATCH', `/v1/reviewSubmissions/${subId}`, {
    data: { type: 'reviewSubmissions', id: subId, attributes: { submitted: true } }
  });
  console.log('🎉 SUCCESSFULLY RESUBMITTED WITH ALL LOCALIZATIONS!');
}

run().catch(console.error);
