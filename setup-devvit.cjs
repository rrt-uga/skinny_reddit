// setup-devvit.cjs - Devvit project setup script
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const os = require('os');

function generateRandomSuffix(length) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return result;
}

function updateDevvitName() {
  const devvitYamlPath = path.join(process.cwd(), 'devvit.yaml');
  const content = fs.readFileSync(devvitYamlPath, 'utf8');
  
  if (content.includes('reddit-vibepoem')) {
    // Already updated, skip
    return;
  }
  
  if (content.includes('YOUR_APP_NAME')) {
    const suffix = generateRandomSuffix(6);
    const newContent = content.replace('YOUR_APP_NAME', `reddit-vibepoem-${suffix}`);
    fs.writeFileSync(devvitYamlPath, newContent);
    console.log(`Updated app name to reddit-vibepoem-${suffix}`);
  }
}

async function runChecks() {
  let allPassed = true;
  const checks = [];

  // Check 1: Devvit login
  const devvitTokenPath = path.join(os.homedir(), '.devvit', 'token');
  const isLoggedIn = fs.existsSync(devvitTokenPath);
  checks.push({
    name: 'Authentication',
    passed: isLoggedIn,
    message: isLoggedIn
      ? "You're logged in to Devvit!"
      : 'Please run `npm run login` to authenticate with Reddit',
  });

  // Check 2: App upload check
  const uploadedPath = path.join(process.cwd(), '.initialized');
  const isUploaded = fs.existsSync(uploadedPath);
  checks.push({
    name: 'App initialization',
    passed: isUploaded,
    message: isUploaded
      ? 'App has been initialized'
      : 'Please run `npm run devvit:init` to setup your app remotely',
  });

  // Check 3: Subreddit configuration
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonContent);
  const devScript = packageJson.scripts && packageJson.scripts['dev:devvit'];
  
  // Fixed validation: Check if we have a valid subreddit name (not the placeholder)
  const hasValidSubreddit = devScript && 
    !devScript.includes('YOUR_SUBREDDIT_NAME') && 
    devScript.includes('devvit playtest') &&
    devScript.split('devvit playtest')[1]?.trim().length > 0;
    
  checks.push({
    name: 'Playtest subreddit',
    passed: hasValidSubreddit,
    message: hasValidSubreddit
      ? 'Subreddit is configured!'
      : 'Please update YOUR_SUBREDDIT_NAME in the dev:devvit script in package.json',
  });

  // Print check results
  checks.forEach((check) => {
    const emoji = check.passed ? '✅' : '❌';
    console.log(`${emoji}  ${check.name}: ${check.message}`);
    if (!check.passed) allPassed = false;
  });

  return allPassed;
}

async function main() {
  try {
    // Step 1: Update devvit.yaml name
    updateDevvitName();

    // Step 2: Run checks
    const checksPass = await runChecks();

    // Step 3: If all checks pass, run dev:all
    if (checksPass) {
      console.log('\nAll checks passed! Starting development server...');
      const devProcess = exec('npm run dev:all', (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running dev:all: ${error.message}`);
          process.exit(1);
        }
      });

      devProcess.stdout.pipe(process.stdout);
      devProcess.stderr.pipe(process.stderr);
    } else {
      console.log('\nPlease fix the issues above and try again.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();