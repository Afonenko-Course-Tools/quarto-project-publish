"""Exercise installed native preview. Pass a completed site-native fixture path."""
from pathlib import Path
import json, os, selectors, shutil, signal, subprocess, sys, time
root = Path(sys.argv[1])
quarto = os.environ.get('QUARTO', 'quarto')
trace = root / 'trace.jsonl'
def renders():
    return len([x for x in trace.read_text().splitlines() if json.loads(x)['kind'] == 'render'])
def preview(cwd, clean=False):
    if clean:
        shutil.rmtree(cwd / '_site')
    before = renders()
    env = dict(os.environ, QUARTO=quarto, COURSE_BUILD_TRACE=str(trace))
    p = subprocess.Popen([quarto, 'preview', '--no-browser', '--no-watch-inputs', '--port', '45984'], cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    selector = selectors.DefaultSelector(); selector.register(p.stdout, selectors.EVENT_READ)
    deadline = time.monotonic() + 90
    listening = False
    edited = False
    try:
        while p.poll() is None and time.monotonic() < deadline:
            for key, _ in selector.select(timeout=.2):
                line = key.fileobj.readline()
                print(line, end='', flush=True)
                if 'Listening on' in line or 'Browse at' in line:
                    listening = True
                    deadline = time.monotonic() + 3
                    if not edited:
                        path = cwd / "index.qmd"
                        path.write_text(path.read_text() + "\nNo-watch acceptance edit.\n")
                        edited = True
        assert listening, 'native preview did not start serving'
    finally:
        selector.close()
        if p.poll() is None: os.killpg(p.pid, signal.SIGTERM)
        try: p.wait(timeout=4)
        except subprocess.TimeoutExpired: os.killpg(p.pid, signal.SIGKILL); p.wait()
    expected = 1 if clean and cwd == root else 0
    assert renders() - before == expected, (renders() - before, expected)
preview(root)
preview(root, clean=True)
preview(root / 'part')
print('PASS existing/clean root preview and standalone component preview, native render scope')
