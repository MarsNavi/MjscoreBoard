import crypto from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.appstoreconnect.apple.com';
const metadataPath = path.resolve(process.argv[2] || 'ios/App/AppStoreMetadata/release.zh-Hans.json');
const shouldApply = process.argv.includes('--apply');

const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const privateKeyPath = process.env.ASC_PRIVATE_KEY_PATH
  || (keyId ? path.join(process.env.HOME || '', `.appstoreconnect/private_keys/AuthKey_${keyId}.p8`) : '');

if (!keyId || !issuerId || !privateKeyPath) {
  console.error('Missing ASC_KEY_ID, ASC_ISSUER_ID, or ASC_PRIVATE_KEY_PATH.');
  process.exit(1);
}

const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
const privateKey = await readFile(privateKeyPath, 'utf8');

const b64url = (value) => Buffer
  .from(typeof value === 'string' ? value : JSON.stringify(value))
  .toString('base64url');

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = {
    iss: issuerId,
    aud: 'appstoreconnect-v1',
    iat: now,
    exp: now + 20 * 60,
  };
  const signingInput = `${b64url(header)}.${b64url(payload)}`;
  const signature = crypto
    .sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  return `${signingInput}.${signature}`;
}

async function api(method, urlPath, body, okStatuses = [200, 201, 204, 404]) {
  const response = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${makeToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!okStatuses.includes(response.status)) {
    throw new Error(`${method} ${urlPath} failed: ${response.status}\n${text}`);
  }
  return { status: response.status, json };
}

function resource(type, id, attributes, relationships) {
  return {
    data: {
      type,
      ...(id ? { id } : {}),
      ...(attributes ? { attributes } : {}),
      ...(relationships ? { relationships } : {}),
    },
  };
}

async function update(pathLabel, method, urlPath, payload, okStatuses) {
  console.log(`- ${pathLabel}`);
  if (!shouldApply) return;
  await api(method, urlPath, payload, okStatuses);
}

async function deleteExistingScreenshotSets() {
  const { json } = await api(
    'GET',
    `/v1/appStoreVersionLocalizations/${metadata.appStoreVersionLocalizationId}/appScreenshotSets?include=appScreenshots&limit=50&limit[appScreenshots]=50`,
  );

  const screenshotsBySet = new Map();
  for (const screenshot of json.included || []) {
    if (screenshot.type !== 'appScreenshots') continue;
    const setId = screenshot.relationships?.appScreenshotSet?.data?.id;
    if (!setId) continue;
    if (!screenshotsBySet.has(setId)) screenshotsBySet.set(setId, []);
    screenshotsBySet.get(setId).push(screenshot.id);
  }

  for (const set of json.data || []) {
    if (set.attributes?.screenshotDisplayType !== metadata.screenshotDisplayType) continue;
    console.log(`- 删除旧截图集 ${metadata.screenshotDisplayType}: ${set.id}`);
    if (!shouldApply) continue;
    for (const screenshotId of screenshotsBySet.get(set.id) || []) {
      await api('DELETE', `/v1/appScreenshots/${screenshotId}`, null, [204, 404]);
    }
    await api('DELETE', `/v1/appScreenshotSets/${set.id}`, null, [204, 404]);
  }
}

async function uploadScreenshots() {
  console.log(`- 创建截图集 ${metadata.screenshotDisplayType}`);
  if (!shouldApply) return;

  const createSet = await api('POST', '/v1/appScreenshotSets', resource(
    'appScreenshotSets',
    null,
    { screenshotDisplayType: metadata.screenshotDisplayType },
    {
      appStoreVersionLocalization: {
        data: {
          type: 'appStoreVersionLocalizations',
          id: metadata.appStoreVersionLocalizationId,
        },
      },
    },
  ));
  const setId = createSet.json.data.id;

  for (const screenshotPath of metadata.screenshots) {
    const absolutePath = path.resolve(screenshotPath);
    const file = await readFile(absolutePath);
    const fileInfo = await stat(absolutePath);
    const fileName = path.basename(absolutePath);
    console.log(`- 上传截图 ${fileName}`);

    const reservation = await api('POST', '/v1/appScreenshots', resource(
      'appScreenshots',
      null,
      { fileName, fileSize: fileInfo.size },
      {
        appScreenshotSet: {
          data: {
            type: 'appScreenshotSets',
            id: setId,
          },
        },
      },
    ));

    const screenshotId = reservation.json.data.id;
    const operations = reservation.json.data.attributes.uploadOperations || [];
    for (const operation of operations) {
      const chunk = file.subarray(operation.offset, operation.offset + operation.length);
      const headers = Object.fromEntries(
        (operation.requestHeaders || []).map((header) => [header.name, header.value]),
      );
      const upload = await fetch(operation.url, {
        method: operation.method,
        headers,
        body: chunk,
      });
      if (!upload.ok) {
        throw new Error(`Screenshot part upload failed: ${upload.status} ${await upload.text()}`);
      }
    }

    const checksum = crypto.createHash('md5').update(file).digest('hex');
    await api('PATCH', `/v1/appScreenshots/${screenshotId}`, resource(
      'appScreenshots',
      screenshotId,
      { uploaded: true, sourceFileChecksum: checksum },
    ));

    await waitForScreenshot(screenshotId, fileName);
  }
}

async function waitForScreenshot(screenshotId, fileName) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const { json } = await api(
      'GET',
      `/v1/appScreenshots/${screenshotId}?fields[appScreenshots]=assetDeliveryState,fileName`,
    );
    const state = json.data.attributes.assetDeliveryState;
    const stateValue = typeof state === 'string' ? state : state?.state;
    if (stateValue === 'COMPLETE') {
      console.log(`  完成 ${fileName}`);
      return;
    }
    if (stateValue === 'FAILED') {
      throw new Error(`Screenshot processing failed: ${fileName}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Timed out while processing screenshot: ${fileName}`);
}

async function upsertReviewDetail() {
  const relationship = {
    appStoreVersion: {
      data: {
        type: 'appStoreVersions',
        id: metadata.appStoreVersionId,
      },
    },
  };

  const existing = await api(
    'GET',
    `/v1/appStoreVersions/${metadata.appStoreVersionId}/appStoreReviewDetail`,
    null,
    [200, 404],
  );

  if (existing.status === 404 || !existing.json?.data) {
    await update(
      '创建审核联系人和测试说明',
      'POST',
      '/v1/appStoreReviewDetails',
      resource('appStoreReviewDetails', null, metadata.reviewDetail, relationship),
      [201],
    );
    return;
  }

  await update(
    '更新审核联系人和测试说明',
    'PATCH',
    `/v1/appStoreReviewDetails/${existing.json.data.id}`,
    resource('appStoreReviewDetails', existing.json.data.id, metadata.reviewDetail),
  );
}

console.log(`App Store Connect release metadata: ${metadataPath}`);
console.log(shouldApply ? '模式：写入 App Store Connect' : '模式：预览，不写入');
console.log(`目标 App: ${metadata.appInfoLocalization.name} (${metadata.bundleId})`);
console.log(`Build: ${metadata.buildId}`);
console.log(`截图数量: ${metadata.screenshots.length}`);

await update(
  '更新应用名称副标题和隐私政策 URL',
  'PATCH',
  `/v1/appInfoLocalizations/${metadata.appInfoLocalizationId}`,
  resource('appInfoLocalizations', metadata.appInfoLocalizationId, metadata.appInfoLocalization),
);

await update(
  '设置主分类为 Utilities',
  'PATCH',
  `/v1/appInfos/${metadata.appInfoId}/relationships/primaryCategory`,
  { data: { type: 'appCategories', id: metadata.primaryCategoryId } },
);

await update(
  '填写年龄分级声明',
  'PATCH',
  `/v1/ageRatingDeclarations/${metadata.ageRatingDeclarationId}`,
  resource('ageRatingDeclarations', metadata.ageRatingDeclarationId, metadata.ageRating),
);

await update(
  '更新版本发布属性',
  'PATCH',
  `/v1/appStoreVersions/${metadata.appStoreVersionId}`,
  resource('appStoreVersions', metadata.appStoreVersionId, metadata.version),
);

await update(
  '更新中文商店文案',
  'PATCH',
  `/v1/appStoreVersionLocalizations/${metadata.appStoreVersionLocalizationId}`,
  resource('appStoreVersionLocalizations', metadata.appStoreVersionLocalizationId, metadata.versionLocalization),
);

await update(
  '声明 build 不使用非豁免加密',
  'PATCH',
  `/v1/builds/${metadata.buildId}`,
  resource('builds', metadata.buildId, { usesNonExemptEncryption: false }),
);

await update(
  `绑定已上传的 build ${metadata.buildId}`,
  'PATCH',
  `/v1/appStoreVersions/${metadata.appStoreVersionId}/relationships/build`,
  { data: { type: 'builds', id: metadata.buildId } },
);

await upsertReviewDetail();
await deleteExistingScreenshotSets();
await uploadScreenshots();

console.log(shouldApply ? '写入完成。' : '预览完成。加 --apply 才会写入。');
