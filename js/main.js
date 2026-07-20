(function(){
"use strict";

  window.onerror = function (msg, url, line, col, err) {
    alert(
        "ERROR:\n" +
        msg +
        "\nLine: " + line +
        "\nColumn: " + col
    );
};
  
const THEMES={
  crystal:{name:'Crystal',bg:0x07080b,fog:0x07080b,frame:0xc9a24b,base:0x050507,neutral:0xf5ede0,safe:0xffd700,accent:0xc9a24b,envTop:'#3a3f4d',envBot:'#050506'},
  obsidian:{name:'Obsidian Night',bg:0x0a0514,fog:0x0a0514,frame:0x8b5cf6,base:0x0d0518,neutral:0xe0d5f5,safe:0xa78bfa,accent:0x8b5cf6,envTop:'#4c1d95',envBot:'#0a0514'},
  royal:{name:'Marble Royal',bg:0x1a0f08,fog:0x1a0f08,frame:0xd4a574,base:0x0f0a05,neutral:0xf5e6d3,safe:0xe8b86d,accent:0xd4a574,envTop:'#5c3d2e',envBot:'#1a0f08'},
  emerald:{name:'Emerald Deep',bg:0x051410,fog:0x051410,frame:0x34d399,base:0x051410,neutral:0xd1fae5,safe:0x6ee7b7,accent:0x34d399,envTop:'#064e3b',envBot:'#051410'}
};
let currentTheme='crystal';

const CELL=1.15,HALF_GRID=7;
function gridToWorld(row,col,y){return new THREE.Vector3((col-HALF_GRID)*CELL,y||0,(row-HALF_GRID)*CELL)}

const PATH=[[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
const COLORS=['red','green','yellow','blue'];
const START_IDX={red:0,green:13,yellow:26,blue:39};
const START_COLOR_BY_IDX={0:'red',13:'green',26:'yellow',39:'blue'};
const HOME_STRETCH={red:[[7,1],[7,2],[7,3],[7,4],[7,5]],green:[[1,7],[2,7],[3,7],[4,7],[5,7]],yellow:[[7,13],[7,12],[7,11],[7,10],[7,9]],blue:[[13,7],[12,7],[11,7],[10,7],[9,7]]};
const YARD_CENTER={red:[2.5,2.5],green:[2.5,11.5],yellow:[11.5,11.5],blue:[11.5,2.5]};
const YARD_SLOT_OFFSETS=[[-1.15,-1.15],[1.15,-1.15],[-1.15,1.15],[1.15,1.15]];
const FINISH_OFFSET={red:[-0.32,-0.32],green:[0.32,-0.32],yellow:[0.32,0.32],blue:[-0.32,0.32]};
const SAFE_CELLS=new Set([0,8,13,21,26,34,39,47]);
const HEX={red:0xff1424,green:0x00c752,yellow:0xffd400,blue:0x0080ff};
const HEX_LIGHT={red:0xff8a8f,green:0x7bffb0,yellow:0xfff08a,blue:0x8fc4ff};
const PLAYER_NAMES={red:'الأحمر',green:'الأخضر',yellow:'الأصفر',blue:'الأزرق'};

let scene,camera,renderer,clock,world,diceBody,diceMesh,diceBody2,diceMesh2,boardGroup,mainSpotLight;
let currentGraphicsQuality='high',autoGfx=true,soundEnabled=true,volumeLevel=0.7;
let reduceMotion=false,targetFPS=30,frameInterval=1000/30,lastFrameTime=0;
const pulsingMats=[];
let raycaster,pointer,audioCtx,noiseBuffer;
let cameraMode='classic',sph={radius:22,theta:0,phi:0.35};
const target=new THREE.Vector3(0,0,0);
let pointerDown=false,dragged=false,lastPX=0,lastPY=0,downX=0,downY=0;
let gameMode='passplay',botDifficulty='medium',botColor=null,isBotTurn=false;
let currentPlayerIdx=0,gameState='menu',lastDicePair=null,isDoubleRoll=false;
let diceSettleTimer=0,diceStableFrames=0;
const pawns={};
let currentTurnMoves=[],selectedPawnIdx=null;
let gameStats={moves:0,captures:0,doubles:0};
let playerStats={red:{wins:0,losses:0,bestMoves:999},green:{wins:0,losses:0,bestMoves:999},yellow:{wins:0,losses:0,bestMoves:999},blue:{wins:0,losses:0,bestMoves:999}};
let challengeProgress={target:3,current:0,type:'captures'};

function titleForWins(w){if(w>=10)return'أسطورة الكريستال';if(w>=5)return'سيد اللوحة';if(w>=3)return'محترف';if(w>=1)return'متمرس';return'مبتدئ'}

/* ======================= INIT ======================= */
function init(){
  clock=new THREE.Clock();
  scene=new THREE.Scene();
  const theme=THEMES[currentTheme];
  scene.background=new THREE.Color(theme.bg);
  scene.fog=new THREE.Fog(theme.fog,34,62);
  camera=new THREE.PerspectiveCamera(50,window.innerWidth/window.innerHeight,0.1,100);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  if('outputEncoding'in renderer)renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  document.getElementById('canvas-wrap').appendChild(renderer.domElement);
  raycaster=new THREE.Raycaster();
  pointer=new THREE.Vector2();
  buildLights();
  buildEnvironment();
  buildRoom();
  boardGroup=new THREE.Group();
  scene.add(boardGroup);
  buildBoard();
  buildYards();
  buildExitMarkers();
  buildCellNumbers();
  buildPawns();
  buildDice();
  initPhysics();
  setCameraMode('classic');
  applyGraphicsSettings('high');
  bindUI();
  bindPointer();
  window.addEventListener('resize',onResize);
  setTimeout(detectPerformance,2000);
  document.getElementById('loading').style.opacity='0';
  setTimeout(function(){document.getElementById('loading').remove()},650);
  animate(0);
}

function detectPerformance(){
  if(!autoGfx)return;
  const gl=renderer.getContext();
  const debugInfo=gl.getExtension('WEBGL_debug_renderer_info');
  let isLowEnd=false;
  if(window.devicePixelRatio<2)isLowEnd=true;
  if(window.innerWidth<768)isLowEnd=true;
  if(debugInfo){
    const rendererStr=gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    if(rendererStr&&(rendererStr.includes('SwiftShader')||rendererStr.includes('Software')))isLowEnd=true;
  }
  if(isLowEnd){applyGraphicsSettings('balanced');targetFPS=30;frameInterval=1000/30;}
}

/* ======================= LIGHTS ======================= */
function buildLights(){
  const theme=THEMES[currentTheme];
  const hemi=new THREE.HemisphereLight(0x11141a,0x020305,0.4);
  scene.add(hemi);
  mainSpotLight=new THREE.SpotLight(0xfff5e0,4.5,30,Math.PI/5,0.5,1);
  mainSpotLight.position.set(0,14,0);
  mainSpotLight.castShadow=true;
  mainSpotLight.shadow.mapSize.set(2048,2048);
  mainSpotLight.shadow.bias=-0.0005;
  scene.add(mainSpotLight);
  scene.add(mainSpotLight.target);
  const goldRim=new THREE.DirectionalLight(0xdcba6b,1.2);
  goldRim.position.set(-8,5,-8);
  scene.add(goldRim);
  COLORS.forEach(function(c){
    const[row,col]=YARD_CENTER[c];
    const p=gridToWorld(row,col,0.5);
    const pl=new THREE.PointLight(HEX[c],1.2,5,1.5);
    pl.position.copy(p);
    scene.add(pl);
  });
  const centerGlow=new THREE.PointLight(0xffecc2,2.0,6,2);
  centerGlow.position.set(0,0.8,0);
  scene.add(centerGlow);
}

/* ======================= ENVIRONMENT ======================= */
function buildEnvironment(){
  try{
    const theme=THEMES[currentTheme];
    const pmrem=new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const size=256;
    const c=document.createElement('canvas');c.width=size;c.height=size/2;
    const ctx=c.getContext('2d');
    const grad=ctx.createLinearGradient(0,0,0,size/2);
    grad.addColorStop(0,theme.envTop);
    grad.addColorStop(0.45,'#14161c');
    grad.addColorStop(0.55,'#0d0e12');
    grad.addColorStop(1,theme.envBot);
    ctx.fillStyle=grad;ctx.fillRect(0,0,size,size/2);
    ctx.fillStyle='rgba(201,162,75,0.5)';
    ctx.beginPath();ctx.ellipse(size*0.5,size*0.12,size*0.28,size*0.05,0,0,Math.PI*2);ctx.fill();
    const tex=new THREE.CanvasTexture(c);
    tex.mapping=THREE.EquirectangularReflectionMapping;
    const envRT=pmrem.fromEquirectangular(tex);
    scene.environment=envRT.texture;
    tex.dispose();pmrem.dispose();
  }catch(e){console.warn('env skip',e)}
}

/* ======================= ROOM ======================= */
function makeWoodTexture(){
  const size=512;
  const c=document.createElement('canvas');c.width=size;c.height=size;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#6b4226';ctx.fillRect(0,0,size,size);
  const plankH=size/8;
  for(let p=0;p<8;p++){
    const y=p*plankH;
    const base=92+Math.random()*26;
    ctx.fillStyle=`rgb(${base+18},${base-14},${base-42})`;
    ctx.fillRect(0,y,size,plankH);
    for(let i=0;i<40;i++){
      const gx=Math.random()*size;
      const gw=30+Math.random()*90;
      ctx.strokeStyle=`rgba(40,20,8,${0.05+Math.random()*0.12})`;
      ctx.lineWidth=1+Math.random()*1.5;
      ctx.beginPath();ctx.moveTo(gx,y);ctx.bezierCurveTo(gx+gw*0.3,y+plankH*0.4,gx-gw*0.3,y+plankH*0.6,gx+gw*0.1,y+plankH);ctx.stroke();
    }
    ctx.strokeStyle='rgba(20,10,4,0.5)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y);ctx.stroke();
    for(let s=0;s<4;s++){
      const sx=s*size/4+Math.random()*20;
      ctx.strokeStyle='rgba(20,10,4,0.35)';
      ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx,y+plankH);ctx.stroke();
    }
  }
  const tex=new THREE.CanvasTexture(c);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(6,6);
  return tex;
}

const FLOOR_Y=-0.55;

function buildRoom(){
  const woodTex=makeWoodTexture();
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshPhysicalMaterial({map:woodTex,roughness:0.55,metalness:0.05,clearcoat:0.15,envMapIntensity:0.6}));
  floor.rotation.x=-Math.PI/2;
  floor.position.y=FLOOR_Y;
  floor.receiveShadow=true;
  scene.add(floor);
  COLORS.forEach(c=>buildInfoScreen(c));
}

function buildInfoTexture(color){
  const w=560,h=820;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');
  const hex='#'+HEX[color].toString(16).padStart(6,'0');
  const st=playerStats[color];
  const matches=st.wins+st.losses;
  const bg=ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'#0c1014');bg.addColorStop(1,'#040605');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=4){ctx.fillStyle='rgba(255,255,255,0.015)';ctx.fillRect(0,y,w,2)}
  ctx.shadowColor=hex;ctx.shadowBlur=26;
  ctx.strokeStyle=hex;ctx.lineWidth=5;
  ctx.strokeRect(14,14,w-28,h-28);
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;
  ctx.strokeRect(24,24,w-48,h-48);
  const cx=w/2,avY=208,avR=148;
  ctx.shadowColor=hex;ctx.shadowBlur=34;
  const grad=ctx.createRadialGradient(cx-avR*0.3,avY-avR*0.3,10,cx,avY,avR);
  grad.addColorStop(0,hex);grad.addColorStop(1,'#101010');
  ctx.fillStyle=grad;
  ctx.beginPath();ctx.arc(cx,avY,avR,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(cx,avY,avR-3,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='rgba(6,6,6,0.55)';
  ctx.beginPath();ctx.arc(cx,avY-avR*0.18,avR*0.42,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(cx,avY+avR*0.92,avR*0.85,avR*0.68,0,Math.PI,0);ctx.fill();
  ctx.textAlign='center';
  ctx.shadowColor='#fff';ctx.shadowBlur=8;
  ctx.fillStyle='#f4ede0';
  ctx.font='700 46px "Courier New", monospace';
  ctx.fillText(color.toUpperCase()+' PLAYER',w/2,424);
  ctx.shadowBlur=0;
  ctx.shadowColor=hex;ctx.shadowBlur=16;
  ctx.fillStyle=hex;
  ctx.font='700 30px "Courier New", monospace';
  ctx.fillText(titleForWins(st.wins).toUpperCase(),w/2,466);
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(60,500);ctx.lineTo(w-60,500);ctx.stroke();
  const rows=[['MATCHES',matches],['WINS',st.wins],['LOSSES',st.losses]];
  ctx.font='400 30px "Courier New", monospace';
  rows.forEach(function(r,i){
    const ry=560+i*76;
    ctx.textAlign='left';ctx.fillStyle='#b9c4c9';
    ctx.fillText(r[0],70,ry);
    ctx.textAlign='right';ctx.fillStyle=hex;
    ctx.shadowColor=hex;ctx.shadowBlur=12;
    ctx.font='700 36px "Courier New", monospace';
    ctx.fillText(String(r[1]),w-70,ry);
    ctx.shadowBlur=0;
    ctx.font='400 30px "Courier New", monospace';
  });
  ctx.textAlign='center';
  ctx.fillStyle='rgba(255,255,255,0.35)';
  ctx.font='400 18px "Courier New", monospace';
  ctx.fillText('C R Y S T A L   P A R C H E E S I',w/2,h-36);
  return c;
}

let _glowTex=null;
function getGlowTexture(){
  if(_glowTex)return _glowTex;
  const s=256;const c=document.createElement('canvas');c.width=s;c.height=s;
  const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,0.95)');
  g.addColorStop(0.35,'rgba(255,255,255,0.4)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,s,s);
  _glowTex=new THREE.CanvasTexture(c);
  return _glowTex;
}

const statPanels={};

function buildInfoScreen(color){
  const[row,col]=YARD_CENTER[color];
  const dirWorld=gridToWorld(row,col,0).normalize();
  const dist=19.5;
  const base=dirWorld.clone().multiplyScalar(dist);
  const panelW=7.0,panelH=panelW*(820/560);
  const panelPos=base.clone();
  panelPos.y=FLOOR_Y+0.24+panelH/2;
  const canvas=buildInfoTexture(color);
  const texture=new THREE.CanvasTexture(canvas);
  statPanels[color]={canvas,texture};
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(panelW*1.9,panelH*1.9),new THREE.MeshBasicMaterial({map:getGlowTexture(),color:HEX[color],transparent:true,opacity:0.6,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  halo.position.copy(panelPos);
  halo.lookAt(new THREE.Vector3(0,panelPos.y,0));
  halo.translateZ(-0.4);
  scene.add(halo);
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(panelW,panelH),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));
  panel.position.copy(panelPos);
  panel.lookAt(new THREE.Vector3(0,panelPos.y,0));
  scene.add(panel);
  const bezel=new THREE.Mesh(new THREE.BoxGeometry(panelW+0.3,panelH+0.3,0.18),new THREE.MeshPhysicalMaterial({color:0x0c0d10,metalness:0.6,roughness:0.35}));
  bezel.position.copy(panelPos);
  bezel.lookAt(new THREE.Vector3(0,panelPos.y,0));
  bezel.translateZ(-0.1);
  scene.add(bezel);
  const glowStrip=new THREE.Mesh(new THREE.PlaneGeometry(panelW+0.7,panelH+0.7),new THREE.MeshBasicMaterial({color:HEX[color],transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  glowStrip.position.copy(panelPos);
  glowStrip.lookAt(new THREE.Vector3(0,panelPos.y,0));
  glowStrip.translateZ(-0.18);
  scene.add(glowStrip);
  const bleed=new THREE.PointLight(HEX[color],1.6,11,2);
  bleed.position.copy(panelPos.clone().add(dirWorld.clone().multiplyScalar(-0.8)));
  scene.add(bleed);
  const bleedLow=new THREE.PointLight(HEX[color],1.1,8,2);
  bleedLow.position.set(base.x,FLOOR_Y+0.5,base.z);
  scene.add(bleedLow);
  const foot=new THREE.Mesh(new THREE.BoxGeometry(panelW*0.5,0.2,1.0),new THREE.MeshPhysicalMaterial({color:0x14100a,roughness:0.6,metalness:0.2}));
  foot.position.set(base.x,FLOOR_Y+0.1,base.z);
  foot.castShadow=true;
  scene.add(foot);
}

function refreshInfoScreen(color){
  const p=statPanels[color];
  if(!p)return;
  const ctx=p.canvas.getContext('2d');
  const fresh=buildInfoTexture(color);
  ctx.clearRect(0,0,p.canvas.width,p.canvas.height);
  ctx.drawImage(fresh,0,0);
  p.texture.needsUpdate=true;
}

/* ======================= BOARD ======================= */
function tileMaterial(colorHex,isPath){
  return new THREE.MeshPhysicalMaterial({color:colorHex,transmission:isPath?0.45:0.25,opacity:1,roughness:0.05,metalness:0,thickness:0.8,ior:1.65,clearcoat:1,clearcoatRoughness:0.02,emissive:colorHex,emissiveIntensity:isPath?0.25:0.45,envMapIntensity:1.5});
}

function buildBoard(){
  const theme=THEMES[currentTheme];
  const span=15*CELL+1.4;
  const frame=new THREE.Mesh(new THREE.BoxGeometry(span+0.8,0.6,span+0.8),new THREE.MeshPhysicalMaterial({color:theme.frame,metalness:1,roughness:0.22,clearcoat:0.6,clearcoatRoughness:0.1,envMapIntensity:2}));
  frame.position.y=-0.3;
  frame.receiveShadow=true;
  boardGroup.add(frame);
  const base=new THREE.Mesh(new THREE.BoxGeometry(span,0.36,span),new THREE.MeshPhysicalMaterial({color:theme.base,roughness:0.1,metalness:0.1,clearcoat:1,clearcoatRoughness:0.05,envMapIntensity:1.2}));
  base.position.y=-0.04;
  base.receiveShadow=true;
  boardGroup.add(base);
  const neutralMat=tileMaterial(theme.neutral,true);
  PATH.forEach(function(rc,i){
    const startColor=START_COLOR_BY_IDX[i];
    let mat;
    if(startColor)mat=tileMaterial(HEX[startColor],true);
    else if(SAFE_CELLS.has(i))mat=tileMaterial(theme.safe,true);
    else mat=neutralMat;
    if(startColor||SAFE_CELLS.has(i)){mat.userData.baseEmissive=mat.emissiveIntensity;pulsingMats.push(mat)}
    addTile(rc[0],rc[1],mat,SAFE_CELLS.has(i)&&!startColor);
  });
  COLORS.forEach(function(c){HOME_STRETCH[c].forEach(function(rc){addTile(rc[0],rc[1],tileMaterial(HEX[c],true),false)})});
  buildCenterTrophy();
}

function buildCenterTrophy(){
  const theme=THEMES[currentTheme];
  const gold=new THREE.MeshPhysicalMaterial({color:theme.accent,metalness:1,roughness:0.22,clearcoat:0.7,clearcoatRoughness:0.15,emissive:0x5c4413,emissiveIntensity:0.28,envMapIntensity:1.6});
  gold.userData.baseEmissive=gold.emissiveIntensity;
  pulsingMats.push(gold);
  const group=new THREE.Group();
  const plinth=new THREE.Mesh(new THREE.BoxGeometry(CELL*3*0.95,0.14,CELL*3*0.95),new THREE.MeshPhysicalMaterial({color:0x1a1c22,metalness:0.7,roughness:0.3}));
  plinth.position.set(0,0.02,0);
  boardGroup.add(plinth);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.56,0.14,28),gold);
  base.position.y=0.14;
  base.castShadow=true;
  group.add(base);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.16,0.4,20),gold);
  stem.position.y=0.14+0.07+0.2;
  stem.castShadow=true;
  group.add(stem);
  const cupBaseY=0.14+0.14+0.4-0.01;
  const cupPts=[new THREE.Vector2(0.15,0),new THREE.Vector2(0.19,0.05),new THREE.Vector2(0.33,0.18),new THREE.Vector2(0.47,0.34),new THREE.Vector2(0.54,0.5),new THREE.Vector2(0.51,0.66),new THREE.Vector2(0.43,0.8),new THREE.Vector2(0.35,0.92),new THREE.Vector2(0.29,1.0),new THREE.Vector2(0.33,1.06),new THREE.Vector2(0.30,1.1)];
  const cup=new THREE.Mesh(new THREE.LatheGeometry(cupPts,40),gold);
  cup.position.y=cupBaseY;
  cup.castShadow=true;
  group.add(cup);
  [-1,1].forEach(function(side){
    const handle=new THREE.Mesh(new THREE.TorusGeometry(0.34,0.045,12,28,Math.PI*1.3),gold);
    handle.rotation.y=Math.PI/2;
    handle.position.set(side*0.62,cupBaseY+0.42,0);
    handle.castShadow=true;
    group.add(handle);
  });
  const finial=new THREE.Mesh(new THREE.SphereGeometry(0.09,16,16),gold);
  finial.position.y=cupBaseY+1.16;
  group.add(finial);
  boardGroup.add(group);
  const trophyLight=new THREE.PointLight(0xfff2cf,1.4,6,2);
  trophyLight.position.set(0,cupBaseY+1.2,0);
  boardGroup.add(trophyLight);
}

function addTile(row,col,mat,glow){
  const geo=new THREE.BoxGeometry(CELL*0.9,0.16,CELL*0.9);
  const mesh=new THREE.Mesh(geo,mat);
  const p=gridToWorld(row,col,0.1);
  mesh.position.copy(p);
  mesh.receiveShadow=true;
  mesh.castShadow=false;
  boardGroup.add(mesh);
  if(glow){
    const ring=new THREE.Mesh(new THREE.RingGeometry(CELL*0.32,CELL*0.4,5),new THREE.MeshBasicMaterial({color:0xfff6df,transparent:true,opacity:0.55,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;
    ring.position.set(p.x,0.185,p.z);
    boardGroup.add(ring);
  }
}

function buildExitMarkers(){
  COLORS.forEach(function(c){
    const startRC=PATH[START_IDX[c]];
    const p=gridToWorld(startRC[0],startRC[1],0.2);
    const outline=new THREE.Mesh(new THREE.PlaneGeometry(CELL*0.74,CELL*0.74),new THREE.MeshBasicMaterial({color:0xc9a24b,side:THREE.DoubleSide}));
    outline.rotation.set(-Math.PI/2,0,Math.PI/4);
    outline.position.set(p.x,p.y-0.006,p.z);
    boardGroup.add(outline);
    const diamond=new THREE.Mesh(new THREE.PlaneGeometry(CELL*0.6,CELL*0.6),new THREE.MeshPhysicalMaterial({color:HEX[c],emissive:HEX[c],emissiveIntensity:0.55,roughness:0.15,clearcoat:1,side:THREE.DoubleSide}));
    diamond.rotation.set(-Math.PI/2,0,Math.PI/4);
    diamond.position.copy(p);
    boardGroup.add(diamond);
  });
}

function buildCellNumbers(){
  PATH.forEach(function(rc,i){
    const c=document.createElement('canvas');c.width=96;c.height=96;
    const ctx=c.getContext('2d');
    ctx.fillStyle='rgba(0,0,0,0)';ctx.fillRect(0,0,96,96);
    ctx.fillStyle='rgba(60,45,15,0.8)';
    ctx.font='700 46px Georgia, serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(i+1),48,50);
    const tex=new THREE.CanvasTexture(c);
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(CELL*0.22,CELL*0.22),mat);
    plane.rotation.x=-Math.PI/2;
    const corner=CELL*0.28;
    const p=gridToWorld(rc[0],rc[1],0.196);
    plane.position.set(p.x+corner,p.y,p.z-corner);
    boardGroup.add(plane);
  });
}

function buildYards(){
  COLORS.forEach(function(c){
    const[row,col]=YARD_CENTER[c];
    const p=gridToWorld(row,col,0.02);
    const mat=new THREE.MeshPhysicalMaterial({color:HEX[c],transmission:0.28,roughness:0.1,thickness:0.8,ior:1.5,clearcoat:1,emissive:HEX[c],emissiveIntensity:0.4,envMapIntensity:0.7});
    const plate=new THREE.Mesh(new THREE.BoxGeometry(CELL*5.2,0.22,CELL*5.2),mat);
    plate.position.set(p.x,0.09,p.z);
    plate.receiveShadow=true;
    boardGroup.add(plate);
    const innerMat=new THREE.MeshPhysicalMaterial({color:0x0e0f13,roughness:0.4,metalness:0.2,clearcoat:0.5});
    const inner=new THREE.Mesh(new THREE.BoxGeometry(CELL*3.9,0.05,CELL*3.9),innerMat);
    inner.position.set(p.x,0.21,p.z);
    boardGroup.add(inner);
    YARD_SLOT_OFFSETS.forEach(function(off){
      const slotGeo=new THREE.RingGeometry(0.34,0.42,24);
      const slotMesh=new THREE.Mesh(slotGeo,new THREE.MeshBasicMaterial({color:HEX_LIGHT[c],transparent:true,opacity:0.6,side:THREE.DoubleSide}));
      slotMesh.rotation.x=-Math.PI/2;
      slotMesh.position.set(p.x+off[0]*1.05,0.24,p.z+off[1]*1.05);
      boardGroup.add(slotMesh);
    });
  });
}

/* ======================= PAWNS ======================= */
function pawnMaterial(colorHex){
  return new THREE.MeshPhysicalMaterial({color:colorHex,transmission:0.3,roughness:0.06,thickness:0.9,ior:1.6,clearcoat:1,clearcoatRoughness:0.05,emissive:colorHex,emissiveIntensity:0.5,envMapIntensity:0.8});
}

function buildPawns(){
  COLORS.forEach(function(c){
    pawns[c]=[];
    const mat=pawnMaterial(HEX[c]);
    for(let i=0;i<4;i++){
      const group=new THREE.Group();
      const gem=new THREE.Mesh(new THREE.OctahedronGeometry(0.26,0),mat);
      gem.position.y=0.42;
      gem.castShadow=true;
      gem.scale.y=1.35;
      const base=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.27,0.14,16),new THREE.MeshPhysicalMaterial({color:0x181a20,metalness:0.8,roughness:0.25}));
      base.position.y=0.14;
      base.castShadow=true;
      group.add(gem);group.add(base);
      group.userData={color:c,index:i};
      boardGroup.add(group);
      const pawn={mesh:group,gem:gem,k:-1,slot:i};
      pawns[c].push(pawn);
      placePawnAtYard(pawn,c);
    }
  });
}

function placePawnAtYard(pawn,color){
  const[row,col]=YARD_CENTER[color];
  const off=YARD_SLOT_OFFSETS[pawn.slot];
  const p=gridToWorld(row,col,0);
  pawn.mesh.position.set(p.x+off[0]*1.05,0,p.z+off[1]*1.05);
}

function cellWorldPos(color,k){
  if(k<0){const[row,col]=YARD_CENTER[color];return gridToWorld(row,col,0)}
  if(k<=50){const idx=(START_IDX[color]+k)%52;const rc=PATH[idx];return gridToWorld(rc[0],rc[1],0)}
  if(k<=55){const rc=HOME_STRETCH[color][k-51];return gridToWorld(rc[0],rc[1],0)}
  const off=FINISH_OFFSET[color];
  return new THREE.Vector3(off[0]*1.3,0,off[1]*1.3);
}

/* ======================= DICE + PHYSICS ======================= */
function makeDieFaceTexture(n){
  const size=256;
  const c=document.createElement('canvas');c.width=size;c.height=size;
  const ctx=c.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,size,size);
  grad.addColorStop(0,'#fdf8ec');
  grad.addColorStop(1,'#eadfc4');
  ctx.fillStyle=grad;ctx.fillRect(0,0,size,size);
  ctx.strokeStyle='rgba(120,95,40,0.35)';ctx.lineWidth=6;
  ctx.strokeRect(6,6,size-12,size-12);
  ctx.fillStyle='#2a1f0f';
  const dot=function(x,y){ctx.beginPath();ctx.arc(x,y,20,0,Math.PI*2);ctx.fill()};
  const q=size*0.25,h=size*0.5,t=size*0.75;
  const layouts={1:[[h,h]],2:[[q,q],[t,t]],3:[[q,q],[h,h],[t,t]],4:[[q,q],[t,q],[q,t],[t,t]],5:[[q,q],[t,q],[h,h],[q,t],[t,t]],6:[[q,q],[t,q],[q,h],[t,h],[q,t],[t,t]]};
  layouts[n].forEach(p=>dot(p[0],p[1]));
  const tex=new THREE.CanvasTexture(c);
  tex.needsUpdate=true;
  return tex;
}

const DICE_FACE_VALUES=[1,6,2,5,3,4];

function buildDice(){
  const size=0.34;
  const geo=new THREE.BoxGeometry(size,size,size,1,1,1);
  const mats=DICE_FACE_VALUES.map(v=>new THREE.MeshPhysicalMaterial({map:makeDieFaceTexture(v),roughness:0.15,clearcoat:1,clearcoatRoughness:0.1,envMapIntensity:1.2}));
  diceMesh=new THREE.Mesh(geo,mats);
  diceMesh.castShadow=true;
  diceMesh.position.set(-0.3,6,0);
  boardGroup.add(diceMesh);
  diceMesh2=new THREE.Mesh(geo,mats);
  diceMesh2.castShadow=true;
  diceMesh2.position.set(0.3,6,0);
  boardGroup.add(diceMesh2);
}

function initPhysics(){
  world=new CANNON.World();
  world.gravity.set(0,-22,0);
  world.broadphase=new CANNON.NaiveBroadphase();
  world.solver.iterations=12;
  const groundMat=new CANNON.Material('ground');
  const diceMat=new CANNON.Material('dice');
  const contact=new CANNON.ContactMaterial(groundMat,diceMat,{friction:0.2,restitution:0.55});
  world.addContactMaterial(contact);
  const span=15*CELL;
  const groundBody=new CANNON.Body({mass:0,material:groundMat});
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI/2,0,0);
  groundBody.position.set(0,0.25,0);
  world.addBody(groundBody);
  const wallH=4,wallT=1.0;
  const safetyMargin=span/2-0.2;
  const wallDefs=[
    {pos:[0,wallH/2,-safetyMargin-wallT/2],size:[span/2,wallH/2,wallT/2]},
    {pos:[0,wallH/2,safetyMargin+wallT/2],size:[span/2,wallH/2,wallT/2]},
    {pos:[-safetyMargin-wallT/2,wallH/2,0],size:[wallT/2,wallH/2,span/2]},
    {pos:[safetyMargin+wallT/2,wallH/2,0],size:[wallT/2,wallH/2,span/2]}
  ];
  wallDefs.forEach(function(w){
    const body=new CANNON.Body({mass:0,material:groundMat});
    body.addShape(new CANNON.Box(new CANNON.Vec3(w.size[0],w.size[1],w.size[2])));
    body.position.set(w.pos[0],w.pos[1],w.pos[2]);
    world.addBody(body);
  });
  const s=0.17;
  diceBody=new CANNON.Body({mass:1.2,material:diceMat,angularDamping:0.25,linearDamping:0.1});
  diceBody.addShape(new CANNON.Box(new CANNON.Vec3(s,s,s)));
  world.addBody(diceBody);
  diceBody2=new CANNON.Body({mass:1.2,material:diceMat,angularDamping:0.25,linearDamping:0.1});
  diceBody2.addShape(new CANNON.Box(new CANNON.Vec3(s,s,s)));
  world.addBody(diceBody2);
  let lastSoundTime=0;
  const handleCollision=function(e){
    const now=performance.now();
    const impact=Math.min(1,(e.contact?Math.abs(e.contact.getImpactVelocityAlongNormal()):3)/9);
    if(now-lastSoundTime>90&&impact>0.04){playThud(impact);lastSoundTime=now}
  };
  diceBody.addEventListener('collide',handleCollision);
  diceBody2.addEventListener('collide',handleCollision);
}

function rollDice(){
  if(gameState!=='awaiting_roll')return;
  ensureAudio();
  gameState='rolling';
  setRollBtnEnabled(false);
  const diceFaceEl=document.getElementById('dice-face');
  diceFaceEl.textContent='–';
  diceFaceEl.style.fontSize='';
  clearMovableHighlights();
  gameStats.moves++;
  const span=15*CELL/2-2.0;
  const x1=(Math.random()-0.5)*span-0.5;
  const z1=(Math.random()-0.5)*span;
  diceBody.wakeUp();
  diceBody.position.set(x1,5.5+Math.random()*1.5,z1);
  diceBody.velocity.set((Math.random()-0.5)*4,-2,(Math.random()-0.5)*4);
  diceBody.angularVelocity.set((Math.random()-0.5)*22,(Math.random()-0.5)*22,(Math.random()-0.5)*22);
  diceBody.quaternion.setFromEuler(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
  const x2=(Math.random()-0.5)*span+0.5;
  const z2=(Math.random()-0.5)*span;
  diceBody2.wakeUp();
  diceBody2.position.set(x2,5.5+Math.random()*1.5,z2);
  diceBody2.velocity.set((Math.random()-0.5)*4,-2,(Math.random()-0.5)*4);
  diceBody2.angularVelocity.set((Math.random()-0.5)*22,(Math.random()-0.5)*22,(Math.random()-0.5)*22);
  diceBody2.quaternion.setFromEuler(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
  diceStableFrames=0;
  diceSettleTimer=0;
}
window.rollDice=rollDice;

function readSingleDiceFace(mesh){
  const up=new THREE.Vector3(0,1,0);
  const q=mesh.quaternion;
  const normals=[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)];
  let best=-Infinity,bestI=0;
  normals.forEach(function(n,i){const wn=n.clone().applyQuaternion(q);const d=wn.dot(up);if(d>best){best=d;bestI=i}});
  return DICE_FACE_VALUES[bestI];
}

/* ======================= BOT AI ======================= */
function getBotMove(){
  const color=currentColor();
  const moves=currentTurnMoves.slice();
  if(moves.length===0)return null;

  const validMoves=[];
  pawns[color].forEach(function(pawn,idx){
    moves.forEach(function(move){
      if(canMovePawn(color,idx,move)){
        validMoves.push({pawnIdx:idx,move:move,score:evaluateMove(color,idx,move)});
      }
    });
  });

  if(validMoves.length===0)return null;

  validMoves.sort(function(a,b){return b.score-a.score;});

  if(botDifficulty==='easy'){
    return validMoves[Math.floor(Math.random()*validMoves.length)];
  }else if(botDifficulty==='medium'){
    if(Math.random()<0.7)return validMoves[0];
    return validMoves[Math.floor(Math.random()*validMoves.length)];
  }else{
    return validMoves[0];
  }
}

function evaluateMove(color,pawnIdx,steps){
  const pawn=pawns[color][pawnIdx];
  let score=0;
  const fromK=pawn.k;
  const toK=fromK===-1?0:fromK+steps;

  if(fromK===-1&&steps===6)score+=100;

  if(toK>=0&&toK<=50){
    const globalIdx=(START_IDX[color]+toK)%52;
    if(!SAFE_CELLS.has(globalIdx)){
      COLORS.forEach(function(oc){
        if(oc===color)return;
        pawns[oc].forEach(function(op){
          if(op.k<0||op.k>50)return;
          const og=(START_IDX[oc]+op.k)%52;
          if(og===globalIdx)score+=80;
        });
      });
    }
  }

  if(toK>50&&toK<=55)score+=60;
  if(toK===56)score+=200;

  if(toK>=0&&toK<=50){
    const globalIdx=(START_IDX[color]+toK)%52;
    if(SAFE_CELLS.has(globalIdx))score+=40;
  }

  if(fromK>=0&&fromK<=50){
    const currentGlobal=(START_IDX[color]+fromK)%52;
    COLORS.forEach(function(oc){
      if(oc===color)return;
      pawns[oc].forEach(function(op){
        if(op.k<0||op.k>50)return;
        const og=(START_IDX[oc]+op.k)%52;
        const dist=(currentGlobal-og+52)%52;
        if(dist<=6&&dist>0)score+=30;
      });
    });
  }

  if(toK>fromK)score+=toK*2;
  if(botDifficulty==='medium')score+=Math.random()*10;

  return score;
}

function canMovePawn(color,idx,roll){
  const pawn=pawns[color][idx];
  if(pawn.k===-1)return roll===6;
  if(pawn.k>=56)return false;
  const newK=pawn.k+roll;
  return newK<=56;
}

function executeBotMove(){
  const botMove=getBotMove();
  if(!botMove){
    showMsg('البوت ليس لديه حركات متاحة');
    setTimeout(function(){advanceTurn()},1300);
    return;
  }

  const usedAt=currentTurnMoves.indexOf(botMove.move);
  if(usedAt>-1)currentTurnMoves.splice(usedAt,1);

  clearMovableHighlights();
  gameState='animating';
  const pawn=pawns[currentColor()][botMove.pawnIdx];
  const fromK=pawn.k;
  const toK=fromK===-1?0:fromK+botMove.move;

  const waypoints=[];
  if(fromK===-1)waypoints.push(0);
  else for(let k=fromK+1;k<=toK;k++)waypoints.push(k);

  animateAlong(pawn,currentColor(),waypoints,function(){
    pawn.k=toK;
    const captured=handleCapture(currentColor(),toK);
    if(toK===56)playChimeUp();else if(captured)playCapture();else playHop();
    if(captured)gameStats.captures++;
    if(checkWin(currentColor())){showWin(currentColor());gameState='over';return}
    gameState='awaiting_move';
    evaluateAvailableMoves();
  });
}

/* ======================= GAME LOGIC ======================= */
function currentColor(){return COLORS[currentPlayerIdx]}

function computeMovable(color,roll){
  const list=[];
  pawns[color].forEach(function(pawn,i){
    if(pawn.k===-1){if(roll===6)list.push(i)}
    else if(pawn.k<56){const newK=pawn.k+roll;if(newK<=56)list.push(i)}
  });
  return list;
}

function clearMovableHighlights(){
  COLORS.forEach(c=>pawns[c].forEach(function(p){p._pulse=false;p.mesh.scale.set(1,1,1)}));
}

function highlightMovable(color,indices){
  indices.forEach(function(i){pawns[color][i]._pulse=true});
}

function onDiceSettled(){
  const r1=readSingleDiceFace(diceMesh);
  const r2=readSingleDiceFace(diceMesh2);
  lastDicePair=[r1,r2];
  isDoubleRoll=(r1===r2);
  if(isDoubleRoll)gameStats.doubles++;

  const diceFaceEl=document.getElementById('dice-face');
  diceFaceEl.textContent=r1+' + '+r2;
  diceFaceEl.style.fontSize='20px';

  // حركتان فقط دائماً [r1, r2]
  currentTurnMoves=[r1,r2];

  gameState='awaiting_move';
  evaluateAvailableMoves();
}

function evaluateAvailableMoves(){
  clearMovableHighlights();
  const color=currentColor();

  if(currentTurnMoves.length===0){
    advanceTurn();
    return;
  }

  let totalValidPawns=[];
  currentTurnMoves.forEach(function(move){
    computeMovable(color,move).forEach(function(pIdx){
      if(totalValidPawns.indexOf(pIdx)===-1)totalValidPawns.push(pIdx);
    });
  });

  if(totalValidPawns.length===0){
    showMsg('لا يوجد حركات متاحة — ينتقل الدور');
    gameState='awaiting_move';
    setTimeout(function(){advanceTurn()},1300);
  }else{
    highlightMovable(color,totalValidPawns);
    showMsg('انقر على الحجر المضيء — النرد المتبقي: '+currentTurnMoves.join(', '));

    if(gameMode!=='passplay'&&isBotTurn){
      document.getElementById('bot-thinking').classList.add('show');
      setTimeout(function(){
        document.getElementById('bot-thinking').classList.remove('show');
        executeBotMove();
      },1000+Math.random()*1000);
    }
  }
}

function tryMovePawn(color,idx){
  if(gameState!=='awaiting_move')return;
  if(color!==currentColor())return;
  if(gameMode!=='passplay'&&isBotTurn)return;

  const validMoves=currentTurnMoves.filter(move=>computeMovable(color,move).indexOf(idx)!==-1);
  if(validMoves.length===0)return;

  const uniqueMoves=validMoves.filter(function(v,i){return validMoves.indexOf(v)===i;});
  if(uniqueMoves.length===1){
    executeMove(color,idx,uniqueMoves[0]);
  }else{
    showMovePickerUI(color,idx,uniqueMoves);
  }
}

function executeMove(color,idx,steps){
  const usedAt=currentTurnMoves.indexOf(steps);
  if(usedAt>-1)currentTurnMoves.splice(usedAt,1);

  clearMovableHighlights();
  gameState='animating';
  const pawn=pawns[color][idx];
  const fromK=pawn.k;
  const toK=fromK===-1?0:fromK+steps;

  const waypoints=[];
  if(fromK===-1)waypoints.push(0);
  else for(let k=fromK+1;k<=toK;k++)waypoints.push(k);

  animateAlong(pawn,color,waypoints,function(){
    pawn.k=toK;
    const captured=handleCapture(color,toK);
    if(toK===56)playChimeUp();else if(captured)playCapture();else playHop();
    if(captured)gameStats.captures++;

    if(gameMode==='challenge'&&captured){
      challengeProgress.current++;
      updateChallengeHUD();
    }

    if(checkWin(color)){showWin(color);gameState='over';return}
    gameState='awaiting_move';
    evaluateAvailableMoves();
  });
}

function showMovePickerUI(color,pawnIdx,options){
  const oldPicker=document.getElementById('move-picker');
  if(oldPicker)oldPicker.remove();

  const hexStr='#'+HEX[color].toString(16).padStart(6,'0');
  const picker=document.createElement('div');
  picker.id='move-picker';
  picker.style.position='fixed';
  picker.style.top='50%';
  picker.style.left='50%';
  picker.style.transform='translate(-50%,-50%)';
  picker.style.background='rgba(15,16,20,0.95)';
  picker.style.border='2px solid '+hexStr;
  picker.style.padding='18px 20px';
  picker.style.borderRadius='14px';
  picker.style.color='#f4ede0';
  picker.style.textAlign='center';
  picker.style.fontFamily="'Inter', sans-serif";
  picker.style.zIndex='999';
  picker.style.boxShadow='0 12px 40px rgba(0,0,0,.6)';
  picker.innerHTML='<p style="margin:0 0 12px 0; font-size:13px; letter-spacing:.4px; color:#cfc9bc;">حرك هذا الحجر بـ:</p>';

  options.forEach(function(steps){
    const btn=document.createElement('button');
    btn.textContent=steps+' خطوات';
    btn.className='move-picker-btn';
    btn.style.margin='0 6px';
    btn.style.background=hexStr;
    btn.style.color='#101116';
    btn.onclick=function(){picker.remove();executeMove(color,pawnIdx,steps)};
    picker.appendChild(btn);
  });

  document.body.appendChild(picker);
}

function handleCapture(color,k){
  if(k<0||k>50)return false;
  const globalIdx=(START_IDX[color]+k)%52;
  if(SAFE_CELLS.has(globalIdx))return false;
  let captured=false;
  COLORS.forEach(function(oc){
    if(oc===color)return;
    pawns[oc].forEach(function(op){
      if(op.k<0||op.k>50)return;
      const og=(START_IDX[oc]+op.k)%52;
      if(og===globalIdx){op.k=-1;placePawnAtYard(op,oc);captured=true}
    });
  });
  return captured;
}

function checkWin(color){
  return pawns[color].every(p=>p.k===56);
}

function advanceTurn(){
  currentPlayerIdx=(currentPlayerIdx+1)%4;
  if(gameMode==='bot'){
    isBotTurn=(currentPlayerIdx===COLORS.indexOf(botColor));
  }else if(gameMode==='challenge'){
    isBotTurn=(currentPlayerIdx!==0);
  }

  gameState='awaiting_roll';
  setRollBtnEnabled(true);
  updateTurnUI();

  if(gameMode!=='passplay'&&isBotTurn&&gameState==='awaiting_roll'){
    setTimeout(function(){if(gameState==='awaiting_roll')rollDice()},800+Math.random()*700);
  }
}

/* ======================= ANIMATION ======================= */
function animateAlong(pawn,color,waypoints,onDone){
  let i=0;
  function stepNext(){
    if(i>=waypoints.length){onDone&&onDone();return}
    const targetPos=cellWorldPos(color,waypoints[i]);
    const from=pawn.mesh.position.clone();
    const dur=reduceMotion?100:190;
    const t0=performance.now();
    function tick(){
      const t=Math.min(1,(performance.now()-t0)/dur);
      const ease=t<0.5?2*t*t:-1+(4-2*t)*t;
      pawn.mesh.position.lerpVectors(from,targetPos,ease);
      pawn.mesh.position.y=Math.sin(Math.PI*t)*0.35;
      if(t<1){requestAnimationFrame(tick)}
      else{pawn.mesh.position.copy(targetPos);pawn.mesh.position.y=0;i++;stepNext()}
    }
    requestAnimationFrame(tick);
  }
  stepNext();
}

/* ======================= UI FUNCTIONS ======================= */
let msgTimer=null;
function showMsg(text){
  const el=document.getElementById('msg');
  el.textContent=text;
  el.classList.add('show');
  if(msgTimer)clearTimeout(msgTimer);
  msgTimer=setTimeout(function(){el.classList.remove('show')},2600);
}

function setRollBtnEnabled(v){
  document.getElementById('roll-btn').disabled=!v;
}

function updateTurnUI(){
  const c=currentColor();
  const dot=document.getElementById('turn-dot');
  dot.style.background='#'+HEX[c].toString(16).padStart(6,'0');
  dot.style.color='#'+HEX[c].toString(16).padStart(6,'0');
  const label=document.getElementById('turn-label');
  let modeText='Pass & Play';
  if(gameMode==='bot')modeText='ضد البوت ('+botDifficulty+')';
  if(gameMode==='challenge')modeText='التحدي اليومي';
  label.innerHTML=PLAYER_NAMES[c]+' دور <span class="sub">'+modeText+'</span>';
}

function updateChallengeHUD(){
  const el=document.getElementById('challenge-hud');
  if(gameMode!=='challenge'){el.classList.remove('show');return}
  el.classList.add('show');
  const progress=el.querySelector('.ch-progress');
  progress.textContent=challengeProgress.current+' / '+challengeProgress.target+' '+(challengeProgress.type==='captures'?'تقاط':'رمية');
}

function showWin(color){
  playerStats[color].wins++;
  COLORS.forEach(function(c){if(c!==color)playerStats[c].losses++});
  if(gameStats.moves<playerStats[color].bestMoves)playerStats[color].bestMoves=gameStats.moves;
  COLORS.forEach(c=>refreshInfoScreen(c));

  const overlay=document.getElementById('win-overlay');
  document.getElementById('win-title').textContent=PLAYER_NAMES[color]+' فاز!';
  document.getElementById('win-title').style.color='#'+HEX[color].toString(16).padStart(6,'0');
  document.getElementById('win-sub').textContent='وصلت 4 أحجار إلى قلب الكريستال — الآن '+titleForWins(playerStats[color].wins);
  document.getElementById('win-moves').textContent=gameStats.moves;
  document.getElementById('win-captures').textContent=gameStats.captures;
  document.getElementById('win-doubles').textContent=gameStats.doubles;
  overlay.classList.add('show');
  playWinJingle();
}

function resetGame(){
  COLORS.forEach(function(c){pawns[c].forEach(function(p){p.k=-1;placePawnAtYard(p,c)})});
  currentPlayerIdx=0;
  gameState='awaiting_roll';
  lastDicePair=null;
  isDoubleRoll=false;
  currentTurnMoves=[];
  selectedPawnIdx=null;
  gameStats={moves:0,captures:0,doubles:0};
  challengeProgress={target:3,current:0,type:'captures'};
  const oldPicker=document.getElementById('move-picker');
  if(oldPicker)oldPicker.remove();
  const diceFaceEl=document.getElementById('dice-face');
  diceFaceEl.textContent='–';
  diceFaceEl.style.fontSize='';
  document.getElementById('win-overlay').classList.remove('show');
  setRollBtnEnabled(true);
  clearMovableHighlights();
  updateTurnUI();
  updateChallengeHUD();

  if(gameMode==='bot'){
    isBotTurn=(currentPlayerIdx===COLORS.indexOf(botColor));
  }else if(gameMode==='challenge'){
    isBotTurn=(currentPlayerIdx!==0);
  }else{
    isBotTurn=false;
  }
}

/* ======================= MENU FUNCTIONS ======================= */
window.showModeSelect=function(){
  document.getElementById('mode-select').classList.add('show');
};
window.hideModeSelect=function(){
  document.getElementById('mode-select').classList.remove('show');
};
window.showDiffSelect=function(){
  document.getElementById('diff-select').classList.add('show');
};
window.hideDiffSelect=function(){
  document.getElementById('diff-select').classList.remove('show');
};
window.showSettings=function(){
  document.getElementById('settings-panel').classList.add('show');
};
window.hideSettings=function(){
  document.getElementById('settings-panel').classList.remove('show');
};
window.showHelpFromMenu=function(){
  document.getElementById('help-panel').classList.add('show');
};
window.toggleHelp=function(){
  document.getElementById('help-panel').classList.toggle('show');
};
window.showPauseMenu=function(){
  document.getElementById('pause-menu').classList.add('show');
};
window.resumeGame=function(){
  document.getElementById('pause-menu').classList.remove('show');
};
window.restartGame=function(){
  document.getElementById('pause-menu').classList.remove('show');
  resetGame();
};
window.playAgain=function(){
  document.getElementById('win-overlay').classList.remove('show');
  resetGame();
};
window.quitToMenu=function(){
  document.getElementById('pause-menu').classList.remove('show');
  document.getElementById('win-overlay').classList.remove('show');
  document.getElementById('settings-panel').classList.remove('show');
  document.getElementById('help-panel').classList.remove('show');
  document.getElementById('main-menu').classList.remove('hidden');
  document.getElementById('top-bar').style.display='none';
  document.getElementById('bottom-bar').style.display='none';
  document.getElementById('camera-controls').style.display='none';
  document.getElementById('help-btn').style.display='none';
  document.getElementById('challenge-hud').classList.remove('show');
  const oldPicker=document.getElementById('move-picker');
  if(oldPicker)oldPicker.remove();
  gameState='menu';
};

window.startGame=function(mode,difficulty){
  gameMode=mode;
  if(difficulty)botDifficulty=difficulty;

  if(mode==='bot'){
    botColor='green';
  }

  document.getElementById('mode-select').classList.remove('show');
  document.getElementById('diff-select').classList.remove('show');
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('top-bar').style.display='flex';
  document.getElementById('bottom-bar').style.display='flex';
  document.getElementById('camera-controls').style.display='flex';
  document.getElementById('help-btn').style.display='flex';

  resetGame();
};

window.startChallenge=function(){
  gameMode='challenge';
  const types=['captures','doubles','quick'];
  const type=types[Math.floor(Math.random()*types.length)];
  if(type==='captures')challengeProgress={target:3,current:0,type:'captures'};
  else if(type==='doubles')challengeProgress={target:2,current:0,type:'doubles'};
  else challengeProgress={target:15,current:0,type:'moves'};

  document.getElementById('mode-select').classList.remove('show');
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('top-bar').style.display='flex';
  document.getElementById('bottom-bar').style.display='flex';
  document.getElementById('camera-controls').style.display='flex';
  document.getElementById('help-btn').style.display='flex';

  resetGame();
  updateChallengeHUD();
};

/* ======================= SETTINGS FUNCTIONS ======================= */
window.selectTheme=function(el,themeName){
  document.querySelectorAll('.color-option').forEach(function(o){o.classList.remove('selected');o.querySelector('.check')?.remove()});
  el.classList.add('selected');
  const check=document.createElement('div');
  check.className='check';
  check.textContent='✓';
  el.appendChild(check);
  currentTheme=themeName;
  rebuildScene();
};

function rebuildScene(){
  while(boardGroup.children.length>0)boardGroup.remove(boardGroup.children[0]);
  pulsingMats.length=0;

  const theme=THEMES[currentTheme];
  scene.background=new THREE.Color(theme.bg);
  scene.fog=new THREE.Fog(theme.fog,34,62);

  buildBoard();
  buildYards();
  buildExitMarkers();
  buildCellNumbers();
  buildPawns();
  buildDice();

  COLORS.forEach(function(c){pawns[c].forEach(function(p){p.k=-1;placePawnAtYard(p,c)})});
}

window.toggleAutoGfx=function(el){
  el.classList.toggle('on');
  autoGfx=el.classList.contains('on');
};
window.setManualQuality=function(q){
  document.querySelectorAll('.gfx-mini').forEach(function(b){b.style.background='rgba(255,255,255,.05)';b.style.color='#cfc9bc'});
  document.querySelector('.gfx-mini[data-q="'+q+'"]').style.background='#c9a24b';
  document.querySelector('.gfx-mini[data-q="'+q+'"]').style.color='#141414';
  applyGraphicsSettings(q);
};
window.toggleSound=function(el){
  el.classList.toggle('on');
  soundEnabled=el.classList.contains('on');
};
window.updateVolume=function(v){
  volumeLevel=v/100;
  document.getElementById('volume-value').textContent=v+'%';
};
window.toggleMotion=function(el){
  el.classList.toggle('on');
  reduceMotion=el.classList.contains('on');
};
window.updateTargetFPS=function(v){
  targetFPS=parseInt(v);
  frameInterval=1000/targetFPS;
  document.getElementById('fps-value').textContent=v;
};

/* ======================= CAMERA / POINTER ======================= */
window.zoomIn=function(){sph.radius=Math.max(8,sph.radius-2)};
window.zoomOut=function(){sph.radius=Math.min(35,sph.radius+2)};

function setCameraMode(mode){
  cameraMode=mode;
  if(mode==='classic'){
    sph.radius=22;
    sph.theta=0;
    sph.phi=0.35;
  } else if(mode==='free'){
    sph.radius=20;
    sph.theta=0.2;
    sph.phi=0.6;
  }
}

window.toggleCameraMode=function(){
  if(cameraMode==='classic'){
    setCameraMode('free');
    showMsg('الكاميرا الحرة مفعلة (اسحب للتدوير)');
  }else{
    setCameraMode('classic');
    showMsg('الكاميرا الأساسية مفعلة');
  }
};

const activePointers=new Map();
let pinchStartDist=null,pinchStartRadius=null;

function bindPointer(){
  const dom=renderer.domElement;
  dom.addEventListener('pointerdown',e=>{
    activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePointers.size===1){pointerDown=true;dragged=false;lastPX=downX=e.clientX;lastPY=downY=e.clientY}
    else if(activePointers.size===2){
      pointerDown=false;
      const pts=Array.from(activePointers.values());
      pinchStartDist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      pinchStartRadius=sph.radius;
    }
  });
  window.addEventListener('pointermove',e=>{
    if(!activePointers.has(e.pointerId))return;
    activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePointers.size>=2){
      const pts=Array.from(activePointers.values());
      const dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      if(pinchStartDist){
        const scale=pinchStartDist/Math.max(dist,1);
        sph.radius=Math.max(8,Math.min(35,pinchStartRadius*scale));
      }
      return;
    }
    if(!pointerDown)return;
    const dx=e.clientX-lastPX,dy=e.clientY-lastPY;
    if(Math.abs(e.clientX-downX)+Math.abs(e.clientY-downY)>6)dragged=true;
    if(cameraMode==='free'&&dragged){
      sph.theta-=dx*0.006;
      sph.phi=Math.max(0.1,Math.min(1.45,sph.phi-dy*0.006));
    }
    lastPX=e.clientX;lastPY=e.clientY;
  });
  function endPointer(e){
    if(pointerDown&&activePointers.size===1&&!dragged)handleTap(e.clientX,e.clientY);
    activePointers.delete(e.pointerId);
    if(activePointers.size<2)pinchStartDist=null;
    if(activePointers.size===0)pointerDown=false;
  }
  window.addEventListener('pointerup',endPointer);
  window.addEventListener('pointercancel',endPointer);
  dom.addEventListener('wheel',e=>{sph.radius=Math.max(8,Math.min(35,sph.radius+e.deltaY*0.012))},{passive:true});
}

function handleTap(clientX,clientY){
  pointer.x=(clientX/window.innerWidth)*2-1;
  pointer.y=-(clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const meshes=[];
  COLORS.forEach(c=>pawns[c].forEach(p=>meshes.push(p.mesh)));
  const hits=raycaster.intersectObjects(meshes,true);
  if(hits.length===0)return;
  let obj=hits[0].object;
  while(obj&&!obj.userData.color)obj=obj.parent;
  if(!obj)return;
  tryMovePawn(obj.userData.color,obj.userData.index);
}

function updateCamera(){
  camera.position.set(
    target.x+sph.radius*Math.sin(sph.phi)*Math.sin(sph.theta),
    target.y+sph.radius*Math.cos(sph.phi),
    target.z+sph.radius*Math.sin(sph.phi)*Math.cos(sph.theta)
  );
  camera.lookAt(target);
}

function onResize(){
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
}

/* ======================= GRAPHICS ======================= */
function applyGraphicsSettings(quality){
  currentGraphicsQuality=quality;
  const pixelRatio=window.devicePixelRatio||1;
  if(quality==='smooth')renderer.setPixelRatio(Math.min(1,pixelRatio));
  else if(quality==='balanced')renderer.setPixelRatio(Math.min(1.5,pixelRatio));
  else renderer.setPixelRatio(Math.min(2,pixelRatio));

  renderer.shadowMap.enabled=(quality!=='smooth');
  const newShadowType=quality==='high'?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
  if(mainSpotLight&&renderer.shadowMap.type!==newShadowType){
    renderer.shadowMap.type=newShadowType;
    if(mainSpotLight.shadow.map){mainSpotLight.shadow.map.dispose();mainSpotLight.shadow.map=null}
    mainSpotLight.shadow.needsUpdate=true;
  }

  scene.traverse(child=>{
    if(!child.isMesh)return;
    if(child.userData.origCastShadow===undefined){
      child.userData.origCastShadow=child.castShadow;
      child.userData.origReceiveShadow=child.receiveShadow;
    }
    if(quality==='smooth'){child.castShadow=false;child.receiveShadow=false}
    else{child.castShadow=child.userData.origCastShadow;child.receiveShadow=child.userData.origReceiveShadow}

    const mats=Array.isArray(child.material)?child.material:[child.material];
    mats.forEach(function(mat){
      if(!mat||mat.transmission===undefined)return;
      if(!mat.userData.origSaved){
        mat.userData.origTransmission=mat.transmission;
        mat.userData.origThickness=mat.thickness;
        mat.userData.origRoughness=mat.roughness;
        mat.userData.origClearcoat=mat.clearcoat;
        mat.userData.origSaved=true;
      }
      const o=mat.userData;
      if(quality==='smooth'){mat.transmission=0;mat.thickness=0;mat.roughness=0.5;mat.clearcoat=0}
      else if(quality==='balanced'){mat.transmission=Math.min(o.origTransmission,0.2);mat.thickness=o.origThickness;mat.roughness=o.origRoughness;mat.clearcoat=0}
      else{mat.transmission=o.origTransmission;mat.thickness=o.origThickness;mat.roughness=o.origRoughness;mat.clearcoat=o.origClearcoat}
      mat.needsUpdate=true;
    });
  });

  world.solver.iterations=quality==='smooth'?5:(quality==='balanced'?8:12);
  renderer.setSize(window.innerWidth,window.innerHeight);
}

/* ======================= AUDIO ======================= */
function ensureAudio(){
  if(audioCtx)return;
  try{
    audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    const len=audioCtx.sampleRate*0.2;
    noiseBuffer=audioCtx.createBuffer(1,len,audioCtx.sampleRate);
    const data=noiseBuffer.getChannelData(0);
    for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
  }catch(e){console.warn('audio unavailable',e)}
}

function playThud(intensity){
  if(!audioCtx||!soundEnabled)return;
  const t=audioCtx.currentTime;
  const osc=audioCtx.createOscillator();
  const gain=audioCtx.createGain();
  osc.type='triangle';
  osc.frequency.value=140+Math.random()*90;
  gain.gain.setValueAtTime(0.0001,t);
  gain.gain.exponentialRampToValueAtTime(0.25*intensity*volumeLevel+0.03,t+0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
  osc.connect(gain);gain.connect(audioCtx.destination);
  osc.start(t);osc.stop(t+0.14);
  if(noiseBuffer){
    const src=audioCtx.createBufferSource();
    src.buffer=noiseBuffer;
    const ng=audioCtx.createGain();
    ng.gain.setValueAtTime(0.08*intensity*volumeLevel,t);
    ng.gain.exponentialRampToValueAtTime(0.0001,t+0.09);
    src.connect(ng);ng.connect(audioCtx.destination);
    src.start(t);
  }
}

function tone(freq,t0,dur,type,vol){
  if(!audioCtx||!soundEnabled)return;
  const osc=audioCtx.createOscillator();
  const gain=audioCtx.createGain();
  osc.type=type||'sine';
  osc.frequency.value=freq;
  gain.gain.setValueAtTime(0.0001,t0);
  gain.gain.exponentialRampToValueAtTime((vol||0.18)*volumeLevel,t0+0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  osc.connect(gain);gain.connect(audioCtx.destination);
  osc.start(t0);osc.stop(t0+dur+0.02);
}

function playHop(){if(!audioCtx||!soundEnabled)return;const t=audioCtx.currentTime;tone(520,t,0.09,'sine',0.12);tone(680,t+0.05,0.08,'sine',0.09)}
function playCapture(){if(!audioCtx||!soundEnabled)return;const t=audioCtx.currentTime;tone(420,t,0.15,'sawtooth',0.1);tone(260,t+0.08,0.2,'sawtooth',0.1)}
function playChimeUp(){if(!audioCtx||!soundEnabled)return;const t=audioCtx.currentTime;[523,659,784].forEach(function(f,i){tone(f,t+i*0.09,0.25,'sine',0.13))}
function playWinJingle(){
  ensureAudio();
  if(!audioCtx||!soundEnabled)return;
  const t=audioCtx.currentTime;
  [523,659,784,1046,784,1046].forEach(function(f,i){tone(f,t+i*0.14,0.3,'triangle',0.14));
}

/* ======================= MAIN LOOP ======================= */
function animate(timestamp){
  requestAnimationFrame(animate);

  if(timestamp-lastFrameTime<frameInterval)return;
  lastFrameTime=timestamp-(timestamp-lastFrameTime)%frameInterval;

  const dt=Math.min(clock.getDelta(),1/30);

  if(gameState==='rolling'){
    world.step(1/60,dt,3);
    diceMesh.position.copy(diceBody.position);
    diceMesh.quaternion.copy(diceBody.quaternion);
    diceMesh2.position.copy(diceBody2.position);
    diceMesh2.quaternion.copy(diceBody2.quaternion);

    const v1=diceBody.velocity.length();
    const av1=diceBody.angularVelocity.length();
    const v2=diceBody2.velocity.length();
    const av2=diceBody2.angularVelocity.length();
    diceSettleTimer+=dt;
    if(v1<0.15&&av1<0.15&&v2<0.15&&av2<0.15&&diceSettleTimer>0.45)diceStableFrames++;
    else diceStableFrames=0;
    if(diceStableFrames>18||diceSettleTimer>6)onDiceSettled();
  }

  if(!reduceMotion){
    const time=performance.now()*0.004;
    COLORS.forEach(c=>pawns[c].forEach(function(p){
      if(p._pulse){
        const s=1+Math.sin(time)*0.14+0.1;
        p.mesh.scale.set(s,s,s);
        p.gem.position.y=0.42+Math.sin(time*1.4)*0.05;
      }
    }));
    pulsingMats.forEach(function(mat){
      mat.emissiveIntensity=mat.userData.baseEmissive+Math.sin(time*0.5)*0.15;
    });
  }

  updateCamera();
  renderer.render(scene,camera);
}

/* ======================= BIND UI ======================= */
function bindUI(){
}

init();
})();
