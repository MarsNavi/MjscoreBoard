import sharp from 'sharp';

async function run() {
  const input = 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp';
  const { isProgressive, hasAlpha } = await sharp(input).metadata();
  console.log(`Has alpha: ${hasAlpha}`);
}
run();
