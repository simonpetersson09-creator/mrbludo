# Builds resources/android/adaptive-foreground.png (108dp layer, 1728px) from
# resources/android/icon.png: fits the original background gradient, extends it
# seamlessly over the whole layer, and places the artwork inside the 66dp safe circle.
# Usage: python3 scripts/make-android-adaptive-icon.py resources/android/icon.png resources/android/adaptive-foreground.png
import numpy as np, sys
from PIL import Image
from scipy import ndimage as nd
SRC, OUT = sys.argv[1], sys.argv[2]
L = 1728  # layer px for 108dp (16 px/dp)
PXDP = L/108
VISIBLE_DP = 72   # original square maps to the launcher's visible 72dp
SAFE_R_DP = 31.5  # artwork must stay inside the 66dp safe circle
im=np.asarray(Image.open(SRC).convert('RGB')).astype(np.float64)
H,W,_=im.shape
def basis(u,v,d=6):
    return np.stack([u**i*v**j for i in range(d+1) for j in range(d+1-i)],-1)
y,x=np.mgrid[0:H,0:W]; B=basis(x/(W-1)*2-1,y/(H-1)*2-1)
mask=np.ones((H,W),bool)
for _ in range(6):
    coef,*_=np.linalg.lstsq(B[mask],im[mask],rcond=None)
    model=B@coef
    res=np.abs(im-model).max(-1)
    core=nd.binary_opening(res>10,iterations=2)
    art=nd.binary_dilation(core,iterations=14)
    mask=~art
# feathered artwork weight
wgt=nd.gaussian_filter(nd.binary_dilation(core,iterations=8).astype(float),6)
wgt=np.clip(wgt*1.6,0,1)
ys,xs=np.where(wgt>0.02)
rmax=np.sqrt((xs-(W-1)/2)**2+(ys-(H-1)/2)**2).max()
s=SAFE_R_DP*PXDP/rmax          # layer px per original px
size=int(round(W*s))
resid=(im-model)*wgt[...,None]
small=np.stack([np.asarray(Image.fromarray(resid[...,c].astype(np.float32),'F').resize((size,size),Image.LANCZOS)) for c in range(3)],-1)
# new background: same smooth gradient, original square stretched to visible 72dp, edge-clamped
yy,xx=np.mgrid[0:L,0:L]
k=(L/2)/(VISIBLE_DP/2*PXDP)
u=np.clip(((xx+0.5)-L/2)/(L/2)*k,-1,1); v=np.clip(((yy+0.5)-L/2)/(L/2)*k,-1,1)
bg=basis(u,v)@coef
out=bg.copy()
o=(L-size)//2
out[o:o+size,o:o+size]+=small
rng=np.random.default_rng(7)
out+=rng.normal(0,0.6,out.shape)  # tiny dither against banding
Image.fromarray(np.clip(np.round(out),0,255).astype(np.uint8)).save(OUT)
print('rmax',rmax,'scale',s,'size',size)
