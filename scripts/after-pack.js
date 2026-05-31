const { Arch } = require('electron-builder');
const fs = require('node:fs');
const path = require('node:path');

function getUnpackedNodeModulesDir(context) {
  const { appOutDir } = context;
  const { name: platform } = context.packager.platform;
  const { productFilename } = context.packager.appInfo;

  return path.join(
    appOutDir,
    platform === 'mac'
      ? `${productFilename}.app/Contents/Resources/app.asar.unpacked/node_modules`
      : 'resources/app.asar.unpacked/node_modules',
  );
}

function dealNodeModules7ZipBin(context) {
  console.log('  • after packaging clean 7zip-bin-full...');

  const targetDir = path.join(getUnpackedNodeModulesDir(context), '7zip-bin-full');
  if (!fs.existsSync(targetDir)) return;

  const platformName = context.packager.platform.name;
  const keepPlatform = platformName === 'windows' ? 'win' : platformName;

  if (!['linux', 'mac', 'win'].includes(keepPlatform)) return;

  const removeDirs = ['linux', 'mac', 'win']
    .filter((dir) => dir !== keepPlatform)
    .map((dir) => path.join(targetDir, dir));

  if (context.arch !== Arch.universal) {
    const keepArch = {
      [Arch.arm64]: 'arm64',
      [Arch.armv7l]: 'arm',
      [Arch.ia32]: 'ia32',
      [Arch.x64]: 'x64',
    }[context.arch];

    const currentPlatformDir = path.join(targetDir, keepPlatform);

    if (keepArch && fs.existsSync(currentPlatformDir)) {
      removeDirs.push(
        ...fs
          .readdirSync(currentPlatformDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && entry.name !== keepArch)
          .map((entry) => path.join(currentPlatformDir, entry.name)),
      );
    }
  }

  for (const dir of removeDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function dealNodeModulesVlc(context) {
  console.log('  • after packaging clean @zy/vlc...');

  const targetDir = path.join(getUnpackedNodeModulesDir(context), '@zy/vlc');
  if (!fs.existsSync(targetDir)) return;

  const keepEntries = new Set(['lib', 'build', 'package.json']);

  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (keepEntries.has(entry.name)) continue;
    fs.rmSync(path.join(targetDir, entry.name), { recursive: true, force: true });
  }
}

exports.default = async function (context) {
  const arch = context.arch === Arch.arm64 ? 'arm64' : 'x64';
  const platformName = context.packager.platform.name;
  console.log(`  • after packaging clean platform=${platformName} arch=${arch}`);

  const platform = context.packager.platform.name;
  if (platform === 'windows') {
    fs.rmSync(path.join(context.appOutDir, 'LICENSE.electron.txt'), { force: true });
    fs.rmSync(path.join(context.appOutDir, 'LICENSES.chromium.html'), { force: true });
  }

  dealNodeModules7ZipBin(context);
  dealNodeModulesVlc(context);
};
