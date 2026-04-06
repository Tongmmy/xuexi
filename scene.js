(function createLucky49Scene() {
  const mount = document.querySelector("#tableCanvas");

  if (!mount || !window.THREE) {
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1f1712);
  scene.fog = new THREE.Fog(0x1f1712, 8, 19);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
  camera.position.set(0, 5.6, 8.9);
  camera.lookAt(0, 0.7, 0);

  const root = new THREE.Group();
  scene.add(root);

  const ambient = new THREE.AmbientLight(0xf8ead4, 1.3);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff1d9, 2.1);
  keyLight.position.set(4, 8, 5);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0xc57043, 16, 18, 2);
  rimLight.position.set(-2.6, 2.8, 2.5);
  scene.add(rimLight);

  const topGlow = new THREE.PointLight(0xf1c27d, 18, 20, 2);
  topGlow.position.set(0, 4.8, -1.8);
  scene.add(topGlow);

  const feltMaterial = new THREE.MeshStandardMaterial({
    color: 0x274936,
    roughness: 0.88,
    metalness: 0.08
  });

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x5f341f,
    roughness: 0.64,
    metalness: 0.12
  });

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xb88945,
    roughness: 0.22,
    metalness: 0.82
  });

  const tableGroup = new THREE.Group();
  root.add(tableGroup);

  const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.9, 64), woodMaterial);
  tableBase.position.y = -0.32;
  tableGroup.add(tableBase);

  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.15, 0.34, 64), feltMaterial);
  tableTop.position.y = 0.16;
  tableGroup.add(tableTop);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.65, 0.24, 18, 100), metalMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.38;
  tableGroup.add(rim);

  const centerPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.24, 1.24, 0.05, 40),
    new THREE.MeshStandardMaterial({ color: 0x1a2f25, roughness: 0.82, metalness: 0.05 })
  );
  centerPlate.position.y = 0.36;
  tableGroup.add(centerPlate);

  const chipPalette = [0xb34c3d, 0xede2c7, 0x263728, 0x4f7186];
  const chips = [];
  for (let index = 0; index < 12; index += 1) {
    const chip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.12, 30),
      new THREE.MeshStandardMaterial({
        color: chipPalette[index % chipPalette.length],
        roughness: 0.36,
        metalness: 0.08
      })
    );
    const angle = (index / 12) * Math.PI * 2;
    const radius = 2.48 + (index % 2) * 0.16;
    chip.position.set(Math.cos(angle) * radius, 0.48, Math.sin(angle) * radius);
    chip.rotation.x = Math.PI / 2;
    tableGroup.add(chip);
    chips.push({ mesh: chip, angle, radius, speed: 0.0015 + (index % 4) * 0.0005 });
  }

  const resultBallMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8dbc5,
    roughness: 0.28,
    metalness: 0.12,
    emissive: 0x000000
  });

  const resultBall = new THREE.Mesh(new THREE.SphereGeometry(0.62, 40, 40), resultBallMaterial);
  resultBall.position.set(0, 2.4, 0);
  tableGroup.add(resultBall);

  const orbitBalls = [];
  const orbitPalette = [0xb34c3d, 0x4f7186, 0x617c59];
  for (let index = 0; index < 3; index += 1) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 24, 24),
      new THREE.MeshStandardMaterial({
        color: orbitPalette[index],
        roughness: 0.32,
        metalness: 0.15
      })
    );
    tableGroup.add(mesh);
    orbitBalls.push({
      mesh,
      radius: 1.2 + index * 0.38,
      speed: 0.6 + index * 0.25,
      offset: index * 2.1
    });
  }

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.5, 18), woodMaterial);
  pedestal.position.set(0, -0.85, 0);
  tableGroup.add(pedestal);

  const waveColors = {
    red: 0xb44c40,
    blue: 0x4a6f86,
    green: 0x597451
  };

  const animationState = {
    lastDrawAt: 0,
    timerPulse: 1,
    currentWave: "red"
  };

  function setResultWave(wave) {
    animationState.currentWave = wave;
    resultBallMaterial.color.setHex(waveColors[wave] || 0xe8dbc5);
    resultBallMaterial.emissive.setHex(waveColors[wave] || 0x000000);
  }

  function handleResize() {
    const { clientWidth, clientHeight } = mount;
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    camera.position.set(0, clientWidth < 520 ? 6.2 : 5.6, clientWidth < 520 ? 9.8 : 8.9);
    camera.lookAt(0, 0.7, 0);
  }

  window.addEventListener("resize", handleResize);

  window.addEventListener("lucky49:timer", (event) => {
    const progress = event.detail?.progress ?? 1;
    animationState.timerPulse = 0.88 + (1 - progress) * 0.26;
    topGlow.intensity = 16 + (1 - progress) * 8;
  });

  window.addEventListener("lucky49:state", (event) => {
    const selectedCategory = event.detail?.selectedCategory;
    if (selectedCategory === "size") {
      rim.material.color.setHex(0xb88945);
    } else if (selectedCategory === "parity") {
      rim.material.color.setHex(0xa24f38);
    } else {
      rim.material.color.setHex(0x667d59);
    }
  });

  window.addEventListener("lucky49:draw", (event) => {
    const result = event.detail?.result;
    if (!result) {
      return;
    }

    animationState.lastDrawAt = performance.now();
    setResultWave(result.wave);
  });

  const clock = new THREE.Clock();

  function animate() {
    const elapsed = clock.getElapsedTime();
    const now = performance.now();
    const sinceDraw = (now - animationState.lastDrawAt) / 1000;
    const drawBounce = Math.max(0, 1 - sinceDraw * 1.6);

    chips.forEach((chip) => {
      chip.angle += chip.speed * animationState.timerPulse;
      chip.mesh.position.x = Math.cos(chip.angle) * chip.radius;
      chip.mesh.position.z = Math.sin(chip.angle) * chip.radius;
      chip.mesh.rotation.y += 0.02;
    });

    orbitBalls.forEach((item, index) => {
      const angle = elapsed * item.speed + item.offset;
      item.mesh.position.set(
        Math.cos(angle) * item.radius,
        0.62 + Math.sin(elapsed * 2 + index) * 0.08,
        Math.sin(angle) * item.radius
      );
    });

    resultBall.position.y = 1.02 + Math.abs(Math.sin(elapsed * 1.4)) * 0.16 + drawBounce * 1.5;
    resultBall.rotation.y += 0.02 + drawBounce * 0.08;
    resultBall.scale.setScalar(1 + drawBounce * 0.18);

    tableGroup.rotation.y = Math.sin(elapsed * 0.18) * 0.08;
    rim.rotation.z += 0.002;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  handleResize();
  setResultWave("red");
  animate();
})();
