#!/usr/bin/env node

/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line no-undef
const { exec } = require('child_process');
// eslint-disable-next-line no-undef
const util = require('util');
// eslint-disable-next-line no-undef
const fs = require('fs');

const execPromise = util.promisify(exec);
const readFilePromise = util.promisify(fs.readFile);
const writeFilePromise = util.promisify(fs.writeFile);

/* Colors */
const Reset = '\x1b[0m';
const Bright = '\x1b[1m';
const Dim = '\x1b[2m';
const Underscore = '\x1b[4m';
const Blink = '\x1b[5m';
const Reverse = '\x1b[7m';
const Hidden = '\x1b[8m';

const FgBlack = '\x1b[30m';
const FgRed = '\x1b[31m';
const FgGreen = '\x1b[32m';
const FgYellow = '\x1b[33m';
const FgBlue = '\x1b[34m';
const FgMagenta = '\x1b[35m';
const FgCyan = '\x1b[36m';
const FgWhite = '\x1b[37m';
const FgGray = '\x1b[90m';

const BgBlack = '\x1b[40m';
const BgRed = '\x1b[41m';
const BgGreen = '\x1b[42m';
const BgYellow = '\x1b[43m';
const BgBlue = '\x1b[44m';
const BgMagenta = '\x1b[45m';
const BgCyan = '\x1b[46m';
const BgWhite = '\x1b[47m';
const BgGray = '\x1b[100m';
/* /Colors */

function printRunCommand(cmd) {
  console.log(`${FgGray}[COMMAND]: ${cmd}${Reset}`);
}

function print(msg) {
  console.log(`${FgGreen}${msg}${Reset}`);
}

function log(msg) {
  console.log(`${BgGray}${msg}${Reset}`)
}

function getLinesChangesFromOutput(stdout) {
  return stdout
    .split('\n')
    .map((line) => {
      const filesChangedMatch = line.match(/(\d+)\s+file\S*\s+changed\S*\s*/);

      const insertionsChangedMatch = line.match(
        /(\d*)\s*insertion\S*\(\+\)?\s*/
      );

      const deletionsChangedMatch = line.match(/(\d*)\s*deletion\S*\(-\)?/);

      let total = 0;

      if (filesChangedMatch) {
        total += Number(filesChangedMatch[1]);
      }

      if (insertionsChangedMatch) {
        total += Number(insertionsChangedMatch[1]);
      }

      if (deletionsChangedMatch) {
        total += Number(deletionsChangedMatch[1]);
      }

      return total;
    })
    .reduce((total, current) => total + current, 0);
}

async function getPendingLines() {
  try {
    if (isVerbose) printRunCommand('git diff --stat');
    const { stdout } = await execPromise('git diff --stat');

    return getLinesChangesFromOutput(stdout);
  } catch (error) {
    console.error(`Error executing git command: ${error.message}`);
    throw error;
  }
}

async function getAlreadyCommitedLines() {
  try {
    if (isVerbose) printRunCommand('git rev-parse --abbrev-ref HEAD');

    const { stdout: branchName } = await execPromise(
      'git rev-parse --abbrev-ref HEAD'
    );

    const gitDiffWithOriginCommand = `git diff origin/${branchName.replace(
      '\n',
      ''
    )} ${branchName.replace('\n', '')} --stat`;

    if (isVerbose) printRunCommand(gitDiffWithOriginCommand);
    const { stdout } = await execPromise(gitDiffWithOriginCommand);

    return getLinesChangesFromOutput(stdout);
  } catch (error) {
    console.error(`Error executing git command: ${error.message}`);
    throw error;
  }
}

async function updatePackageJsonVersion(pendingLines) {
  try {
    const packageJsonPath = 'package.json';
    const packageJson = await readFilePromise(packageJsonPath, 'utf8');
    const parsedPackageJson = JSON.parse(packageJson);

    if (isDebug) log(`Current version: ${parsedPackageJson.version}`)

    // Assuming the version is in the format X.Y.Z
    const versionParts = parsedPackageJson.version.split('.').map(Number);


    if (pendingLines < threshold) {
      versionParts[2]++;
    } else {
      versionParts[1]++;
      versionParts[2] = 0;
    }

    parsedPackageJson.version = versionParts.join('.');

    print(
      `Updating version to: ${parsedPackageJson.version} (updated ${
        pendingLines < threshold ? 'patch' : 'minor'
      } number)`
    );

    // Write back to package.json
    if (!isDryRun) {
      if (isDebug) log("Saving new package.json...")

      const fileSaveResult = await writeFilePromise(
        packageJsonPath,
        JSON.stringify(parsedPackageJson, null, 2),
        'utf8'
      );
    }

    if (isDebug && !isDryRun) log("File saved")

    return parsedPackageJson.version;
  } catch (error) {
    console.error(`Error updating package.json version: ${error.message}`);
    throw error;
  }
}

async function main() {
  const pendingLinesToCommit = await getPendingLines();
  const alreadyCommitedLines = await getAlreadyCommitedLines();

  print(`Pending lines to commit: ${pendingLinesToCommit}`);
  print(`Already commited lines pending to push: ${alreadyCommitedLines}`);

  if (pendingLinesToCommit + alreadyCommitedLines === 0) {
    print(`✅ No changes`);
    return;
  }

  if (pendingLinesToCommit > 0 && !commitMessage)
    throw new Error(
      'There are pending lines to commit, you must include a commit message (use --m flag like git commit)'
    );

  // Update package json
  const newVersion = await updatePackageJsonVersion(
    pendingLinesToCommit + alreadyCommitedLines
  );

  if (isDebug) log(`New version is v${newVersion} and it has been saved to package.json`)
  
  // Git stuff
  if (pendingLinesToCommit > 0) {
    print(
      `Commiting ${pendingLinesToCommit} pending lines with message: "${commitMessage}"`
    );

    if (!isDryRun) {
      const pendingCommand = `git add . && git commit -m "${commitMessage}"`;
      if (isVerbose) printRunCommand(pendingCommand);

      await execPromise(pendingCommand);
    }
  } else {
    // We need to update package version anyway
    print(
      `Commiting package.json version with message: "release: v${newVersion}"`
    );

    if (!isDryRun) {
      const releaseCommand = `git add . && git commit -m "release: v${newVersion}"`;
      if (isVerbose) printRunCommand(releaseCommand);

      await execPromise(releaseCommand);
    }
  }

  if (!isDryRun) {
    print('Pushing changes');
    if (isVerbose) printRunCommand('git push');
    await execPromise('git push');

    print(`Creating v${newVersion} tag and pushing it`);
    const tagCommand = `git tag v${newVersion} && git push --tags`;

    if (isVerbose) printRunCommand(tagCommand);
    await execPromise(tagCommand);
  }

  print('DONE');
}

const args = process.argv.slice(2);

const commitMessageIndex = args.indexOf('-m');
const commitMessage =
  commitMessageIndex !== -1 ? args[commitMessageIndex + 1] : null;

const thresholdIndex = args.indexOf('--threshold');
const threshold =
  thresholdIndex !== -1 ? (Number(args[thresholdIndex + 1]) ?? 400) : 400;

const isDryRun = args.indexOf('--dry-run') !== -1;
const isVerbose = args.indexOf('--verbose') !== -1;
const isDebug = args.indexOf('--debug') !== -1;

module.exports = {
  main
}