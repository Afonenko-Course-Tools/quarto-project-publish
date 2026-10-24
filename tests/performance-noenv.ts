import {strict as assert} from 'node:assert';
const root = await Deno.makeTempDir({prefix: 'course-site-noenv-'});
const processModule = new URL('../_extensions/course-site/infrastructure/process.ts', import.meta.url).href;
try {
  const runner = root + '/restricted-parent.ts';
  await Deno.writeTextFile(runner, `
import {quarto} from ${JSON.stringify(processModule)};
const output = await quarto(['-c', 'printf "%s|%s|%s|%s" "$FUNCTIONAL_INHERITED" "$FUNCTIONAL_EXPLICIT" "$QUARTO_PROFILE" "$COURSE_PERF_PARENT_SPAN_ID"'], ${JSON.stringify(root)}, {FUNCTIONAL_EXPLICIT: 'override', QUARTO_PROFILE: 'student'});
console.log(output);
`);
  const failures: string[] = [];
  for (const mode of ['off', 'summary']) {
    const result = await new Deno.Command(Deno.execPath(), {
      args: ['run', '--no-config', '--no-lock', '--no-npm', '--no-prompt',
        '--allow-read', '--allow-run=/bin/sh', '--allow-env=QUARTO,QRC_QUARTO,COURSE_PERF_MODE', runner],
      env: {QUARTO: '/bin/sh', COURSE_PERF_MODE: mode, FUNCTIONAL_INHERITED: 'inherited',
        COURSE_PERF_PARENT_SPAN_ID: 'native-parent'},
      stdout: 'piped', stderr: 'piped',
    }).output();
    const out = new TextDecoder().decode(result.stdout), err = new TextDecoder().decode(result.stderr);
    if (result.code !== 0 || out.trim() !== 'inherited|override|student|native-parent') {
      failures.push(`${mode}: exit=${result.code}\n${out}${err}`);
    }
  }
  assert.deepEqual(failures, [], 'off/missing agent не должны требовать полного env permission');
  console.log('PASS restricted Deno parent: off/missing agent, inherited+explicit functional env без полного env permission');
} finally {
  await Deno.remove(root, {recursive: true});
}
