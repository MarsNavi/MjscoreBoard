import sharp from 'sharp';

async function run() {
  const input = 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp';
  
  // Create a 1024x1024 background
  const bg = sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 38, g: 166, b: 154, alpha: 1 } // #26A69A
    }
  });

  // Resize original to 680x680 (safe zone is ~680)
  const resizedIcon = await sharp(input)
    .resize(680, 680, { fit: 'contain', background: {r:0,g:0,b:0,alpha:0} })
    .toBuffer();

  await bg.composite([{ input: resizedIcon }])
    .png()
    .toFile('assets/icon.png');
    
  console.log('Fixed icon generated!');
}

run();
