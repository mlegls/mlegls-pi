
import os, pty, sys, time, select, re, subprocess, fcntl, termios, struct, json, signal
R="/tmp/rq-sidebar"; REPO=os.getcwd(); AB=REPO+"/bin/ab"
seed=json.load(open(R+"/seed.json"))
ZMX=os.path.expanduser("~/.local/share/mise/installs/zmx/latest/zmx")
env=dict(os.environ); env.update(XDG_STATE_HOME=R+"/state",XDG_CACHE_HOME=R+"/cache",PI_BOARD_DIR=R+"/board",PI_CODING_AGENT_DIR=R+"/agent",ZMX_DIR=R+"/zmx",AB_TREE_TOKEN="rq-token",ZMX_TRACK_ENV="DISPLAY,AB_TREE_TOKEN")
for k in ["ZMX_SESSION","ZMX_SESSION_PREFIX","TMUX","TMUX_PANE","GHOSTTY_RESOURCES_DIR","AB_THREAD_ID","PI_SESSION_ID","PI_SESSION_FILE"]: env.pop(k,None)
def spawn(cmd,cols,rows,e):
    pid,fd=pty.fork()
    if pid==0:
        os.chdir(R+"/project"); os.execvpe(cmd[0],cmd,e)
    fcntl.ioctl(fd,termios.TIOCSWINSZ,struct.pack("HHHH",rows,cols,0,0))
    return pid,fd
buf={}
def pump(fd,t=1.0):
    end=time.time()+t
    while time.time()<end:
        r,_,_=select.select([fd],[],[],0.1)
        if r:
            try: d=os.read(fd,65536)
            except OSError: break
            buf[fd]=buf.get(fd,b"")+d
def frame(fd):
    s=buf.get(fd,b"").decode("utf8","replace")
    i=s.rfind("\x1b[H"); s=s[i+3:] if i>=0 else s
    s=re.sub(r"\x1b\[[0-9;?]*[A-Za-z]","",s); s=re.sub(r"\x1b\][^\x07]*\x07","",s)
    return s.replace("\r\n","\n")
def show(fd,label):
    print("=== "+label); print("\n".join(l.rstrip() for l in frame(fd).split("\n"))); sys.stdout.flush()
def lsout(*a):
    return subprocess.run([AB,"thread","ls"]+list(a),env=env,cwd=R+"/project",capture_output=True,text=True).stdout
def clients():
    return subprocess.run([ZMX,"ls"],env=env,capture_output=True,text=True).stdout
def mainname():
    out=subprocess.run([ZMX,"ls"],env=env,capture_output=True,text=True).stdout
    return out
def send(fd,s,t=1.5):
    os.write(fd,s.encode()); pump(fd,t)
def mouse(fd,b,x,y,rel=False,t=0.6):
    send(fd,"\x1b[<%d;%d;%d%s"%(b,x+1,y+1,"m" if rel else "M"),t)
def click(fd,x,y): mouse(fd,0,x,y); mouse(fd,0,x,y,True)
def mainscreen(mfd):
    s=buf.get(mfd,b"").decode("utf8","replace"); s=re.sub(r"\x1b\[[0-9;?]*[A-Za-z]","",s); s=re.sub(r"\x1b\][^\x07]*\x07","",s)
    return s[-300:].replace("\r","")
