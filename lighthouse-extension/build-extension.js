/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const fs = require('fs');

const archiver = require('archiver');
const del = require('del');
const cpy = require('cpy');
const makeDir = require('make-dir');
const bundleBuilder = require('./bundle-builder.js');

const distDir = 'dist';
const manifestVersion = require(`./app/manifest.json`).version;

// list of all consumers we build for (easier to understand which file is used for which)
const CONSUMERS = {
  DEVTOOLS: {
    src: 'devtools-entry.js',
    dist: 'lighthouse-dt-bundle.js',
  },
  EXTENSION: {
    src: 'extension-entry.js',
    dist: 'lighthouse-ext-bundle.js',
  },
  LIGHTRIDER: {
    src: 'lightrider-entry.js',
    dist: 'lighthouse-lr-bundle.js',
  },
};

/**
 * Browserify and minify scripts.
 */
function buildAll() {
  return Object.values(CONSUMERS).map(consumer => {
    const inFile = `app/src/${consumer.src}`;
    const outFile = `dist/scripts/${consumer.dist}`;
    return bundleBuilder.build(inFile, outFile);
  });
}

/**
 * Copy popup.js to dist folder, inlining the current commit hash along the way.
 * @return {Promise<void>}
 */
async function copyPopup() {
  let popupSrc = fs.readFileSync('app/src/popup.js', {encoding: 'utf8'});
  popupSrc = popupSrc.replace(/__COMMITHASH__/g, bundleBuilder.COMMIT_HASH);

  await makeDir(`${distDir}/scripts`);
  fs.writeFileSync(`${distDir}/scripts/popup.js`, popupSrc);
}

async function copyAssets() {
  await cpy('app/*.html', distDir);
  await cpy('app/styles/**/*.css', `${distDir}/styles`);
  await cpy('app/images/**/*', `${distDir}/images`);
  await cpy('app/manifest.json', distDir);

  // locales (currently non-functional)
  await cpy('_locales/**', `../${distDir}`, {
    cwd: 'app',
    parents: true,
  });
}

async function packageExtension() {
  await del([
    `${distDir}/scripts/${CONSUMERS.DEVTOOLS.dist}`,
    `${distDir}/scripts/${CONSUMERS.LIGHTRIDER.dist}`,
  ]);

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', {
      zlib: {level: 9},
    });

    const outPath = `package/lighthouse-${manifestVersion}.zip`;
    const writeStream = fs.createWriteStream(outPath);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);

    archive.pipe(writeStream);
    archive.glob(`${distDir}/**`);
    archive.finalize();
  });
}

async function run() {
  const argv = process.argv.slice(2);
  if (argv.includes('package')) {
    return packageExtension();
  }

  await Promise.all([
    ...buildAll(),
    copyAssets(),
    copyPopup(),
  ]);
}

run();
