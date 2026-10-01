
exec(open("/tmp/rq-lib.py").read())
import io, contextlib, traceback
os.chdir(REPO)
P=seed["parent"]["id"]
mpid,mfd=spawn([AB,"thread","attach",P],80,24,env)
pump(mfd,3)
e2=dict(env); e2.update(AB_TREE_MAIN_TERMINAL="fake-main",AB_TREE_SHOWN=P+".agent")
spid,sfd=spawn([AB,"tree","ui","--sidebar"],40,18,e2)
pump(sfd,3)
cmds="/tmp/rq-cmd"
if os.path.exists(cmds): os.unlink(cmds)
os.mkfifo(cmds)
while True:
    with open(cmds) as f: code=f.read()
    out=io.StringIO()
    with contextlib.redirect_stdout(out):
        try:
            if code.strip()=="quit": break
            exec(code)
        except Exception: traceback.print_exc(file=out)
    open("/tmp/rq-out","w").write(out.getvalue()); 
for p in (spid,mpid):
    try: os.kill(p,signal.SIGKILL)
    except: pass
os._exit(0)
