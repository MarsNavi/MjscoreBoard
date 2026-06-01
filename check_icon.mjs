import sharp from 'sharp';

async function run() {
  const input = 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp';
  const metadata = await sharp(input).metadata();
  console.log(`Width: ${metadata.width}, Height: ${metadata.height}`);
}
run();
