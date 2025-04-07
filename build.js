require('dotenv').config();
const https = require('https');
const path = require('path');
const fs = require('fs');
const { rm } = require('fs/promises');
const { Octokit } = require('@octokit/rest');
const { unzipAndMoveFiles } = require('./unzip-and-move');

// GitHub configuration
const owner = 'greenwhite';
const repo = 'biruni';
const assetNames = ['app_biruni.zip', 'lib.zip'];

// Get PAT from environment variable
const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error('Error: GitHub token not found. Please set GITHUB_TOKEN in your .env file');
  process.exit(1);
}

// Initialize Octokit with your token
const octokit = new Octokit({
  auth: token,
});

// Function to download a file from URL
function downloadFile(url, fileName) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/octet-stream',
        'User-Agent': 'Node.js',
      },
    };

    const file = fs.createWriteStream(fileName);

    https
      .get(url, options, response => {
        if (response.statusCode === 302) {
          // GitHub redirects to the actual file
          https
            .get(response.headers.location, finalResponse => {
              finalResponse.pipe(file);

              file.on('finish', () => {
                file.close();
                console.log(`Downloaded: ${fileName}`);
                resolve();
              });
            })
            .on('error', err => {
              fs.unlink(fileName, () => {});
              reject(err);
            });
        } else {
          file.close();
          reject(new Error(`Failed to download ${fileName}: ${response.statusCode}`));
        }
      })
      .on('error', err => {
        fs.unlink(fileName, () => {});
        reject(err);
      });
  });
}

async function main() {
  try {
    // Get the latest release
    const { data: latestRelease } = await octokit.repos.getLatestRelease({
      owner,
      repo,
    });

    console.log(`Latest release: ${latestRelease.tag_name}`);

    // Create downloads directory if it doesn't exist
    const downloadDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    } else {
      console.log(`Removing existing downloads folder: ${downloadDir}`);
      await rm(downloadDir, { recursive: true, force: true });
      fs.mkdirSync(downloadDir);
      console.log('Downloads folder removed successfully');
    }

    // Filter and download the required assets
    const downloadPromises = [];

    for (const asset of latestRelease.assets) {
      if (assetNames.includes(asset.name)) {
        const filePath = path.join(downloadDir, asset.name);
        console.log(`Downloading ${asset.name}...`);
        downloadPromises.push(downloadFile(asset.url, filePath));
      }
    }

    await Promise.all(downloadPromises);
    console.log('All downloads completed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    if (error.status === 404) {
      console.error("Repository not found or you don't have access to it.");
    }
  }
}

(async function () {
  await main();
  unzipAndMoveFiles()
    .then(() => console.log('Unzip process completed'))
    .catch(err => console.error('Unzip process failed:', err));
})();
