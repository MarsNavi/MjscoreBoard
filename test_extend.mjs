import sharp from 'sharp';

async function run() {
  try {
    const input = 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp';
    await sharp(input)
      .extend({
        top: 416, bottom: 416, left: 416, right: 416,
        extendWith: 'copy' // 'copy' will copy the edge pixels
      })
      .toFile('assets/icon.png');
    console.log('Success copy extend');
  } catch(e) {
    console.error('Failed:', e.message);
  }
}
run();
