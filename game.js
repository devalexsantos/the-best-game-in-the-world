import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Global variables
let scene, camera, renderer;
let car, house;
let clock = new THREE.Clock();
let loadingScreen = document.getElementById('loading-screen');

// Vehicle state
const vehicleState = {
    // Position and rotation
    rotation: 0,
    velocity: 0,
    steerAngle: 0,

    // Drift
    driftAngle: 0,
    driftVelocity: 0,
    isDrifting: false,
    driftFactor: 0,

    // Car settings
    maxSpeed: 15,
    acceleration: 8,
    deceleration: 10,
    brakeForce: 15,
    steerSpeed: 1.8,      // Reduced from 2.5 to 1.8 (smoother)
    maxSteerAngle: 0.3,   // Reduced from 0.5 to 0.3 (less maximum angle)
    friction: 5,
    driftFriction: 0.95,  // Friction during drift
    driftMultiplier: 2.5, // Turn multiplier during drift

    // Camera
    cameraDistance: 8,  // Closer (was 12)
    cameraHeight: 4,    // Slightly lower (was 5)
    cameraLookAhead: 2, // Look less ahead (was 3)
    cameraSmooth: 8,

    // Controls
    accelerating: false,
    braking: false,
    steeringLeft: false,
    steeringRight: false,
    handbrake: false
};

// Keyboard controls
const keys = {};

// Initialization
function init() {
    console.log('=== RACING GAME V4.0 - DRIFT MODE ===');
    console.log('Controls: W/S = Accelerate/Reverse, A/D = Turn, Space = DRIFT!');

    // Setup scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 30, 300);

    // Setup camera
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    // Setup renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    // Add lighting
    setupLighting();

    // Create environment
    createEnvironment();

    // Load models
    loadModels();

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Start animation loop
    animate();
}

// Setup lighting
function setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    scene.add(directionalLight);

    // Hemisphere light
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x545454, 0.4);
    scene.add(hemisphereLight);
}

// Create environment (road and scenery)
function createEnvironment() {
    // Create road/track
    const roadGeometry = new THREE.PlaneGeometry(500, 500);
    const roadMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    road.receiveShadow = true;
    scene.add(road);

    // Create track lines
    const lineGeometry = new THREE.PlaneGeometry(2, 100);
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    for (let i = -20; i <= 20; i += 10) {
        if (i === 0) continue;
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.set(i, 0.01, 0);
        scene.add(line);
    }

    // Grid for visual reference
    const gridHelper = new THREE.GridHelper(200, 40, 0x444444, 0x666666);
    gridHelper.position.y = 0.005;
    scene.add(gridHelper);

    // Add some random trees/objects
    const treeGeometry = new THREE.ConeGeometry(3, 8, 8);
    const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x0f7938 });

    for (let i = 0; i < 20; i++) {
        const tree = new THREE.Mesh(treeGeometry, treeMaterial);
        const angle = (i / 20) * Math.PI * 2;
        const distance = 30 + Math.random() * 50;
        tree.position.set(
            Math.cos(angle) * distance,
            4,
            Math.sin(angle) * distance
        );
        tree.castShadow = true;
        scene.add(tree);
    }
}

// Load GLB models
function loadModels() {
    const loader = new GLTFLoader();
    let modelsLoaded = 0;
    const totalModels = 2;

    function checkAllModelsLoaded() {
        modelsLoaded++;
        if (modelsLoaded === totalModels) {
            loadingScreen.style.display = 'none';
            console.log('All models loaded!');
        }
    }

    // Load house
    loader.load(
        'assets/house.glb',
        (gltf) => {
            house = gltf.scene;
            house.position.set(30, 0, -40);
            house.scale.set(3, 3, 3);

            // Adjust height if necessary
            const box = new THREE.Box3().setFromObject(house);
            if (box.min.y < 0) {
                house.position.y = -box.min.y;
            }

            // Enable shadows
            house.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(house);
            checkAllModelsLoaded();
        },
        (progress) => {
            console.log('Loading house...', Math.round(progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
            console.error('Error loading house:', error);
            checkAllModelsLoaded();
        }
    );

    // Load car
    loader.load(
        'assets/car.glb',
        (gltf) => {
            car = gltf.scene;
            car.position.set(0, 0, 0);
            car.scale.set(2, 2, 2);

            // Adjust initial height and rotation
            const box = new THREE.Box3().setFromObject(car);
            if (box.min.y < 0) {
                car.position.y = -box.min.y;
            }

            // Rotate car -90 degrees so front points upward
            car.rotation.y = -Math.PI / 2; // -90 degrees

            // Enable shadows
            car.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // If it's glass, make it semi-transparent
                    if (child.material && child.material.name &&
                        (child.material.name.toLowerCase().includes('glass') ||
                         child.material.name.toLowerCase().includes('window'))) {
                        child.material.transparent = true;
                        child.material.opacity = 0.6;
                    }
                }
            });

            scene.add(car);

            // Position initial camera behind car
            updateCarCamera(0);

            console.log('Car loaded!');
            checkAllModelsLoaded();
        },
        (progress) => {
            console.log('Loading car...', Math.round(progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
            console.error('Error loading car:', error);
            checkAllModelsLoaded();
        }
    );
}

// Update car camera
function updateCarCamera(delta) {
    if (!car) return;

    // Calculate ideal camera position (behind car)
    const idealOffset = new THREE.Vector3(
        -Math.sin(vehicleState.rotation) * vehicleState.cameraDistance,
        vehicleState.cameraHeight,
        -Math.cos(vehicleState.rotation) * vehicleState.cameraDistance
    );

    // Add a small speed-based offset for dynamic effect
    const speedOffset = vehicleState.velocity * 0.1;
    idealOffset.multiplyScalar(1 + Math.abs(speedOffset) * 0.05);

    const idealPosition = car.position.clone().add(idealOffset);

    // Calculate where camera should look
    const lookAheadDistance = vehicleState.cameraLookAhead + Math.abs(vehicleState.velocity) * 0.2;
    const idealLookAt = new THREE.Vector3(
        car.position.x + Math.sin(vehicleState.rotation) * lookAheadDistance,
        car.position.y + 1,
        car.position.z + Math.cos(vehicleState.rotation) * lookAheadDistance
    );

    // Smooth camera movement
    if (delta > 0) {
        camera.position.lerp(idealPosition, vehicleState.cameraSmooth * delta);

        // Make camera look at car
        const currentLookAt = new THREE.Vector3();
        camera.getWorldDirection(currentLookAt);
        currentLookAt.multiplyScalar(10).add(camera.position);
        currentLookAt.lerp(idealLookAt, vehicleState.cameraSmooth * delta);
        camera.lookAt(currentLookAt);
    } else {
        // Initial positioning
        camera.position.copy(idealPosition);
        camera.lookAt(idealLookAt);
    }
}

// Update vehicle physics
function updateVehiclePhysics(delta) {
    if (!car) return;

    // Steering
    const targetSteerAngle =
        (vehicleState.steeringLeft ? vehicleState.maxSteerAngle : 0) +
        (vehicleState.steeringRight ? -vehicleState.maxSteerAngle : 0);

    vehicleState.steerAngle = THREE.MathUtils.lerp(
        vehicleState.steerAngle,
        targetSteerAngle,
        vehicleState.steerSpeed * delta * 3
    );

    // Acceleration and braking
    if (vehicleState.accelerating) {
        vehicleState.velocity += vehicleState.acceleration * delta;
    } else if (vehicleState.braking) {
        vehicleState.velocity -= vehicleState.brakeForce * delta;
    } else {
        // Natural deceleration (friction)
        if (vehicleState.velocity > 0) {
            vehicleState.velocity -= vehicleState.friction * delta;
            if (vehicleState.velocity < 0) vehicleState.velocity = 0;
        } else if (vehicleState.velocity < 0) {
            vehicleState.velocity += vehicleState.friction * delta;
            if (vehicleState.velocity > 0) vehicleState.velocity = 0;
        }
    }

    // Drift system with handbrake
    if (vehicleState.handbrake && Math.abs(vehicleState.velocity) > 3) {
        vehicleState.isDrifting = true;

        // Gradually increase drift factor
        vehicleState.driftFactor = Math.min(vehicleState.driftFactor + delta * 3, 1);

        // Gradually reduce speed during drift
        vehicleState.velocity *= vehicleState.driftFriction;

        // Add drift angle based on direction and speed
        if (vehicleState.steeringLeft || vehicleState.steeringRight) {
            const driftDirection = vehicleState.steeringLeft ? 1 : -1;
            vehicleState.driftAngle += driftDirection * vehicleState.velocity * 0.05 * delta;
            vehicleState.driftVelocity = vehicleState.velocity * 0.3;
        }

        // Apply lateral drift
        const lateralDrift = Math.sin(vehicleState.driftAngle) * vehicleState.driftVelocity * delta;
        car.position.x += Math.cos(vehicleState.rotation) * lateralDrift * vehicleState.driftFactor;
        car.position.z -= Math.sin(vehicleState.rotation) * lateralDrift * vehicleState.driftFactor;

    } else {
        // Gradually reduce drift when releasing brake
        vehicleState.driftFactor = Math.max(vehicleState.driftFactor - delta * 2, 0);
        vehicleState.driftAngle *= 0.9;
        vehicleState.driftVelocity *= 0.9;

        if (vehicleState.driftFactor < 0.1) {
            vehicleState.isDrifting = false;
        }
    }

    // Limit speed
    vehicleState.velocity = THREE.MathUtils.clamp(
        vehicleState.velocity,
        -vehicleState.maxSpeed * 0.3, // Slower reverse
        vehicleState.maxSpeed
    );

    // Apply steering (with extra multiplier during drift)
    if (Math.abs(vehicleState.velocity) > 0.1) {
        let steerMultiplier = 1;
        if (vehicleState.isDrifting) {
            steerMultiplier = vehicleState.driftMultiplier; // More turning during drift
        }
        const steerInfluence = vehicleState.steerAngle * Math.min(Math.abs(vehicleState.velocity) / 5, 1) * steerMultiplier;
        vehicleState.rotation += steerInfluence * vehicleState.velocity * delta;
    }

    // Apply rotation to car (with -90 degree offset)
    car.rotation.y = vehicleState.rotation - Math.PI / 2;

    // Move car
    const moveDistance = vehicleState.velocity * delta;
    car.position.x += Math.sin(vehicleState.rotation) * moveDistance;
    car.position.z += Math.cos(vehicleState.rotation) * moveDistance;

    // Tilt car in curves (more tilt during drift)
    let tiltMultiplier = vehicleState.isDrifting ? 0.06 : 0.02;
    car.rotation.z = -vehicleState.steerAngle * vehicleState.velocity * tiltMultiplier;

    // Add extra rotation during drift for visual effect
    if (vehicleState.isDrifting) {
        // Small oscillation to simulate sliding
        const driftOscillation = Math.sin(Date.now() * 0.01) * 0.02 * vehicleState.driftFactor;
        car.rotation.y += driftOscillation;

        // Tilt car slightly backward during drift
        car.rotation.x = -vehicleState.driftFactor * 0.05;
    } else {
        car.rotation.x = 0;
    }

    // Update camera
    updateCarCamera(delta);
}

// Event handlers
function onKeyDown(event) {
    keys[event.key] = true;

    switch(event.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            vehicleState.accelerating = true;
            break;
        case 's':
        case 'arrowdown':
            vehicleState.braking = true;
            break;
        case 'a':
        case 'arrowleft':
            vehicleState.steeringLeft = true;
            break;
        case 'd':
        case 'arrowright':
            vehicleState.steeringRight = true;
            break;
        case ' ':
            vehicleState.handbrake = true;
            break;
    }

    // Prevent page scroll
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
    }
}

function onKeyUp(event) {
    keys[event.key] = false;

    switch(event.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            vehicleState.accelerating = false;
            break;
        case 's':
        case 'arrowdown':
            vehicleState.braking = false;
            break;
        case 'a':
        case 'arrowleft':
            vehicleState.steeringLeft = false;
            break;
        case 'd':
        case 'arrowright':
            vehicleState.steeringRight = false;
            break;
        case ' ':
            vehicleState.handbrake = false;
            break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);

    // Update vehicle physics
    updateVehiclePhysics(delta);

    // Render scene
    renderer.render(scene, camera);
}

// Start application
init();