const fs=require('fs'),path=require('path');const file=path.join(__dirname,'node_modules/@xmcl/unzip/package.json');const pkg=JSON.parse(fs.readFileSync(file));pkg.main='./dist/index.js';fs.writeFileSync(file,JSON.stringify(pkg,null,2));
require('./scripts/desktop-controls.cjs');
require('./scripts/addons-profile.cjs');
require('./scripts/community.cjs');
require('./scripts/onboarding.cjs');
