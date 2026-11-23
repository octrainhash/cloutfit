// Closet helpers: background removal for clothing photos, dominant colour, storage, and flat item art.

/* ---------- colour science ---------- */
function srgb2lab(r,g,b){
  const f=c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4};
  const R=f(r),G=f(g),B=f(b);
  let x=(R*.4124+G*.3576+B*.1805)/.95047,y=R*.2126+G*.7152+B*.0722,z=(R*.0193+G*.1192+B*.9505)/1.08883;
  const h=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;x=h(x);y=h(y);z=h(z);
  return [116*y-16,500*(x-y),200*(y-z)];
}
const dE=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function kmeans(pts,k,iters=10){
  if(!pts.length)return [];let c=[];for(let i=0;i<k;i++)c.push(pts[Math.floor((i+.5)*pts.length/k)].slice());
  let lab=new Int32Array(pts.length);
  for(let it=0;it<iters;it++){
    const sum=c.map(()=>[0,0,0,0]);
    for(let i=0;i<pts.length;i++){let best=0,bd=1e9;for(let j=0;j<k;j++){const d=dE(pts[i],c[j]);if(d<bd){bd=d;best=j}}lab[i]=best;const s=sum[best];s[0]+=pts[i][0];s[1]+=pts[i][1];s[2]+=pts[i][2];s[3]++}
    c=sum.map((s,j)=>s[3]?[s[0]/s[3],s[1]/s[3],s[2]/s[3]]:c[j]);
    c.n=sum.map(s=>s[3]);
  }
  return c.map((v,j)=>({c:v,n:c.n[j]}));
}
const NAMES=[['Black','#111111'],['Charcoal','#3a3a3c'],['Grey','#8e8e93'],['Silver','#c7c7cc'],['White','#f7f7f5'],['Cream','#efe6d2'],['Beige','#d8c3a5'],['Camel','#b08a5a'],['Brown','#6b4226'],['Chocolate','#3e2418'],['Navy','#1f2a44'],['Blue','#2f5d9a'],['Denim','#3d5a80'],['Light blue','#9cc3e6'],['Teal','#1f7a7a'],['Green','#2f7d4b'],['Olive','#6b6b2e'],['Sage','#a3b18a'],['Mint','#a8e6cf'],['Yellow','#f2c94c'],['Mustard','#c9a227'],['Orange','#e8742a'],['Rust','#a5462a'],['Red','#c0282f'],['Burgundy','#6d1a2f'],['Pink','#f0a6ca'],['Hot pink','#e8467c'],['Lilac','#c3a6e0'],['Purple','#6a3d9a']];
const hex2rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
export const rgb2hex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
export function colorName(hex){const l=srgb2lab(...hex2rgb(hex));let best=NAMES[0][0],bd=1e9;for(const [n,h] of NAMES){const d=dE(l,srgb2lab(...hex2rgb(h)));if(d<bd){bd=d;best=n}}return best}

/* ---------- background removal ---------- */
// Samples the photo's border to learn the background, flood-fills it from the edges,
// keeps the main garment, closes small holes and feathers the edge.
export async function cutout(src,{tol=22,keepBg=false}={}){
  const bmp=src instanceof ImageBitmap?src:await createImageBitmap(src,{imageOrientation:'from-image'});
  const S=Math.min(1,720/Math.max(bmp.width,bmp.height)),W=Math.max(8,Math.round(bmp.width*S)),H=Math.max(8,Math.round(bmp.height*S));
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(bmp,0,0,W,H);
  const img=x.getImageData(0,0,W,H),px=img.data,N=W*H,lab=new Float32Array(N*3);
  for(let i=0;i<N;i++){const l=srgb2lab(px[i*4],px[i*4+1],px[i*4+2]);lab[i*3]=l[0];lab[i*3+1]=l[1];lab[i*3+2]=l[2]}
  const L=i=>[lab[i*3],lab[i*3+1],lab[i*3+2]];
  const border=[],bw=Math.max(2,Math.round(Math.min(W,H)*.02));
  for(let y=0;y<H;y+=2)for(let xx=0;xx<W;xx+=2)if(xx<bw||yy(y)||xx>=W-bw)border.push(L(y*W+xx));
  function yy(y){return y<bw||y>=H-bw}
  const bg=kmeans(border,3).filter(c=>c.n>border.length*.08).map(c=>c.c);
  let mask=new Uint8Array(N);// 1 = background
  if(!keepBg){
    const q=new Int32Array(N);let qh=0,qt=0;
    const isBg=i=>{const p=L(i);for(const c of bg)if(dE(p,c)<tol)return true;return false};
    for(let xx=0;xx<W;xx++){for(const y of [0,H-1]){const i=y*W+xx;if(!mask[i]&&isBg(i)){mask[i]=1;q[qt++]=i}}}
    for(let y=0;y<H;y++){for(const xx of [0,W-1]){const i=y*W+xx;if(!mask[i]&&isBg(i)){mask[i]=1;q[qt++]=i}}}
    while(qh<qt){const i=q[qh++],xx=i%W,y=(i/W)|0,p=L(i);
      for(const j of [xx>0?i-1:-1,xx<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1]){if(j<0||mask[j])continue;const pj=L(j);
        // either close to a learned background colour, or a smooth continuation of the background (shadows, gradients)
        let near=1e9,shadow=false;for(const c of bg){const d=dE(pj,c);if(d<near)near=d;if(Math.abs(pj[1]-c[1])+Math.abs(pj[2]-c[2])<7&&c[0]-pj[0]<32&&pj[0]-c[0]<12)shadow=true}let ok=near<tol||(shadow&&dE(pj,p)<tol*.3);
        if(ok){mask[j]=1;q[qt++]=j}}}
  }
  // keep the largest foreground region
  const comp=new Int32Array(N).fill(-1);let best=-1,bestN=0,id=0;const sizes=[];
  for(let i=0;i<N;i++){if(mask[i]||comp[i]>=0)continue;const st=[i];comp[i]=id;let n=0;while(st.length){const k=st.pop();n++;const xx=k%W,y=(k/W)|0;for(const j of [xx>0?k-1:-1,xx<W-1?k+1:-1,y>0?k-W:-1,y<H-1?k+W:-1])if(j>=0&&!mask[j]&&comp[j]<0){comp[j]=id;st.push(j)}}sizes.push(n);if(n>bestN){bestN=n;best=id}id++}
  const fgFrac=bestN/N;
  const failed=keepBg||fgFrac<.04||fgFrac>.96;
  let alpha=new Float32Array(N);
  for(let i=0;i<N;i++)alpha[i]=failed?1:(comp[i]===best||(comp[i]>=0&&sizes[comp[i]]>N*.02))?1:0;
  if(!failed){// feather: two box blurs
    for(let pass=0;pass<2;pass++){const t=new Float32Array(N);for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){let s=0,c=0;for(let d=-1;d<=1;d++){const a=xx+d;if(a>=0&&a<W){s+=alpha[y*W+a];c++}}t[y*W+xx]=s/c}
      for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){let s=0,c=0;for(let d=-1;d<=1;d++){const b=y+d;if(b>=0&&b<H){s+=t[b*W+xx];c++}}alpha[y*W+xx]=s/c}}
    for(let i=0;i<N;i++){const a=alpha[i];alpha[i]=a<.15?0:a>.85?1:(a-.15)/.7}
  }
  let x0=W,y0=H,x1=0,y1=0;for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++)if(alpha[y*W+xx]>.5){if(xx<x0)x0=xx;if(xx>x1)x1=xx;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<=x0){x0=0;y0=0;x1=W-1;y1=H-1}
  for(let i=0;i<N;i++)px[i*4+3]=Math.round(alpha[i]*255);
  x.putImageData(img,0,0);
  const pad=Math.round(Math.max(x1-x0,y1-y0)*.04),cx0=Math.max(0,x0-pad),cy0=Math.max(0,y0-pad),cw=Math.min(W,x1+pad+1)-cx0,ch=Math.min(H,y1+pad+1)-cy0;
  const o=document.createElement('canvas'),os=Math.min(1,600/Math.max(cw,ch));o.width=Math.round(cw*os);o.height=Math.round(ch*os);o.getContext('2d').drawImage(cv,cx0,cy0,cw,ch,0,0,o.width,o.height);
  // dominant colour of the garment
  const pts=[],rgb=[];for(let i=0;i<N;i+=3){if(alpha[i]<.9)continue;pts.push(L(i));rgb.push([px[i*4],px[i*4+1],px[i*4+2]])}
  let color='#888888';
  if(pts.length){const cl=kmeans(pts,4);let bi=0;cl.forEach((c,j)=>{if(c.n>cl[bi].n)bi=j});
    // average the RGB of the members of the biggest cluster
    let r=0,g=0,b=0,n=0;for(let i=0;i<pts.length;i++){let best2=0,bd=1e9;cl.forEach((c,j)=>{const d=dE(pts[i],c.c);if(d<bd){bd=d;best2=j}});if(best2===bi){r+=rgb[i][0];g+=rgb[i][1];b+=rgb[i][2];n++}}
    if(n)color=rgb2hex(r/n,g/n,b/n)}
  const ar=(y1-y0)/Math.max(1,x1-x0);
  const guess=ar>1.9?'trousers':ar>1.35?'dress':ar<.55?'sneakers':'tee';
  const cn=colorName(color);
  return {photo:o.toDataURL('image/png'),color,colorName:cn,guess:guess==='trousers'&&/Denim|Navy|Blue|Light blue/.test(cn)?'jeans':guess,failed,ar};
}

/* ---------- storage ---------- */
function idb(){return new Promise((ok,no)=>{const r=indexedDB.open('cloutfit',2);r.onupgradeneeded=()=>{const d=r.result;for(const [n,o] of [['items',{keyPath:'id'}],['outfits',{keyPath:'id'}],['tryons',{keyPath:'id'}],['kv',undefined]])if(!d.objectStoreNames.contains(n))d.createObjectStore(n,o)};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
let dbp=null;const db=()=>dbp||(dbp=idb());
export async function all(store){try{const d=await db();return await new Promise(ok=>{const q=d.transaction(store).objectStore(store).getAll();q.onsuccess=()=>ok(q.result||[]);q.onerror=()=>ok([])})}catch(e){return []}}
export async function put(store,v,key){try{const d=await db();await new Promise(ok=>{const t=d.transaction(store,'readwrite');key===undefined?t.objectStore(store).put(v):t.objectStore(store).put(v,key);t.oncomplete=ok;t.onerror=ok})}catch(e){}}
export async function del(store,id){try{const d=await db();await new Promise(ok=>{const t=d.transaction(store,'readwrite');t.objectStore(store).delete(id);t.oncomplete=ok;t.onerror=ok})}catch(e){}}
export async function get(store,key){try{const d=await db();return await new Promise(ok=>{const q=d.transaction(store).objectStore(store).get(key);q.onsuccess=()=>ok(q.result);q.onerror=()=>ok(undefined)})}catch(e){return undefined}}

/* ---------- flat garment art (for items without photos) ---------- */
const ART={
  tee:'M30 18l-16 10 7 15 9-5v44h40V38l9 5 7-15-16-10c-3 6-10 9-20 9s-17-3-20-9z',
  tank:'M36 14h8c0 6 4 10 6 10s6-4 6-10h8v20c4 6 4 14 2 20v32H34V54c-2-6-2-14 2-20z',
  longsleeve:'M30 18L12 28l-4 50 10 2 6-40v46h52V40l6 40 10-2-4-50-18-10c-3 6-10 9-20 9s-17-3-20-9z',
  shirt:'M30 18L12 28l-4 50 10 2 6-40v46h52V40l6 40 10-2-4-50-18-10-8 4-12 14-12-14z M50 36v50',
  sweater:'M30 18L10 30l-4 48 12 2 6-38v46h52V42l6 38 12-2-4-48-20-12c-4 5-10 7-20 7s-16-2-20-7z',
  hoodie:'M32 20L12 30l-4 48 12 2 6-38v46h48V42l6 38 12-2-4-48-20-10c0-10-8-14-18-14s-18 4-18 14z M38 70h24',
  jacket:'M32 16L12 28l-4 52 12 2 6-40v46h22V36l-8-20z M68 16l20 12 4 52-12 2-6-40v46H52V36l8-20z',
  coat:'M32 12L14 24l-6 56 12 2 6-42v54h22V32l-8-20z M68 12l18 12 6 56-12 2-6-42v54H52V32l8-20z',
  jeans:'M28 12h44l6 78H58L50 40l-8 50H22z',trousers:'M30 12h40l5 78H57L50 38l-7 52H25z',shorts:'M26 18h48l6 46H56l-6-22-6 22H20z',
  skirt:'M34 16h32l14 66H20z',dress:'M38 10h6c0 6 3 9 6 9s6-3 6-9h6l2 22c-2 6-4 10-4 14l18 44H20l18-44c0-4-2-8-4-14z',
  sneakers:'M12 62c6 0 12-4 18-12l10 2c6 8 18 12 34 14 8 1 14 6 14 12v6H12z',boots:'M30 14h22v44c10 4 22 8 30 12v18H22V62c4-14 8-30 8-48z',
  heels:'M14 70c14-2 26-14 36-26 8 4 20 6 32 10 6 2 8 8 4 12H62l-4 12h-6l4-12H14z',beanie:'M18 64c0-22 14-36 32-36s32 14 32 36z M14 64h72v14H14z M50 20a6 6 0 1 1 0 .1',
  cap:'M20 62c0-20 13-32 30-32s30 12 30 32z M50 62h40c0 6-6 10-16 10H50z',
  sandals:'M14 66c10-1 20-6 30-12l8 2c8 6 20 9 32 10 4 1 6 4 6 8v4H14z M30 56l10-14 M46 56l4-14',
  hat:'M14 66c0-6 16-10 36-10s36 4 36 10-16 8-36 8-36-2-36-8z M30 58c0-18 9-28 20-28s20 10 20 28',
  bag:'M22 40h56l-4 46H26z M36 40c0-12 6-18 14-18s14 6 14 18',
  accessory:'M50 20a30 30 0 1 1-.1 0z M50 34a16 16 0 1 0 .1 0z'
};
export function art(type,color){const d=ART[type]||ART.tee,c=color||'#999';return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${d}" fill="${c}" stroke="#14171C" stroke-opacity=".35" stroke-width="1.5" stroke-linejoin="round"/></svg>`}
