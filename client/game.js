// ============================================================
// 3D Çim Alanı - İstemci
// Tek oda multiplayer: sunucuya bağlanır, herkesi aynı alanda gösterir,
// 7 saniyelik para yakalama döngüsünü ve skor tablosunu senkronize eder.
// ============================================================
(function(){

  // ---------- TEMEL SAHNE ----------
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 600);

  var renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app').appendChild(renderer.domElement);

  window.addEventListener('resize', function(){
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- GÖKYÜZÜ ----------
  function makeSky(){
    var c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    var ctx = c.getContext('2d');
    var grad = ctx.createLinearGradient(0,0,0,256);
    grad.addColorStop(0.0, '#0e1a3a');
    grad.addColorStop(0.45, '#28406e');
    grad.addColorStop(0.75, '#7c93b0');
    grad.addColorStop(1.0, '#cfd9e4');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,2,256);
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }
  scene.background = makeSky();
  scene.fog = new THREE.Fog(0x9aa8bf, 45, 220);

  // ---------- IŞIKLAR ----------
  var hemi = new THREE.HemisphereLight(0xbfd3ea, 0x3a5a35, 0.9);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff2d6, 1.0);
  sun.position.set(-40, 55, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0015;
  scene.add(sun);

  // ---------- ARAZİ (büyütülmüş alan) ----------
  var WORLD_RADIUS = 95;      // görsel çim/alan yarıçapı
  var ARENA_RADIUS = 85;      // hareket sınırı (sunucudan gelen değerle güncellenir)

  function terrainHeight(x, z){
    return (
      Math.sin(x*0.035) * 2.6 +
      Math.cos(z*0.032) * 2.3 +
      Math.sin((x+z)*0.02) * 1.5
    );
  }

  var groundSize = 420;
  var groundSeg = 140;
  var groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, groundSeg, groundSeg);
  groundGeo.rotateX(-Math.PI/2);
  var gpos = groundGeo.attributes.position;
  for (var i=0;i<gpos.count;i++){
    var x=gpos.getX(i), z=gpos.getZ(i);
    gpos.setY(i, terrainHeight(x,z));
  }
  groundGeo.computeVertexNormals();
  var ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({color:0x2f7a45, roughness:1}));
  ground.receiveShadow = true;
  scene.add(ground);

  var farHillsGeo = new THREE.RingGeometry(150, 380, 72, 8);
  var fpos = farHillsGeo.attributes.position;
  for (var i=0;i<fpos.count;i++){
    var x=fpos.getX(i), y=fpos.getY(i);
    var d = Math.sqrt(x*x+y*y);
    var h = 8 + Math.sin(x*0.02)*4 + Math.cos(y*0.02)*4;
    farHillsGeo.attributes.position.setZ(i, -h * Math.min(1,(d-140)/50));
  }
  farHillsGeo.rotateX(-Math.PI/2);
  farHillsGeo.computeVertexNormals();
  var farHills = new THREE.Mesh(farHillsGeo, new THREE.MeshStandardMaterial({color:0x3f8f57, roughness:1}));
  scene.add(farHills);

  // ---------- ÇİM ----------
  var bladeGeo = new THREE.PlaneGeometry(0.12, 0.9, 1, 3);
  bladeGeo.translate(0, 0.45, 0);
  var bladeMat = new THREE.MeshStandardMaterial({ color:0x3c9a55, side:THREE.DoubleSide, roughness:1 });
  var GRASS_COUNT = 13000;
  var grassMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, GRASS_COUNT);
  var dummy = new THREE.Object3D();
  for (var i=0;i<GRASS_COUNT;i++){
    var ang = Math.random()*Math.PI*2;
    var r = Math.sqrt(Math.random()) * WORLD_RADIUS;
    var x = Math.cos(ang)*r, z = Math.sin(ang)*r;
    var y = terrainHeight(x,z);
    var s = 0.7 + Math.random()*0.9;
    dummy.position.set(x,y,z);
    dummy.rotation.y = Math.random()*Math.PI;
    dummy.scale.set(s, s*(0.8+Math.random()*0.6), s);
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
  }
  scene.add(grassMesh);

  // ---------- KARAKTER FABRİKASI ----------
  // Aynı fonksiyon hem yerel oyuncu hem de diğer oyuncular için kullanılır.
  // Eğer client/assets/character.glb dosyası varsa otomatik olarak onu kullanır,
  // yoksa basit prosedürel karaktere geri döner.
  var customModelTemplate = null; // GLTF yüklenirse buraya atanır

  function buildSpikyCreature(furColor, spikeAccent){
    furColor = (furColor !== undefined) ? furColor : 0x140a1c;
    spikeAccent = (spikeAccent !== undefined) ? spikeAccent : 0x2e1640;

    var group = new THREE.Group();
    var furMat = new THREE.MeshStandardMaterial({ color:furColor, roughness:0.85 });
    var spikeMatA = new THREE.MeshStandardMaterial({ color:furColor, roughness:0.8 });
    var spikeMatB = new THREE.MeshStandardMaterial({ color:spikeAccent, roughness:0.8 });
    var faceMat = new THREE.MeshStandardMaterial({ color:0xf4ece1, roughness:0.7 });
    var cheekMat = new THREE.MeshStandardMaterial({ color:0xef97ac, roughness:0.6 });
    var eyeMat = new THREE.MeshStandardMaterial({ color:0x120a14, roughness:0.3 });
    var eyeShineMat = new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:0.4 });
    var noseMat = new THREE.MeshStandardMaterial({ color:0xe15c86, roughness:0.5 });
    var pawMat = new THREE.MeshStandardMaterial({ color:0xe07fa0, roughness:0.6 });

    // Gövde: yuvarlak tüylü top
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), furMat);
    body.scale.set(1, 0.92, 1.04);
    body.position.y = 0.62;
    body.castShadow = true;
    group.add(body);

    // Yüz maskesi (krem rengi)
    var face = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 14), faceMat);
    face.scale.set(1, 0.92, 0.55);
    face.position.set(0, 0.54, 0.42);
    face.castShadow = true;
    group.add(face);

    // Pembe yanaklar
    [-1, 1].forEach(function(side){
      var cheek = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), cheekMat);
      cheek.scale.set(1, 0.8, 0.5);
      cheek.position.set(side*0.27, 0.48, 0.58);
      group.add(cheek);
    });

    // Gözler (parlama noktalı)
    [-1, 1].forEach(function(side){
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), eyeMat);
      eye.position.set(side*0.15, 0.62, 0.68);
      group.add(eye);
      var shine = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeShineMat);
      shine.position.set(side*0.15 + side*0.02, 0.66, 0.735);
      group.add(shine);
    });

    // Burun
    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), noseMat);
    nose.scale.set(1.15, 0.8, 0.9);
    nose.position.set(0, 0.5, 0.73);
    group.add(nose);

    // Dikenler: gövdenin üstünde/yanlarında yıldız gibi patlayan tüyler
    // (yüzün olduğu ön-alt bölge dikenlerden arındırılır)
    var spikeCount = 22;
    for (var i=0; i<spikeCount; i++){
      var theta = Math.random()*Math.PI*2;
      var phi = 0.12 + Math.random()*0.78;
      var dir = new THREE.Vector3(
        Math.sin(phi)*Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi)*Math.sin(theta)
      );
      if (dir.z > 0.35 && dir.y < 0.55) continue; // yüz bölgesini boş bırak

      var len = 0.35 + Math.random()*0.4;
      var rad = 0.05 + Math.random()*0.045;
      var mat = Math.random() > 0.6 ? spikeMatB : spikeMatA;
      var spike = new THREE.Mesh(new THREE.ConeGeometry(rad, len, 6), mat);
      spike.castShadow = true;
      var basePos = dir.clone().multiplyScalar(0.46).add(new THREE.Vector3(0, 0.62, 0));
      spike.position.copy(basePos).add(dir.clone().multiplyScalar(len*0.35));
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
      group.add(spike);
    }

    // Bacaklar: 4 küçük ayak (ön çift + arka çift, çapraz tırıs animasyonu için)
    // Grup, kalça yüksekliğine yerleştirilir; bacak/ayak bu noktadan aşağı sarkar ki
    // dönüş (yürüme animasyonu) gerçekçi biçimde kalçadan gerçekleşsin.
    function makeLeg(x, z){
      var legGroup = new THREE.Group();
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.16, 8), furMat);
      leg.position.y = -0.08;
      leg.castShadow = true;
      legGroup.add(leg);
      var paw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), pawMat);
      paw.scale.set(1, 0.6, 1.15);
      paw.position.y = -0.15;
      legGroup.add(paw);
      legGroup.position.set(x, 0.17, z);
      return legGroup;
    }
    var legFrontL = makeLeg(-0.2, 0.3);
    var legFrontR = makeLeg(0.2, 0.3);
    var legBackL = makeLeg(-0.2, -0.28);
    var legBackR = makeLeg(0.2, -0.28);
    group.add(legFrontL, legFrontR, legBackL, legBackR);

    return {
      group: group,
      torsoCyl: body,
      legL: legFrontL, legR: legFrontR,
      armL: legBackL, armR: legBackR,
      isCustomModel: false
    };
  }

  var CUSTOM_MODEL_TARGET_HEIGHT = 1.3; // özel modelin oyun içinde kaç birim boyunda görüneceği

  function buildCustomCharacter(){
    var group = new THREE.Group();
    var model = customModelTemplate.clone(true);
    model.traverse(function(o){ if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
    model.updateMatrixWorld(true);

    // Modeli otomatik olarak ölçekle, tabanı yere otur, merkezini ortala
    var box = new THREE.Box3().setFromObject(model);
    var size = new THREE.Vector3(); box.getSize(size);
    var center = new THREE.Vector3(); box.getCenter(center);
    var scale = size.y > 0.0001 ? CUSTOM_MODEL_TARGET_HEIGHT / size.y : 1;
    model.scale.setScalar(scale);
    var baseOffset = { x: -center.x*scale, y: -box.min.y*scale, z: -center.z*scale };
    model.position.set(baseOffset.x, baseOffset.y, baseOffset.z);

    group.add(model);
    return {
      group: group, torsoCyl: model, legL:null, legR:null, armL:null, armR:null,
      isCustomModel: true, model: model, baseOffset: baseOffset
    };
  }

  function createCharacter(furColor, spikeAccent){
    return customModelTemplate ? buildCustomCharacter() : buildSpikyCreature(furColor, spikeAccent);
  }

  function createNameSprite(text){
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var ctx = c.getContext('2d');
    ctx.font = 'bold 30px -apple-system, sans-serif';
    var w = Math.min(240, ctx.measureText(text).width + 28);
    ctx.clearRect(0,0,256,64);
    ctx.fillStyle = 'rgba(10,16,30,0.55)';
    roundRect(ctx, 128-w/2, 10, w, 40, 12);
    ctx.fill();
    ctx.fillStyle = '#eafff3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 31);
    var tex = new THREE.CanvasTexture(c);
    var mat = new THREE.SpriteMaterial({ map:tex, depthTest:false, transparent:true });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.38, 1);
    sprite.position.y = 2.15;
    sprite.renderOrder = 999;
    return sprite;
  }
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  // ---------- YEREL OYUNCU ----------
  var localColors = [0x140a1c, 0x2e1640]; // koyu mor tüy + biraz daha açık mor diken vurgusu (görseldeki gibi)
  var local = createCharacter(localColors[0], localColors[1]);
  var character = local.group;
  scene.add(character);

  var charState = { x:0, z:0, facing:0, velY:0, grounded:true, speed:0, walkT:0 };
  charState.y = terrainHeight(0,0);
  character.position.set(0, charState.y, 0);

  var MOVE_SPEED_BASE = 4.2;
  var TURN_SPEED_INPUT = 3.2; // joystick sola/sağa yatırıldığında dönüş hızı (rad/sn)
  var JUMP_VELOCITY = 6.2;
  var GRAVITY = -16;
  var sprintActive = false;

  // ---------- KAMERA (sürükle/pinch ile serbest yörünge) ----------
  var camLookOffset = new THREE.Vector3(0, 1.4, 0);
  var camState = { yaw:0, pitch:0.38, distance:7 };
  var CAM_MIN_PITCH=0.08, CAM_MAX_PITCH=1.35, CAM_MIN_DIST=3, CAM_MAX_DIST=16;
  var camPos = new THREE.Vector3();
  camera.position.set(0,4,-7);

  var canvasEl = renderer.domElement;
  var camDrag = { active:false, id:null, lastX:0, lastY:0 };
  var CAM_DRAG_SENS = 0.008;
  function camDragStart(x,y,id){ camDrag.active=true; camDrag.id=id; camDrag.lastX=x; camDrag.lastY=y; }
  function camDragMove(x,y){
    if (!camDrag.active) return;
    var dx=x-camDrag.lastX, dy=y-camDrag.lastY;
    camDrag.lastX=x; camDrag.lastY=y;
    camState.yaw -= dx*CAM_DRAG_SENS;
    camState.pitch += dy*CAM_DRAG_SENS;
    camState.pitch = Math.max(CAM_MIN_PITCH, Math.min(CAM_MAX_PITCH, camState.pitch));
  }
  function camDragEnd(){ camDrag.active=false; camDrag.id=null; }

  var pinch = { active:false, startDist:0, startCamDist:0 };
  function touchDist(a,b){ var dx=a.clientX-b.clientX, dy=a.clientY-b.clientY; return Math.sqrt(dx*dx+dy*dy); }

  canvasEl.addEventListener('touchstart', function(e){
    if (e.touches.length===2){
      pinch.active=true; camDrag.active=false;
      pinch.startDist=touchDist(e.touches[0], e.touches[1]);
      pinch.startCamDist=camState.distance;
    } else if (e.touches.length===1 && !pinch.active){
      var t=e.touches[0]; camDragStart(t.clientX,t.clientY,t.identifier);
    }
  }, {passive:true});
  canvasEl.addEventListener('touchmove', function(e){
    if (pinch.active && e.touches.length===2){
      var d=touchDist(e.touches[0], e.touches[1]);
      var scale = pinch.startDist/Math.max(1,d);
      camState.distance = Math.max(CAM_MIN_DIST, Math.min(CAM_MAX_DIST, pinch.startCamDist*scale));
    } else if (camDrag.active){
      for (var i=0;i<e.touches.length;i++){
        var t=e.touches[i];
        if (t.identifier===camDrag.id){ camDragMove(t.clientX,t.clientY); break; }
      }
    }
  }, {passive:true});
  canvasEl.addEventListener('touchend', function(e){
    if (e.touches.length<2) pinch.active=false;
    if (e.touches.length===0) camDragEnd();
  }, {passive:true});
  canvasEl.addEventListener('mousedown', function(e){
    camDragStart(e.clientX,e.clientY,'mouse');
    window.addEventListener('mousemove', camMouseMove);
    window.addEventListener('mouseup', camMouseUp);
  });
  function camMouseMove(e){ camDragMove(e.clientX,e.clientY); }
  function camMouseUp(e){ camDragEnd(); window.removeEventListener('mousemove',camMouseMove); window.removeEventListener('mouseup',camMouseUp); }
  canvasEl.addEventListener('wheel', function(e){
    e.preventDefault();
    camState.distance = Math.max(CAM_MIN_DIST, Math.min(CAM_MAX_DIST, camState.distance + e.deltaY*0.01));
  }, {passive:false});

  // ---------- JOYSTICK ----------
  var joyBase=document.getElementById('joyBase'), joyStick=document.getElementById('joyStick');
  var joyVec={x:0,y:0}, joyActive=false, joyTouchId=null, joyCenter={x:0,y:0}, joyMaxR=42;
  function updateJoyCenter(){ var r=joyBase.getBoundingClientRect(); joyCenter.x=r.left+r.width/2; joyCenter.y=r.top+r.height/2; }
  updateJoyCenter();
  window.addEventListener('resize', updateJoyCenter);
  function joyStart(cx,cy,id){ joyActive=true; joyTouchId=id; updateJoyCenter(); joyMove(cx,cy); }
  function joyMove(cx,cy){
    if(!joyActive) return;
    var dx=cx-joyCenter.x, dy=cy-joyCenter.y;
    var dist=Math.sqrt(dx*dx+dy*dy);
    if (dist>joyMaxR){ dx=dx/dist*joyMaxR; dy=dy/dist*joyMaxR; }
    joyStick.style.transform='translate('+(-50+(dx/joyMaxR)*45)+'%,'+(-50+(dy/joyMaxR)*45)+'%)';
    joyVec.x=dx/joyMaxR; joyVec.y=-dy/joyMaxR;
  }
  function joyEnd(){ joyActive=false; joyTouchId=null; joyVec.x=0; joyVec.y=0; joyStick.style.transform='translate(-50%,-50%)'; }
  joyBase.addEventListener('touchstart', function(e){ e.preventDefault(); var t=e.changedTouches[0]; joyStart(t.clientX,t.clientY,t.identifier); },{passive:false});
  joyBase.addEventListener('touchmove', function(e){ e.preventDefault(); for(var i=0;i<e.changedTouches.length;i++){ var t=e.changedTouches[i]; if(t.identifier===joyTouchId) joyMove(t.clientX,t.clientY); } },{passive:false});
  joyBase.addEventListener('touchend', function(e){ e.preventDefault(); for(var i=0;i<e.changedTouches.length;i++){ if(e.changedTouches[i].identifier===joyTouchId) joyEnd(); } },{passive:false});
  joyBase.addEventListener('mousedown', function(e){ joyStart(e.clientX,e.clientY,'mouse'); window.addEventListener('mousemove',joyMouseMove); window.addEventListener('mouseup',joyMouseUp); });
  function joyMouseMove(e){ joyMove(e.clientX,e.clientY); }
  function joyMouseUp(e){ joyEnd(); window.removeEventListener('mousemove',joyMouseMove); window.removeEventListener('mouseup',joyMouseUp); }

  // ---------- ZIPLAMA & HIZLANMA ----------
  var jumpBtn=document.getElementById('jumpBtn');
  function doJump(){ if (charState.grounded){ charState.velY=JUMP_VELOCITY; charState.grounded=false; } }
  jumpBtn.addEventListener('touchstart', function(e){ e.preventDefault(); doJump(); },{passive:false});
  jumpBtn.addEventListener('mousedown', function(e){ e.preventDefault(); doJump(); });

  var sprintBtn=document.getElementById('sprintBtn');
  function setSprint(v){ sprintActive=v; sprintBtn.classList.toggle('active', v); }
  sprintBtn.addEventListener('touchstart', function(e){ e.preventDefault(); setSprint(true); },{passive:false});
  sprintBtn.addEventListener('touchend', function(e){ e.preventDefault(); setSprint(false); },{passive:false});
  sprintBtn.addEventListener('mousedown', function(e){ setSprint(true); });
  window.addEventListener('mouseup', function(){ setSprint(false); });
  sprintBtn.addEventListener('mouseleave', function(){ /* mouse basılıyken ayrılırsa mouseup zaten kapatır */ });

  // Klavye
  var keys={};
  window.addEventListener('keydown', function(e){
    keys[e.code]=true;
    if (e.code==='Space') doJump();
    if (e.code==='ShiftLeft' || e.code==='ShiftRight') setSprint(true);
  });
  window.addEventListener('keyup', function(e){
    keys[e.code]=false;
    if (e.code==='ShiftLeft' || e.code==='ShiftRight') setSprint(false);
  });
  function getKeyboardVec(){
    var x=0,y=0;
    if (keys['KeyA']||keys['ArrowLeft']) x-=1;
    if (keys['KeyD']||keys['ArrowRight']) x+=1;
    if (keys['KeyW']||keys['ArrowUp']) y+=1;
    if (keys['KeyS']||keys['ArrowDown']) y-=1;
    return {x:x,y:y};
  }

  // ---------- PARA (COIN) ----------
  var coinGroup = new THREE.Group();
  var coinMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42,0.42,0.12,20),
    new THREE.MeshStandardMaterial({ color:0xffd166, emissive:0x664400, emissiveIntensity:0.4, metalness:0.6, roughness:0.3 })
  );
  coinMesh.rotation.x = Math.PI/2;
  coinMesh.castShadow = true;
  coinGroup.add(coinMesh);
  scene.add(coinGroup);
  var coinState = { x:0, z:0, endsAt:0 };
  function positionCoin(){
    coinGroup.position.set(coinState.x, terrainHeight(coinState.x, coinState.z) + 0.55, coinState.z);
  }

  // ---------- AĞ (WEBSOCKET) ----------
  var ws = null;
  var myId = null;
  var myName = '';
  var remotePlayers = {}; // id -> {group, target:{x,z,ry}, legL,legR,armL,armR, movingSpeed, lastTarget}
  var latestScores = {};  // id -> {name, score}
  var networkAccum = 0;
  var NETWORK_SEND_INTERVAL = 0.1;

  function createRemotePlayer(name){
    var palette = [[0x1c1030,0x3a2060],[0x0d2430,0x1f4a5c],[0x2a0d18,0x5c1f34],[0x0d1730,0x1f3560]];
    var pick = palette[Math.floor(Math.random()*palette.length)];
    var built = createCharacter(pick[0], pick[1]);
    var nameSprite = createNameSprite(name);
    built.group.add(nameSprite);
    scene.add(built.group);
    return {
      group: built.group, legL: built.legL, legR: built.legR, armL: built.armL, armR: built.armR,
      isCustomModel: built.isCustomModel, model: built.model, baseOffset: built.baseOffset,
      target: {x:0,z:0,ry:0}, lastTarget: {x:0,z:0}, movingSpeed: 0, walkT: Math.random()*10
    };
  }

  function syncPlayerList(list){
    var seen = {};
    list.forEach(function(p){
      seen[p.id] = true;
      latestScores[p.id] = { name:p.name, score:p.score };
      if (p.id === myId){
        document.getElementById('scoreVal').textContent = p.score;
        return;
      }
      var rp = remotePlayers[p.id];
      if (!rp){
        rp = createRemotePlayer(p.name);
        remotePlayers[p.id] = rp;
      }
      var movedDist = Math.hypot(p.x - rp.lastTarget.x, p.z - rp.lastTarget.z);
      rp.movingSpeed = Math.min(1, movedDist / 0.5);
      rp.lastTarget.x = p.x; rp.lastTarget.z = p.z;
      rp.target.x = p.x; rp.target.z = p.z; rp.target.ry = p.ry;
    });
    Object.keys(remotePlayers).forEach(function(id){
      if (!seen[id]){ scene.remove(remotePlayers[id].group); delete remotePlayers[id]; delete latestScores[id]; }
    });
    if (leaderboardOpen) renderLeaderboard();
  }

  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function showToast(text){
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 1800);
  }

  var leaderboardOpen = false;
  var lbBtn = document.getElementById('leaderboardBtn');
  var lbPanel = document.getElementById('leaderboardPanel');
  var lbList = document.getElementById('lbList');
  lbBtn.addEventListener('click', function(){
    leaderboardOpen = !leaderboardOpen;
    lbPanel.style.display = leaderboardOpen ? 'block' : 'none';
    if (leaderboardOpen) renderLeaderboard();
  });
  function renderLeaderboard(){
    var arr = Object.keys(latestScores).map(function(id){ return {id:id, name:latestScores[id].name, score:latestScores[id].score}; });
    arr.sort(function(a,b){ return b.score - a.score; });
    lbList.innerHTML = '';
    arr.slice(0,20).forEach(function(p){
      var row = document.createElement('div');
      row.className = 'lbRow' + (p.id===myId ? ' me' : '');
      row.innerHTML = '<span>' + escapeHtml(p.name) + '</span><span>' + p.score + '</span>';
      lbList.appendChild(row);
    });
  }
  function escapeHtml(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  function handleMessage(msg){
    if (msg.type === 'welcome'){
      myId = msg.id;
      if (msg.arenaRadius) ARENA_RADIUS = msg.arenaRadius;
      enterGame();
    } else if (msg.type === 'players'){
      syncPlayerList(msg.players);
    } else if (msg.type === 'state'){
      syncPlayerList(msg.players);
      updateCoinTimerUI(msg.coinEndsAt);
    } else if (msg.type === 'coin'){
      coinState = msg.coin;
      positionCoin();
    } else if (msg.type === 'caught'){
      showToast((msg.id === myId ? 'Sen' : msg.name) + ' parayı yakaladı! +1');
    }
  }

  function updateCoinTimerUI(endsAt){
    var remaining = Math.max(0, endsAt - Date.now());
    var pct = Math.max(0, Math.min(100, remaining/7000*100));
    document.getElementById('coinBarFill').style.width = pct + '%';
    document.getElementById('coinBarLabel').textContent = 'Para: ' + (remaining/1000).toFixed(1) + 's';
  }

  var loginScreen = document.getElementById('loginScreen');
  var loginMsg = document.getElementById('loginMsg');
  var joinBtn = document.getElementById('joinBtn');
  var nameInput = document.getElementById('nameInput');
  var serverInput = document.getElementById('serverInput');

  joinBtn.addEventListener('click', function(){
    var name = nameInput.value.trim();
    var url = serverInput.value.trim();
    if (!name){ loginMsg.textContent = 'Lütfen bir isim yaz.'; return; }
    if (!url){ loginMsg.textContent = 'Lütfen sunucu adresini yaz.'; return; }
    myName = name;
    joinBtn.disabled = true;
    loginMsg.style.color = '#ffe9b3';
    loginMsg.textContent = 'Bağlanıyor…';
    try {
      ws = new WebSocket(url);
    } catch (e){
      loginMsg.style.color = '#ffb0a0';
      loginMsg.textContent = 'Geçersiz sunucu adresi.';
      joinBtn.disabled = false;
      return;
    }
    ws.onopen = function(){ ws.send(JSON.stringify({ type:'join', name:name })); };
    ws.onmessage = function(ev){
      try { handleMessage(JSON.parse(ev.data)); } catch(e){}
    };
    ws.onerror = function(){
      loginMsg.style.color = '#ffb0a0';
      loginMsg.textContent = 'Bağlantı hatası. Sunucunun çalıştığından emin ol.';
      joinBtn.disabled = false;
    };
    ws.onclose = function(){
      if (loginScreen.style.display !== 'none'){
        loginMsg.style.color = '#ffb0a0';
        loginMsg.textContent = 'Bağlantı kurulamadı.';
        joinBtn.disabled = false;
      }
    };
  });

  function enterGame(){
    loginScreen.style.display = 'none';
    document.getElementById('hud').style.display = 'block';
  }

  // ---------- ANİMASYON DÖNGÜSÜ ----------
  var clock = new THREE.Clock();

  function animate(){
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);

    // --- Girdi ---
    var inX = joyVec.x, inY = joyVec.y;
    if (Math.abs(inX)<0.05 && Math.abs(inY)<0.05){
      var kb = getKeyboardVec();
      inX = kb.x; inY = kb.y;
    }
    var MOVE_SPEED = MOVE_SPEED_BASE * (sprintActive ? 2 : 1);

    // Basit "dön + ilerle" kontrolü: joystick'i sola yatırınca karakter sola döner,
    // sağa yatırınca sağa döner; yukarı/aşağı ise o an baktığı yönde ileri/geri gider.
    if (Math.abs(inX) > 0.04){
      charState.facing += inX * TURN_SPEED_INPUT * dt;
    }
    var forwardAmount = Math.abs(inY) > 0.04 ? Math.max(-1, Math.min(1, inY)) : 0;

    if (forwardAmount !== 0){
      charState.x += Math.sin(charState.facing) * MOVE_SPEED * forwardAmount * dt;
      charState.z += Math.cos(charState.facing) * MOVE_SPEED * forwardAmount * dt;
      charState.speed = Math.abs(forwardAmount);
      charState.walkT += dt * 9 * Math.abs(forwardAmount) * (sprintActive?1.6:1);
    } else {
      charState.speed *= 0.85;
    }

    var limit = ARENA_RADIUS;
    var distFromCenter = Math.hypot(charState.x, charState.z);
    if (distFromCenter > limit){
      var s = limit/distFromCenter;
      charState.x *= s; charState.z *= s;
    }

    var groundY = terrainHeight(charState.x, charState.z);
    if (!charState.grounded){
      charState.velY += GRAVITY*dt;
      charState.y += charState.velY*dt;
      if (charState.y <= groundY){ charState.y = groundY; charState.velY = 0; charState.grounded = true; }
    } else {
      charState.y = groundY;
    }

    character.position.set(charState.x, charState.y, charState.z);
    character.rotation.y = charState.facing;

    if (!local.isCustomModel){
      var swing = Math.sin(charState.walkT) * 0.5 * charState.speed;
      local.legL.rotation.x = swing; local.legR.rotation.x = -swing;
      local.armL.rotation.x = -swing; local.armR.rotation.x = swing;
      local.torsoCyl.rotation.x = charState.grounded ? 0 : 0.12;
    } else {
      // İskeletsiz özel model: zıplayan/sallanan basit bir "yürüme" hissi ver
      var bob = Math.abs(Math.sin(charState.walkT)) * 0.07 * (0.35 + 0.65*charState.speed);
      local.model.position.y = local.baseOffset.y + bob;
      local.model.rotation.z = Math.sin(charState.walkT) * 0.09 * charState.speed;
      local.model.rotation.x = charState.grounded ? 0 : 0.1;
    }

    // --- Sunucuya konum gönder ---
    networkAccum += dt;
    if (ws && ws.readyState===WebSocket.OPEN && networkAccum >= NETWORK_SEND_INTERVAL){
      networkAccum = 0;
      ws.send(JSON.stringify({ type:'move', x:charState.x, z:charState.z, ry:charState.facing }));
    }

    // --- Uzak oyuncuları güncelle ---
    for (var id in remotePlayers){
      var rp = remotePlayers[id];
      var lerpF = 1 - Math.pow(0.0001, dt);
      var curX = rp.group.position.x + (rp.target.x - rp.group.position.x) * lerpF;
      var curZ = rp.group.position.z + (rp.target.z - rp.group.position.z) * lerpF;
      var curY = terrainHeight(curX, curZ);
      rp.group.position.set(curX, curY, curZ);

      var rdiff = rp.target.ry - rp.group.rotation.y;
      while (rdiff>Math.PI) rdiff-=Math.PI*2;
      while (rdiff<-Math.PI) rdiff+=Math.PI*2;
      rp.group.rotation.y += rdiff * Math.min(1, 8*dt);

      rp.movingSpeed *= 0.9;
      rp.walkT += dt * 9 * rp.movingSpeed;
      if (rp.isCustomModel && rp.model){
        var rbob = Math.abs(Math.sin(rp.walkT)) * 0.07 * (0.35 + 0.65*rp.movingSpeed);
        rp.model.position.y = rp.baseOffset.y + rbob;
        rp.model.rotation.z = Math.sin(rp.walkT) * 0.09 * rp.movingSpeed;
      } else if (rp.legL){
        var rswing = Math.sin(rp.walkT) * 0.5 * rp.movingSpeed;
        rp.legL.rotation.x = rswing; rp.legR.rotation.x = -rswing;
        rp.armL.rotation.x = -rswing; rp.armR.rotation.x = rswing;
      }
    }

    // --- Para animasyonu ---
    coinGroup.rotation.y += dt * 2.2;
    coinGroup.position.y += Math.sin(clock.elapsedTime*3) * 0.002;
    if (myId) updateCoinTimerUI(coinState.endsAt);

    // --- Kamera ---
    var horiz = Math.cos(camState.pitch) * camState.distance;
    var vert = Math.sin(camState.pitch) * camState.distance;
    var desiredCamPos = new THREE.Vector3(
      character.position.x - Math.sin(camState.yaw)*horiz,
      character.position.y + 1.2 + vert,
      character.position.z - Math.cos(camState.yaw)*horiz
    );
    camPos.lerp(desiredCamPos, 1 - Math.pow(0.0001, dt));
    camera.position.copy(camPos);
    camera.lookAt(new THREE.Vector3().copy(character.position).add(camLookOffset));

    renderer.render(scene, camera);
  }

  // ---------- ÖZEL KARAKTER (opsiyonel GLB) ----------
  // assets/character.glb dosyası varsa yükle, yoksa prosedürel karaktere devam et.
  function tryLoadCustomModel(cb){
    if (typeof THREE.GLTFLoader === 'undefined'){ cb(); return; }
    var loader = new THREE.GLTFLoader();
    if (typeof THREE.DRACOLoader !== 'undefined'){
      var dracoLoader = new THREE.DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader.setDRACOLoader(dracoLoader);
    }
    loader.load('assets/character.glb', function(gltf){
      customModelTemplate = gltf.scene;
      // Yerel karakteri yeniden oluştur (özel model ile)
      scene.remove(character);
      local = createCharacter();
      character = local.group;
      character.position.set(charState.x, charState.y, charState.z);
      scene.add(character);
      cb();
    }, undefined, function(err){ console.warn('character.glb yüklenemedi, varsayılan karakter kullanılıyor.', err); cb(); });
  }

  var loadingEl = document.getElementById('loading');
  tryLoadCustomModel(function(){
    if (loadingEl) loadingEl.style.display = 'none';
    animate();
  });

})();
