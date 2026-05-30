import fs from 'node:fs';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const API = 'https://api.appstoreconnect.apple.com';
const keyId = 'GL8UDBLWYF';
const issuerId = 'ff871bef-0835-4aca-81d6-709743a64d44';
const keyPath = `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`;
const appId = '6758918094';
const targetVersion = '1.6'; // Version we want to create

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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  try {
    console.log(`0. Waiting for build ${targetVersion} to finish processing on App Store Connect...`);
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
          console.log(`   Found VALID build for ${targetVersion}. Build ID: ${buildId}`);
        } else if (targetBuild.attributes.processingState === 'FAILED') {
          throw new Error(`Build processing FAILED on App Store Connect!`);
        } else {
          console.log(`   Build found but still processing (state: ${targetBuild.attributes.processingState}). Waiting 30s...`);
          await sleep(30000);
        }
      } else {
        console.log(`   Build ${targetVersion} not found in API yet. Apple is still processing it. Waiting 30s...`);
        await sleep(30000);
      }
    }

    console.log(`1. Checking if App Store Version ${targetVersion} already exists...`);
    const versions = await api('GET', `/v1/apps/${appId}/appStoreVersions`);
    let versionId;
    const existingVersion = versions.data.find(v => v.attributes.versionString === targetVersion);
    if (existingVersion) {
      versionId = existingVersion.id;
      console.log(`   Version ${targetVersion} already exists. ID: ${versionId}`);
    } else {
      console.log(`   Creating new App Store Version ${targetVersion}...`);
      const createVersionPayload = {
        data: {
          type: 'appStoreVersions',
          attributes: {
            versionString: targetVersion,
            platform: 'IOS',
            copyright: '2026 Rui Li',
            reviewType: 'APP_STORE'
          },
          relationships: {
            app: {
              data: {
                type: 'apps',
                id: appId
              }
            }
          }
        }
      };
      const versionResponse = await api('POST', '/v1/appStoreVersions', createVersionPayload);
      versionId = versionResponse.data.id;
      console.log(`   New version created successfully. ID: ${versionId}`);
    }

    console.log(`2. Fetching localizations for version ${targetVersion}...`);
    const localizations = await api('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
    
    let localizationId;
    if (localizations.data && localizations.data.length > 0) {
      localizationId = localizations.data[0].id;
      console.log(`   Found existing Localization ID: ${localizationId}`);
    } else {
      console.log('   No localizations found, creating one...');
      const createLocPayload = {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: {
            locale: 'zh-Hans',
            description: '国标麻将实时计分板是一款面向线下国标麻将比赛的计分工具，适合俱乐部、牌友聚会和训练赛使用。\n\n主要功能：\n- 支持16盘制国标麻将比赛流程\n- 自动处理东南西北座位轮换\n- 支持自摸、点炮、荒庄和裁判判罚记录\n- 实时展示四位选手分数 and 当前局次\n- 保存比赛历史，便于复盘和继续未完成比赛\n- 提供选手战绩统计，包括标准分、和牌、放铳等数据\n- 支持多个牌局档案，适合不同牌友圈独立记分\n- 支持档案分享、导入、合并和本地备份\n- 可连接自研 BLE 计分显示设备，实现一人一屏显示\n\n所有比赛数据保存在本机，本应用不需要注册账号，不上传比赛记录，不包含广告和内购。',
            keywords: '国标麻将,麻将计分,计分板,比赛记录,战绩统计,蓝牙计分,档案分享,本地数据',
            supportUrl: 'https://github.com/MarsNavi/magiscal/blob/main/mjscoreboard-support.md'
          },
          relationships: {
            appStoreVersion: {
              data: {
                type: 'appStoreVersions',
                id: versionId
              }
            }
          }
        }
      };
      const createLocResponse = await api('POST', '/v1/appStoreVersionLocalizations', createLocPayload);
      localizationId = createLocResponse.data.id;
      console.log(`   Localization ID created: ${localizationId}`);
    }

    console.log('3. Updating release.zh-Hans.json...');
    const jsonPath = 'ios/App/AppStoreMetadata/release.zh-Hans.json';
    const metadata = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    metadata.appStoreVersionId = versionId;
    metadata.appStoreVersionLocalizationId = localizationId;
    metadata.buildId = buildId;
    
    metadata.versionLocalization.whatsNew = '更新内容：\n- 手机可作为显示设备：无需硬件计分板，闲置手机即可充当计分显示屏。\n- 智能视角跟随：手机显示屏会自动跟随选手，换位后自动调整视角。\n- 蓝牙架构升级：底层蓝牙引擎全面升级。';
    metadata.version.versionString = targetVersion;
    
    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log('   release.zh-Hans.json updated.');

    console.log('4. Running appstore-connect-fill.mjs to sync metadata and bind build...');
    execSync('ASC_KEY_ID=GL8UDBLWYF ASC_ISSUER_ID=ff871bef-0835-4aca-81d6-709743a64d44 node scripts/appstore-connect-fill.mjs ios/App/AppStoreMetadata/release.zh-Hans.json --apply', { stdio: 'inherit' });
    console.log('   Metadata and build bound successfully.');

    console.log('5. Handling Review Submission...');
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
            app: {
              data: {
                type: 'apps',
                id: appId
              }
            }
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
            reviewSubmission: {
              data: {
                type: 'reviewSubmissions',
                id: reviewSubmissionId
              }
            },
            appStoreVersion: {
              data: {
                type: 'appStoreVersions',
                id: versionId
              }
            }
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
        attributes: {
          submitted: true
        }
      }
    };
    const submitResponse = await api('PATCH', `/v1/reviewSubmissions/${reviewSubmissionId}`, submitPayload);
    console.log(`\n🎉 SUCCESSFULLY SUBMITTED TO APP STORE FOR REVIEW!`);
    console.log(`   Submission ID: ${reviewSubmissionId}`);
    console.log(`   Current State: ${submitResponse.data.attributes.state}`);

  } catch (e) {
    console.error('Error executing version script:', e);
  }
}

run();
