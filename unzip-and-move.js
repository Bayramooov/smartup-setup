// unzip-and-move.js
const fs = require('fs');
const path = require('path');
const { createReadStream } = require('fs');
const { mkdir } = require('fs/promises');
const unzipper = require('unzipper');

/**
 * Unzips app_biruni.zip to parent directory and lib.zip to app_biruni/WEB-INF/lib
 * @param {string} downloadDir - Directory where zip files are stored
 * @returns {Promise<void>}
 */
async function unzipAndMoveFiles(downloadDir = path.join(__dirname, 'downloads')) {
  try {
    const appZipPath = path.join(downloadDir, 'app_biruni.zip');
    const libZipPath = path.join(downloadDir, 'lib.zip');
    const finalDir = path.resolve(__dirname, './app_biruni');

    console.log('Starting unzip operations...');

    // 1. Ensure files exist
    if (!fs.existsSync(appZipPath)) {
      throw new Error(`app_biruni.zip not found at ${appZipPath}`);
    }
    if (!fs.existsSync(libZipPath)) {
      throw new Error(`lib.zip not found at ${libZipPath}`);
    }

    // 2. Unzip app_biruni.zip to parent directory
    console.log(`Unzipping app_biruni.zip to ${finalDir}...`);
    await extractZip(appZipPath, finalDir);

    // 3. Ensure the target directory for lib.zip exists
    const libTargetDir = path.join(finalDir, 'WEB-INF', 'lib');
    await ensureDirectoryExists(libTargetDir);

    // 4. Unzip lib.zip to target directory
    console.log(`Unzipping lib.zip to ${libTargetDir}...`);
    await extractZip(libZipPath, libTargetDir);

    console.log('Unzip and move operations completed successfully!');
  } catch (error) {
    console.error('Error during unzip and move operations:', error.message);
    throw error;
  }
}

/**
 * Extracts a zip file to the specified directory
 * @param {string} zipFilePath - Path to the zip file
 * @param {string} targetDir - Target directory for extraction
 * @returns {Promise<void>}
 */
function extractZip(zipFilePath, targetDir) {
  return new Promise((resolve, reject) => {
    createReadStream(zipFilePath)
      .pipe(unzipper.Extract({ path: targetDir }))
      .on('close', () => {
        console.log(`Extraction of ${path.basename(zipFilePath)} completed`);
        resolve();
      })
      .on('error', err => {
        reject(new Error(`Failed to extract ${zipFilePath}: ${err.message}`));
      });
  });
}

/**
 * Ensures a directory exists, creating it if necessary
 * @param {string} dirPath - Directory path to ensure exists
 * @returns {Promise<void>}
 */
async function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    await mkdir(dirPath, { recursive: true });
  }
}

// Export for use in other files
module.exports = { unzipAndMoveFiles };
