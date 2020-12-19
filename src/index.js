const core = require('@actions/core');
const exec = require('@actions/exec');
const path = require('path');

async function run() {
  try {
    const workingDirectory = path.resolve(process.env.GITHUB_WORKSPACE, core.getInput('working-directory'))

    const [analyzeErrorCount, analyzeWarningCount] = await analyze(workingDirectory);
    const formatWarningCount = await format(workingDirectory);

    const issueCount = analyzeErrorCount + analyzeWarningCount + formatWarningCount;
    const failOnWarnings = core.getInput('fail-on-warnings') === 'true';

    if (analyzeErrorCount > 0 || (failOnWarnings && issueCount > 0)) {
      core.setFailed(`${issueCount} issue${issueCount === 1 ? '' : 's'} found.`);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function analyze(workingDirectory) {
  let output = '';

  const options = { cwd: workingDirectory };
  options.listeners = {
    stdout: (data) => {
      output += data.toString();
    },
    stderr: (data) => {
      output += data.toString();
    }
  };

  await exec.exec('dartanalyzer', ['--format', 'machine', '--options', 'analysis_options.yaml', '.'], options);

  let errorCount = 0;
  let warningCount = 0;
  const lines = output.trim().split(/\r?\n/);

  for (const line of lines) {
    const lineData = line.split('|');
    const lint = lineData[2];
    const lintLowerCase = lint.toLowerCase();
    const file = lineData[3].replace(workingDirectory, '');
    const url = lint === lintLowerCase
      ? `https://dart-lang.github.io/linter/lints/${lint}.html`
      : `https://dart.dev/tools/diagnostic-messages#${lintLowerCase}`
    const message = `file=${file},line=${lineData[4]},col=${lineData[5]}::${lineData[7]} For more details, see ${url}`;

    if (lineData[0] === 'ERROR') {
      console.log(`::error ${message}`);
      errorCount++;
    } else {
      console.log(`::warning ${message}`);
      warningCount++;
    }
  }

  return [errorCount, warningCount];
}

async function format(workingDirectory) {
  let output = '';

  const options = { cwd: workingDirectory };
  options.listeners = {
    stdout: (data) => {
      output += data.toString();
    },
    stderr: (data) => {
      output += data.toString();
    }
  };

  await exec.exec('dartfmt', ['format', '--dry-run', '.'], options);

  let warningCount = 0;
  const lines = output.trim().split(/\r?\n/);

  for (const line of lines) {
    if (!line.endsWith('.dart')) continue;

    console.log(`::warning file=${line}::Invalid format. For more details, see https://flutter.dev/docs/development/tools/formatting`);
    warningCount++;
  }

  return warningCount;
}

run();