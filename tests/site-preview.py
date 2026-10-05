"""Installed existing/clean root and component native previews, with/without Core."""
from pathlib import Path
import argparse,json,os,selectors,shutil,signal,socket,subprocess,time
parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);parser.add_argument('--course',action='store_true');args=parser.parse_args()
root=args.root.resolve();quarto=os.environ.get('QUARTO','quarto');trace=root/'preview-trace.jsonl'
def renders():
    return sum(json.loads(x)['kind']=='render'for x in trace.read_text().splitlines())if trace.exists()else 0
def preview(cwd,clean=False):
    if clean:shutil.rmtree(cwd/('_site-student' if args.course else '_site'))
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    before=renders();command=[quarto,'preview','--no-browser','--no-watch-inputs','--port',str(port)]
    if args.course:command+=['--profile','student']
    p=subprocess.Popen(command,cwd=cwd,env=dict(os.environ,COURSE_BUILD_TRACE=str(trace)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
    selector=selectors.DefaultSelector();selector.register(p.stdout,selectors.EVENT_READ);deadline=time.monotonic()+120;listening=False
    source=cwd/'index.qmd';original=source.read_bytes()
    try:
        while p.poll() is None and time.monotonic()<deadline:
            for key,_ in selector.select(timeout=.2):
                line=key.fileobj.readline();print(line,end='',flush=True)
                if 'Listening on' in line or 'Browse at' in line:
                    listening=True;deadline=time.monotonic()+3;source.write_bytes(original+b'\nNo-watch acceptance edit.\n')
        assert listening,'native preview did not start serving'
    finally:
        source.write_bytes(original);selector.close()
        if p.poll() is None:os.killpg(p.pid,signal.SIGTERM)
        try:p.wait(timeout=4)
        except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
    expected=(2 if args.course else 1) if clean and cwd==root else 0
    assert renders()-before==expected,(renders()-before,expected)
    if args.course and not clean:
        assert not (cwd/'_generated/course-spec/native-run.json').exists(),'zero-output hook fabricated completion'
preview(root);preview(root,True);preview(root/'part')
print('PASS existing/clean root and component preview, public native scope, no fabricated completion')
