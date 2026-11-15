import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GameSimulation } from './simulation';
import { ArenaSlot, EnemyEntity, UnitEntity, UnitKind } from './types';

export class ThreeSceneManager {
  public container: HTMLDivElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public raycaster = new THREE.Raycaster();
  public mouse = new THREE.Vector2();

  // Pure matrix camera controller
  public cameraTarget = new THREE.Vector3(600, 0, 410);
  public cameraDistance = 980;
  public cameraYaw = 0; // Pure rotation around Y-axis in radians
  public cameraPitch = Math.PI / 3.4; // Fixed ~53° isometric elevation angle

  private unitMeshes = new Map<number, THREE.Group>();
  private enemyMeshes = new Map<number, THREE.Group>();
  private slotMeshes = new Map<string, THREE.Mesh>();
  private projectileMeshes = new Map<number, THREE.Mesh>();
  private isSoftwareGl = false;

  constructor(container: HTMLDivElement) {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Detect software WebGL guard
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        this.isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      }
    } catch {
      this.isSoftwareGl = true;
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#4CA64C');

    // Camera positioned for an optimal isometric 3D perspective
    this.camera = new THREE.PerspectiveCamera(42, width / height, 10, 3000);
    this.updateCameraTransform();

    // Studio lighting rig
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemi = new THREE.HemisphereLight(0xfffbeb, 0x1e3a10, 0.85);
    this.scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.45);
    dirLight.position.set(900, 1100, 500);
    dirLight.castShadow = !this.isSoftwareGl;
    if (dirLight.castShadow) {
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 100;
      dirLight.shadow.camera.far = 2500;
      const d = 800;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
      dirLight.shadow.bias = -0.0005;
    }
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.5);
    fillLight.position.set(-400, 600, -300);
    this.scene.add(fillLight);

    this.buildStaticEnvironment();
  }

  public updateCameraTransform() {
    const horizontalDist = this.cameraDistance * Math.cos(this.cameraPitch);
    const verticalDist = this.cameraDistance * Math.sin(this.cameraPitch);

    const camX = this.cameraTarget.x + horizontalDist * Math.sin(this.cameraYaw);
    const camY = this.cameraTarget.y + verticalDist;
    const camZ = this.cameraTarget.z + horizontalDist * Math.cos(this.cameraYaw);

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld(true);
  }

  public pan(deltaScreenX: number, deltaScreenY: number, containerHeight: number) {
    const elements = this.camera.matrixWorld.elements;

    // Right vector on horizontal ground plane (Y = 0)
    const rx = elements[0];
    const rz = elements[2];
    const rLen = Math.hypot(rx, rz) || 1;
    const rightX = rx / rLen;
    const rightZ = rz / rLen;

    // Forward vector on horizontal ground plane (projected -Z vector)
    const fx = -elements[8];
    const fz = -elements[10];
    const fLen = Math.hypot(fx, fz) || 1;
    const forwardX = fx / fLen;
    const forwardZ = fz / fLen;

    // Analytical scale factor: world distance per pixel at the focus depth
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const worldPerPixel = (2 * this.cameraDistance * Math.tan(fovRad / 2)) / Math.max(1, containerHeight);

    // Natural drag: scene moves in the exact same direction the finger is dragged
    const moveLateral = -deltaScreenX * worldPerPixel * 1.35;
    const moveDepth = deltaScreenY * worldPerPixel * 1.35;

    this.cameraTarget.x += rightX * moveLateral + forwardX * moveDepth;
    this.cameraTarget.z += rightZ * moveLateral + forwardZ * moveDepth;

    // Broad arena limits spanning from start portal (x: 96) to castle (x: 1065)
    this.cameraTarget.x = Math.max(-100, Math.min(1300, this.cameraTarget.x));
    this.cameraTarget.z = Math.max(-100, Math.min(950, this.cameraTarget.z));

    this.updateCameraTransform();
  }

  public rotateYaw(deltaAngleRad: number) {
    // Pure rotation around Y-axis only
    this.cameraYaw += deltaAngleRad;
    this.updateCameraTransform();
  }

  public zoomIn() {
    this.cameraDistance = Math.max(450, this.cameraDistance * 0.82);
    this.updateCameraTransform();
  }

  public zoomOut() {
    this.cameraDistance = Math.min(1400, this.cameraDistance * 1.22);
    this.updateCameraTransform();
  }

  private buildStaticEnvironment() {
    // 3D Terrain Base Plane
    const planeGeo = new THREE.PlaneGeometry(1600, 1200, 32, 32);
    const planeMat = new THREE.MeshStandardMaterial({
      color: '#4FA83D',
      roughness: 0.9,
      metalness: 0.0,
    });
    const terrain = new THREE.Mesh(planeGeo, planeMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(600, -2, 410);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // 3D Winding Path using Shape extruded along waypoints
    const wps = [
      { x: 96, y: 265 },
      { x: 245, y: 265 },
      { x: 285, y: 285 },
      { x: 295, y: 330 },
      { x: 295, y: 500 },
      { x: 315, y: 545 },
      { x: 365, y: 560 },
      { x: 515, y: 560 },
      { x: 560, y: 540 },
      { x: 575, y: 495 },
      { x: 575, y: 295 },
      { x: 595, y: 250 },
      { x: 645, y: 235 },
      { x: 785, y: 235 },
      { x: 830, y: 255 },
      { x: 845, y: 300 },
      { x: 845, y: 490 },
      { x: 865, y: 535 },
      { x: 915, y: 550 },
      { x: 1015, y: 540 },
      { x: 1065, y: 495 },
      { x: 1065, y: 445 },
    ];

    const curvePoints = wps.map((p) => new THREE.Vector3(p.x, 1, p.y));
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeo = new THREE.TubeGeometry(curve, 120, 34, 6, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: '#F5D698',
      roughness: 0.45,
      metalness: 0.1,
    });
    const pathMesh = new THREE.Mesh(tubeGeo, tubeMat);
    pathMesh.receiveShadow = true;
    pathMesh.castShadow = true;
    this.scene.add(pathMesh);

    // Decorative 3D Trees around perimeter
    const treePositions = [
      [80, 120], [80, 720], [210, 760], [560, 740], [1120, 140], [1130, 680], [980, 750],
      [60, 480], [1140, 420], [350, 80], [780, 80], [1020, 80],
    ];
    for (const [tx, tz] of treePositions) {
      this.create3DPineTree(tx, tz, 0.9 + Math.random() * 0.4);
    }

    // 3D Portal at start
    const portalGroup = this.create3DPortal();
    const startWp = wps[0];
    portalGroup.position.set(startWp.x, 0, startWp.y);
    this.scene.add(portalGroup);

    // 3D Castle at end
    const castleGroup = this.create3DCastle();
    const endWp = wps[wps.length - 1];
    castleGroup.position.set(endWp.x, 0, endWp.y);
    this.scene.add(castleGroup);
  }

  private create3DPineTree(x: number, z: number, scale = 1) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5C3A21', roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: '#22543D', roughness: 0.7 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(5 * scale, 7 * scale, 28 * scale, 6), trunkMat);
    trunk.position.y = 14 * scale;
    trunk.castShadow = true;
    group.add(trunk);

    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry((24 - i * 4) * scale, (30 - i * 4) * scale, 7),
        foliageMat
      );
      cone.position.y = (28 + i * 16) * scale;
      cone.castShadow = true;
      group.add(cone);
    }

    group.position.set(x, 0, z);
    this.scene.add(group);
  }

  private create3DPortal(): THREE.Group {
    const group = new THREE.Group();
    const ringMat = new THREE.MeshStandardMaterial({ color: '#3B0764', roughness: 0.3, metalness: 0.6 });
    const glowMat = new THREE.MeshBasicMaterial({ color: '#C084FC' });

    const arch = new THREE.Mesh(new THREE.TorusGeometry(26, 7, 12, 24), ringMat);
    arch.rotation.x = Math.PI / 2;
    arch.position.y = 26;
    arch.castShadow = true;
    group.add(arch);

    const core = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 16), glowMat);
    core.position.y = 26;
    group.add(core);

    return group;
  }

  private create3DCastle(): THREE.Group {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#CBD5E1', roughness: 0.6, metalness: 0.2 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#1E40AF', roughness: 0.4 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#FACC15', metalness: 0.8, roughness: 0.2 });

    const keep = new THREE.Mesh(new THREE.BoxGeometry(42, 52, 42), stoneMat);
    keep.position.y = 26;
    keep.castShadow = true;
    keep.receiveShadow = true;
    group.add(keep);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(30, 32, 4), roofMat);
    roof.position.y = 68;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 26), stoneMat);
    pole.position.y = 90;
    group.add(pole);

    const flag = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 0.6), goldMat);
    flag.position.set(6, 97, 0);
    group.add(flag);

    const offsets = [[-22, -22], [22, -22], [-22, 22], [22, 22]];
    for (const [ox, oz] of offsets) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 46, 8), stoneMat);
      tower.position.set(ox, 23, oz);
      tower.castShadow = true;
      group.add(tower);

      const troof = new THREE.Mesh(new THREE.ConeGeometry(10, 18, 8), roofMat);
      troof.position.set(ox, 55, oz);
      group.add(troof);
    }

    return group;
  }

  public updateScene(sim: GameSimulation) {
    // 1. Slots (Tactical Pads)
    for (const slot of sim.slots) {
      let mesh = this.slotMeshes.get(slot.id);
      if (!mesh) {
        const geo = new THREE.CylinderGeometry(24, 24, 4, 16);
        const mat = new THREE.MeshStandardMaterial({
          color: slot.unitId !== null ? '#14532D' : '#15803D',
          roughness: 0.4,
          transparent: true,
          opacity: 0.9,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(slot.x, 2, slot.y);
        mesh.receiveShadow = true;
        mesh.userData = { slotId: slot.id };
        this.scene.add(mesh);
        this.slotMeshes.set(slot.id, mesh);
      } else {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.set(slot.unitId !== null ? '#14532D' : '#16A34A');
      }
    }

    // 2. Units (Dark Souls Fantasy Styled Heroes)
    const activeUnitIds = new Set(sim.units.map((u) => u.id));
    for (const [id, group] of this.unitMeshes.entries()) {
      if (!activeUnitIds.has(id)) {
        this.scene.remove(group);
        this.unitMeshes.delete(id);
      }
    }

    for (const unit of sim.units) {
      let group = this.unitMeshes.get(unit.id);
      if (!group) {
        group = this.createDarkSoulsUnitMesh(unit.kind, unit.level);
        this.scene.add(group);
        this.unitMeshes.set(unit.id, group);
      }
      group.position.set(unit.x, 0, unit.y);
      group.rotation.y = -unit.facingAngle + Math.PI / 2;
    }

    // 3. Enemies (Dark Souls Fantasy Styled Monsters - Large & Imposing)
    const activeEnemyIds = new Set(sim.enemies.map((e) => e.id));
    for (const [id, group] of this.enemyMeshes.entries()) {
      if (!activeEnemyIds.has(id)) {
        this.scene.remove(group);
        this.enemyMeshes.delete(id);
      }
    }

    for (const enemy of sim.enemies) {
      let group = this.enemyMeshes.get(enemy.id);
      if (!group) {
        group = this.createDarkSoulsEnemyMesh(enemy.kind);
        this.scene.add(group);
        this.enemyMeshes.set(enemy.id, group);
      }
      group.position.set(enemy.x, 0, enemy.y);
      if (enemy.isDead) {
        group.rotation.x = Math.PI / 2;
        group.position.y = -6;
      } else {
        group.rotation.x = 0;
        group.position.y = 0;
      }
    }

    // 4. Projectiles
    const activeProjIds = new Set(sim.projectiles.map((p) => p.id));
    for (const [id, mesh] of this.projectileMeshes.entries()) {
      if (!activeProjIds.has(id)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(id);
      }
    }

    for (const proj of sim.projectiles) {
      let mesh = this.projectileMeshes.get(proj.id);
      if (!mesh) {
        const geo = new THREE.SphereGeometry(proj.radius * 1.3, 8, 8);
        const mat = new THREE.MeshStandardMaterial({
          color: proj.color,
          emissive: proj.color,
          emissiveIntensity: 0.9,
        });
        mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        this.projectileMeshes.set(proj.id, mesh);
      }
      mesh.position.set(proj.x, 16, proj.y);
    }
  }

  // Dark Souls Inspired High-Detail Hero Meshes (Large, Imposing, Textured Armor)
  private createDarkSoulsUnitMesh(kind: UnitKind, level: number): THREE.Group {
    const group = new THREE.Group();
    const scale = (1.5 + (level - 1) * 0.15); // Large, prominent scale
    group.scale.set(scale, scale, scale);

    if (kind === 'scout') {
      // Dark Ranger of Cinders
      const armorMat = new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.5, metalness: 0.4 });
      const leatherMat = new THREE.MeshStandardMaterial({ color: '#451A03', roughness: 0.7 });
      const emberMat = new THREE.MeshBasicMaterial({ color: '#F97316' });
      const steelMat = new THREE.MeshStandardMaterial({ color: '#94A3B8', metalness: 0.8, roughness: 0.2 });

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 24, 8), armorMat);
      torso.position.y = 14;
      torso.castShadow = true;
      group.add(torso);

      const hood = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 10), leatherMat);
      hood.position.y = 30;
      hood.castShadow = true;
      group.add(hood);

      const visor = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 2), emberMat);
      visor.position.set(0, 31, 8);
      group.add(visor);

      const bow = new THREE.Mesh(new THREE.TorusGeometry(13, 1.8, 6, 16, Math.PI), steelMat);
      bow.position.set(12, 18, 0);
      bow.rotation.y = Math.PI / 2;
      group.add(bow);
    } else if (kind === 'shield') {
      // Escudeiro Knight (matching reference image: plate armor, tattered cape, helm, sword & kite shield with emblem)
      const plateMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.75, roughness: 0.25 });
      const leatherMat = new THREE.MeshStandardMaterial({ color: '#451A03', roughness: 0.7 });
      const capeMat = new THREE.MeshStandardMaterial({ color: '#991B1B', roughness: 0.8 });
      const shieldWoodMat = new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.6, metalness: 0.4 });
      const steelMat = new THREE.MeshStandardMaterial({ color: '#94A3B8', metalness: 0.85, roughness: 0.15 });

      // Torso & Armor
      const body = new THREE.Mesh(new THREE.BoxGeometry(24, 28, 16), plateMat);
      body.position.y = 16;
      body.castShadow = true;
      group.add(body);

      // Tattered Red Cape behind
      const cape = new THREE.Mesh(new THREE.BoxGeometry(22, 30, 4), capeMat);
      cape.position.set(0, 16, -10);
      cape.castShadow = true;
      group.add(cape);

      // Helm & Visor
      const helm = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), plateMat);
      helm.position.y = 36;
      helm.castShadow = true;
      group.add(helm);

      const helmBand = new THREE.Mesh(new THREE.BoxGeometry(17, 3, 17), leatherMat);
      helmBand.position.y = 33;
      group.add(helmBand);

      // Sword in Right Hand
      const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(4, 34, 2.5), steelMat);
      swordBlade.position.set(-18, 10, 4);
      swordBlade.rotation.z = Math.PI / 6;
      group.add(swordBlade);

      // Large Kite Shield on Left Arm with Emblem
      const kiteShield = new THREE.Mesh(new THREE.BoxGeometry(16, 36, 5), shieldWoodMat);
      kiteShield.position.set(16, 16, 6);
      kiteShield.castShadow = true;
      group.add(kiteShield);

      // Shield Emblem (Griffin / Lion crest)
      const crestEmblem = new THREE.Mesh(new THREE.BoxGeometry(10, 18, 2), steelMat);
      crestEmblem.position.set(16, 16, 8.5);
      group.add(crestEmblem);
    } else if (kind === 'frog') {
      // Abyssal Berserker
      const beastMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.5, metalness: 0.2 });
      const ironMat = new THREE.MeshStandardMaterial({ color: '#0F172A', metalness: 0.8, roughness: 0.2 });
      const bladeMat = new THREE.MeshStandardMaterial({ color: '#94A3B8', metalness: 0.9, roughness: 0.1 });
      const glowingRed = new THREE.MeshBasicMaterial({ color: '#EF4444' });

      const body = new THREE.Mesh(new THREE.SphereGeometry(18, 12, 12), beastMat);
      body.position.y = 15;
      body.scale.set(1, 0.9, 1.3);
      body.castShadow = true;
      group.add(body);

      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 8), glowingRed);
      eyeL.position.set(-7, 26, 8);
      group.add(eyeL);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 8), glowingRed);
      eyeR.position.set(7, 26, 8);
      group.add(eyeR);

      // Horned Helm
      const helm = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 6), ironMat);
      helm.position.y = 33;
      group.add(helm);

      const greatsword = new THREE.Mesh(new THREE.BoxGeometry(5, 38, 3), bladeMat);
      greatsword.position.set(20, 18, 0);
      greatsword.rotation.z = -Math.PI / 4;
      group.add(greatsword);
    }

    return group;
  }

  // Dark Souls Inspired Monster Meshes (Large, Imposing, Dark Fantasy Style)
  private createDarkSoulsEnemyMesh(kind: EnemyEntity['kind']): THREE.Group {
    const group = new THREE.Group();
    const scale = 1.6; // Large, impressive scale

    if (kind === 'walker') {
      // Undead Hollow Warrior
      const ragMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 });
      const boneMat = new THREE.MeshStandardMaterial({ color: '#94A3B8', roughness: 0.6 });
      const evilRed = new THREE.MeshBasicMaterial({ color: '#EF4444' });

      const body = new THREE.Mesh(new THREE.BoxGeometry(20, 28, 15), ragMat);
      body.position.y = 15;
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), boneMat);
      head.position.y = 33;
      head.castShadow = true;
      group.add(head);

      const eye1 = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 2), evilRed);
      eye1.position.set(-4, 35, 8.5);
      group.add(eye1);
      const eye2 = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 2), evilRed);
      eye2.position.set(4, 35, 8.5);
      group.add(eye2);
    } else if (kind === 'shielded') {
      // Cursed Vanguard Knight
      const armorMat = new THREE.MeshStandardMaterial({ color: '#0F172A', metalness: 0.7, roughness: 0.3 });
      const shieldMat = new THREE.MeshStandardMaterial({ color: '#1E293B', metalness: 0.8, roughness: 0.2 });
      const evilRed = new THREE.MeshBasicMaterial({ color: '#DC2626' });

      const body = new THREE.Mesh(new THREE.BoxGeometry(24, 30, 18), armorMat);
      body.position.y = 17;
      body.castShadow = true;
      group.add(body);

      const shield = new THREE.Mesh(new THREE.BoxGeometry(22, 28, 5), shieldMat);
      shield.position.set(0, 17, 11);
      shield.castShadow = true;
      group.add(shield);

      const head = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), armorMat);
      head.position.y = 36;
      group.add(head);

      const visor = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 2), evilRed);
      visor.position.set(0, 37, 9);
      group.add(visor);
    } else if (kind === 'brute') {
      // Abyssal Ogre Brute
      const bruteMat = new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.6, metalness: 0.4 });
      const evilRed = new THREE.MeshBasicMaterial({ color: '#EF4444' });

      const body = new THREE.Mesh(new THREE.BoxGeometry(32, 38, 24), bruteMat);
      body.position.y = 20;
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(new THREE.BoxGeometry(22, 20, 22), bruteMat);
      head.position.y = 43;
      group.add(head);

      // Horns
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(4, 14, 4), bruteMat);
      hornL.position.set(-8, 53, 0);
      hornL.rotation.z = -0.3;
      group.add(hornL);
      const hornR = new THREE.Mesh(new THREE.ConeGeometry(4, 14, 4), bruteMat);
      hornR.position.set(8, 53, 0);
      hornR.rotation.z = 0.3;
      group.add(hornR);

      const eye1 = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 2), evilRed);
      eye1.position.set(-5, 44, 11.5);
      group.add(eye1);
      const eye2 = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 2), evilRed);
      eye2.position.set(5, 44, 11.5);
      group.add(eye2);
    } else if (kind === 'boss') {
      // Lord of Cinders / Dark Sovereign (Colossal Boss)
      const bossMat = new THREE.MeshStandardMaterial({ color: '#09090B', roughness: 0.4, metalness: 0.7 });
      const goldMat = new THREE.MeshStandardMaterial({ color: '#D97706', metalness: 0.9, roughness: 0.2 });
      const soulFire = new THREE.MeshBasicMaterial({ color: '#F97316' });

      const body = new THREE.Mesh(new THREE.BoxGeometry(44, 52, 34), bossMat);
      body.position.y = 28;
      body.castShadow = true;
      group.add(body);

      const core = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 12), soulFire);
      core.position.set(0, 28, 17);
      group.add(core);

      const head = new THREE.Mesh(new THREE.BoxGeometry(28, 26, 28), bossMat);
      head.position.y = 62;
      group.add(head);

      const crown = new THREE.Mesh(new THREE.ConeGeometry(16, 16, 6), goldMat);
      crown.position.y = 81;
      group.add(crown);

      const eye1 = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 2), soulFire);
      eye1.position.set(-6, 63, 14.5);
      group.add(eye1);
      const eye2 = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 2), soulFire);
      eye2.position.set(6, 63, 14.5);
      group.add(eye2);
    }

    group.scale.set(scale, scale, scale);
    return group;
  }

  public getWorldCoordFromScreen(clientX: number, clientY: number, containerWidth: number, containerHeight: number): { x: number; y: number } {
    this.mouse.x = (clientX / containerWidth) * 2 - 1;
    this.mouse.y = -(clientY / containerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, target);
    return { x: target.x, y: target.z };
  }

  public getClickedSlotId(clientX: number, clientY: number, containerWidth: number, containerHeight: number): string | null {
    this.mouse.x = (clientX / containerWidth) * 2 - 1;
    this.mouse.y = -(clientY / containerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.slotMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      return hitMesh.userData?.slotId || null;
    }
    return null;
  }

  public dispose() {
    this.renderer.dispose();
  }
}
