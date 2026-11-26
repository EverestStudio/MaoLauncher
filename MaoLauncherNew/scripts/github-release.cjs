// No dependencies. The private Ed25519 key comes only from a GitHub Actions secret.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createReadStream} = require('node:fs');
const {version} = require('../package.json');
const config = require('../github-release.json');
function checkTag() {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Version must be X.Y.Z');
  if (process.env.GITHUB_REF_NAME !== `v${version}`) throw Error('Tag must match package.json: v' + version);
}
async function main() {
  checkTag();
  if (process.argv.includes('--check-tag')) return;
  if (process.env.GITHUB_REPOSITORY !== config.repository) throw Error('Unexpected release repository');
  if (!process.env.MAO_RELEASE_PRIVATE_KEY) throw Error('Add repository Actions secret MAO_RELEASE_PRIVATE_KEY (Ed25519 PEM). No release was published.');
  const key = crypto.createPrivateKey(process.env.MAO_RELEASE_PRIVATE_KEY);
  if (key.asymmetricKeyType !== 'ed25519') throw Error('An Ed25519 signing key is required');
  const actual = crypto.createPublicKey(key).export({format:'der',type:'spki'});
  const expected = crypto.createPublicKey(config.publicKey).export({format:'der',type:'spki'});
  if (!actual.equals(expected)) throw Error('Private key does not match the public key trusted by the installer');
  const filename = `MaoLauncher-${version}-win-x64.zip`;
  const file = path.join(__dirname,'../dist',filename);
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  const payload = JSON.stringify({version,url:`https://github.com/${config.repository}/releases/download/v${version}/${filename}`,size:fs.statSync(file).size,sha256:hash.digest('hex'),publishedAt:new Date().toISOString()});
  const signature = crypto.sign(null,Buffer.from(payload),key).toString('base64');
  fs.writeFileSync(path.join(__dirname,'../dist/manifest.json'),JSON.stringify({payload,signature})+'\n');
  console.log('Signed manifest for MaoLauncher ' + version);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
