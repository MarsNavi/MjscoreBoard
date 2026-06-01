import sharp from 'sharp';

async function run() {
  const input = 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp';
  const buf0 = await sharp(input).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  const buf1 = await sharp(input).extract({ left: 191, top: 191, width: 1, height: 1 }).raw().toBuffer();
  
  console.log(`(0,0): R: ${buf0[0]}, G: ${buf0[1]}, B: ${buf0[2]}`);
  console.log(`(191,191): R: ${buf1[0]}, G: ${buf1[1]}, B: ${buf1[2]}`);
}
run();
