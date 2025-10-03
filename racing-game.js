import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Global variables
let scene, camera, renderer;
let car, house;
let clock = new THREE.Clock();
let loadingScreen = document.getElementById('loading-screen');

// Obstacles and collisions
let obstacles = [];
let carBoundingBox;

// Game state
const gameState = {
    isPlaying: false,
    isCountingDown: false,
    countdown: 3,
    raceTime: 0,
    bestTime: localStorage.getItem('bestTime') || null,
    hasWon: false,
    hasLost: false,
    freeRoam: false, // Free mode after winning
    startPosition: new THREE.Vector3(0, 0, 0),
    finishLineZ: -300, // Increased - Z position of finish line
    carGroundLevel: 0, // Ground height for the car
    trackSegments: [] // Track segments with curves
};

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
    maxSpeed: 25,  // Original max speed
    acceleration: 15, // Original acceleration
    deceleration: 12,
    brakeForce: 18,
    steerSpeed: 0.8,  // Much smoother steering
    maxSteerAngle: 0.15, // Much reduced angle for smooth turns
    friction: 5,
    driftFriction: 0.95,
    driftMultiplier: 2.5,

    // Camera
    cameraDistance: 8,
    cameraHeight: 4,
    cameraLookAhead: 2,
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

// UI Elements
let countdownElement, timerElement, messageElement, recordElement;

// Explosion particles
let explosionParticles = [];

// Mobile controls state
let mobileControls = {};

// Check if device is mobile
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768);
}

// Initialization
function init() {
    console.log('=== RACING GAME V5.0 - OBSTACLE COURSE ===');
    console.log('Goal: Reach the house without hitting the trees!');

    // Prevent scrolling on mobile
    if (isMobileDevice()) {
        document.body.style.touchAction = 'none';
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
    }

    // Create UI elements
    createUIElements();

    // Setup scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, 250); // Reduce fog range

    // Setup camera
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    // Setup renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance" // Prioritize performance
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Limit pixel ratio for better performance
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Disable complex shadows for better performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap; // Faster than PCFSoft
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    // Add lighting
    setupLighting();

    // Create race track
    createRaceTrack();

    // Load models
    loadModels();

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Start animation loop
    animate();
}

// Create interface elements
function createUIElements() {
    // Create mobile controls if on mobile device
    if (isMobileDevice()) {
        createMobileControls();
    }

    // Countdown
    countdownElement = document.createElement('div');
    countdownElement.id = 'countdown';
    countdownElement.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 120px;
        font-weight: bold;
        color: white;
        text-shadow: 3px 3px 6px rgba(0,0,0,0.7);
        display: none;
        z-index: 1000;
    `;
    document.body.appendChild(countdownElement);

    // Timer
    timerElement = document.createElement('div');
    timerElement.id = 'timer';
    timerElement.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        font-size: 32px;
        font-weight: bold;
        color: white;
        background: rgba(0,0,0,0.5);
        padding: 10px 20px;
        border-radius: 10px;
        display: none;
        z-index: 100;
    `;
    document.body.appendChild(timerElement);

    // Messages
    messageElement = document.createElement('div');
    messageElement.id = 'message';
    messageElement.style.cssText = `
        position: fixed;
        top: 40%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 48px;
        font-weight: bold;
        color: white;
        text-align: center;
        text-shadow: 3px 3px 6px rgba(0,0,0,0.7);
        display: none;
        z-index: 1000;
        background: rgba(0,0,0,0.5);
        padding: 20px 40px;
        border-radius: 20px;
    `;
    document.body.appendChild(messageElement);

    // Record element
    recordElement = document.createElement('div');
    recordElement.id = 'record';
    recordElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        font-size: 20px;
        font-weight: bold;
        color: gold;
        background: rgba(0,0,0,0.7);
        padding: 15px 20px;
        border-radius: 10px;
        display: block;
        z-index: 99;
        border: 2px solid gold;
        text-align: center;
        min-width: 150px;
    `;

    // Load record from localStorage
    const bestTime = localStorage.getItem('bestTime');
    if (bestTime) {
        recordElement.innerHTML = `
            <div style="color: white; font-size: 14px; margin-bottom: 5px;">🏆 BEST TIME</div>
            <div style="font-size: 24px;">${bestTime}s</div>
        `;
    } else {
        recordElement.innerHTML = `
            <div style="color: white; font-size: 14px; margin-bottom: 5px;">🏆 BEST TIME</div>
            <div style="font-size: 20px; color: #888;">--:--</div>
        `;
    }
    document.body.appendChild(recordElement);
}

// Create mobile control buttons
function createMobileControls() {
    // Create container for all controls
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'mobile-controls';
    controlsContainer.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 1001;
        pointer-events: none;
    `;

    // Create left controls (directional pad)
    const leftControls = document.createElement('div');
    leftControls.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 20px;
        width: 150px;
        height: 150px;
        pointer-events: all;
    `;

    // Create directional buttons
    const btnUp = createControlButton('↑', 'up', {
        position: 'absolute',
        top: '0px',
        left: '50px',
        width: '50px',
        height: '50px'
    });

    const btnDown = createControlButton('↓', 'down', {
        position: 'absolute',
        bottom: '0px',
        left: '50px',
        width: '50px',
        height: '50px'
    });

    const btnLeft = createControlButton('←', 'left', {
        position: 'absolute',
        top: '50px',
        left: '0px',
        width: '50px',
        height: '50px'
    });

    const btnRight = createControlButton('→', 'right', {
        position: 'absolute',
        top: '50px',
        right: '0px',
        width: '50px',
        height: '50px'
    });

    leftControls.appendChild(btnUp);
    leftControls.appendChild(btnDown);
    leftControls.appendChild(btnLeft);
    leftControls.appendChild(btnRight);

    // Create right controls (action buttons)
    const rightControls = document.createElement('div');
    rightControls.style.cssText = `
        position: absolute;
        bottom: 20px;
        right: 20px;
        pointer-events: all;
    `;

    // Create action buttons - vertically stacked
    const btnDrift = createControlButton('DRIFT', 'drift', {
        position: 'absolute',
        bottom: '140px',
        right: '0px',
        width: '80px',
        height: '60px',
        backgroundColor: 'rgba(200, 200, 0, 0.5)',
        fontSize: '16px'
    });

    const btnBrake = createControlButton('BRAKE', 'brake', {
        position: 'absolute',
        bottom: '70px',
        right: '0px',
        width: '80px',
        height: '60px',
        backgroundColor: 'rgba(200, 0, 0, 0.5)',
        fontSize: '16px'
    });

    const btnAccelerate = createControlButton('GAS', 'accelerate', {
        position: 'absolute',
        bottom: '0px',
        right: '0px',
        width: '80px',
        height: '60px',
        backgroundColor: 'rgba(0, 200, 0, 0.5)',
        fontSize: '18px'
    });

    rightControls.appendChild(btnDrift);
    rightControls.appendChild(btnBrake);
    rightControls.appendChild(btnAccelerate);

    // Add mobile control instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        font-size: 12px;
        text-align: center;
        background: rgba(0,0,0,0.5);
        padding: 5px 10px;
        border-radius: 5px;
        pointer-events: none;
    `;
    instructions.innerHTML = '📱 MOBILE CONTROLS ACTIVE';
    controlsContainer.appendChild(instructions);

    // Add controls to container
    controlsContainer.appendChild(leftControls);
    controlsContainer.appendChild(rightControls);

    // Add container to body
    document.body.appendChild(controlsContainer);

    // Store references
    mobileControls = {
        container: controlsContainer,
        buttons: {
            up: btnUp,
            down: btnDown,
            left: btnLeft,
            right: btnRight,
            accelerate: btnAccelerate,
            brake: btnBrake,
            drift: btnDrift
        }
    };
}

// Helper function to create control button
function createControlButton(label, action, styles) {
    const button = document.createElement('button');
    button.textContent = label;
    button.dataset.action = action;

    // Default button styles
    const defaultStyles = {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        border: '2px solid rgba(255, 255, 255, 0.6)',
        borderRadius: '10px',
        color: 'white',
        fontSize: '20px',
        fontWeight: 'bold',
        cursor: 'pointer',
        userSelect: 'none',
        webkitUserSelect: 'none',
        touchAction: 'none',
        transition: 'all 0.1s',
        textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
    };

    // Merge styles
    const finalStyles = { ...defaultStyles, ...styles };

    // Apply styles
    let cssText = '';
    for (const [key, value] of Object.entries(finalStyles)) {
        const cssKey = key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        cssText += `${cssKey}: ${value}; `;
    }
    button.style.cssText = cssText;

    // Add touch event handlers
    button.addEventListener('touchstart', handleTouchStart, { passive: false });
    button.addEventListener('touchend', handleTouchEnd, { passive: false });
    button.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Also add mouse events for desktop testing
    button.addEventListener('mousedown', handleTouchStart);
    button.addEventListener('mouseup', handleTouchEnd);
    button.addEventListener('mouseleave', handleTouchEnd);

    return button;
}

// Handle touch/mouse start on control buttons
function handleTouchStart(event) {
    event.preventDefault();
    const action = event.target.dataset.action;

    // Visual feedback
    event.target.style.transform = 'scale(0.9)';
    event.target.style.backgroundColor = event.target.style.backgroundColor.replace('0.3', '0.6');

    // Set control state based on action
    switch(action) {
        case 'up':
        case 'accelerate':
            vehicleState.accelerating = true;
            break;
        case 'down':
        case 'brake':
            vehicleState.braking = true;
            break;
        case 'left':
            vehicleState.steeringLeft = true;
            break;
        case 'right':
            vehicleState.steeringRight = true;
            break;
        case 'drift':
            vehicleState.handbrake = true;
            break;
    }
}

// Handle touch/mouse end on control buttons
function handleTouchEnd(event) {
    event.preventDefault();
    const action = event.target.dataset.action;

    // Reset visual feedback
    event.target.style.transform = 'scale(1)';
    event.target.style.backgroundColor = event.target.style.backgroundColor.replace('0.6', '0.3');

    // Reset control state based on action
    switch(action) {
        case 'up':
        case 'accelerate':
            vehicleState.accelerating = false;
            break;
        case 'down':
        case 'brake':
            vehicleState.braking = false;
            break;
        case 'left':
            vehicleState.steeringLeft = false;
            break;
        case 'right':
            vehicleState.steeringRight = false;
            break;
        case 'drift':
            vehicleState.handbrake = false;
            break;
    }
}

// Setup lighting
function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

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

    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x545454, 0.4);
    scene.add(hemisphereLight);
}

// Create race track
function createRaceTrack() {
    const trackMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1
    });

    // Define track segments with curves - properly connected
    gameState.trackSegments = [
        { start: 0, end: -50, xOffset: 0, width: 35 },        // Initial straight
        { start: -50, end: -80, xOffset: 10, width: 35 },     // Right curve transition
        { start: -80, end: -120, xOffset: 20, width: 35 },    // Right curve
        { start: -120, end: -160, xOffset: 20, width: 35 },   // Right straight
        { start: -160, end: -190, xOffset: 0, width: 35 },    // Center transition
        { start: -190, end: -230, xOffset: -20, width: 35 },  // Left curve
        { start: -230, end: -260, xOffset: -20, width: 35 },  // Left straight
        { start: -260, end: -280, xOffset: -10, width: 35 },  // Back to center transition
        { start: -280, end: -320, xOffset: 0, width: 35 }     // Final straight
    ];

    // Create track segments
    gameState.trackSegments.forEach((segment, index) => {
        const length = Math.abs(segment.end - segment.start);
        const trackGeometry = new THREE.PlaneGeometry(segment.width, length);
        const track = new THREE.Mesh(trackGeometry, trackMaterial);
        track.rotation.x = -Math.PI / 2;
        track.position.set(segment.xOffset, 0, (segment.start + segment.end) / 2);
        track.receiveShadow = true;
        scene.add(track);

        // Side lines
        const lineGeometry = new THREE.PlaneGeometry(0.5, length);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        const leftLine = new THREE.Mesh(lineGeometry, lineMaterial);
        leftLine.rotation.x = -Math.PI / 2;
        leftLine.position.set(segment.xOffset - segment.width/2, 0.01, (segment.start + segment.end) / 2);
        scene.add(leftLine);

        const rightLine = new THREE.Mesh(lineGeometry, lineMaterial);
        rightLine.rotation.x = -Math.PI / 2;
        rightLine.position.set(segment.xOffset + segment.width/2, 0.01, (segment.start + segment.end) / 2);
        scene.add(rightLine);
    });

    // Starting line
    const startLineGeometry = new THREE.PlaneGeometry(30, 2);
    const startLineMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const startLine = new THREE.Mesh(startLineGeometry, startLineMaterial);
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(0, 0.02, 5);
    scene.add(startLine);

    // Finish line
    const finishLineGeometry = new THREE.PlaneGeometry(30, 2);
    const finishLineMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: createCheckerboardTexture()
    });
    const finishLine = new THREE.Mesh(finishLineGeometry, finishLineMaterial);
    finishLine.rotation.x = -Math.PI / 2;
    finishLine.position.set(0, 0.02, gameState.finishLineZ);
    scene.add(finishLine);

    // Add trees as obstacles on track
    createObstacles();

    // Grass around track (reduce size for better performance)
    const grassGeometry = new THREE.PlaneGeometry(800, 800);
    const grassMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a7d3a,
        roughness: 1,
        metalness: 0
    });
    const grass = new THREE.Mesh(grassGeometry, grassMaterial);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.01;
    grass.receiveShadow = true;
    scene.add(grass);
}

// Create checkerboard texture for finish line
function createCheckerboardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const size = 32;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#000000';
            ctx.fillRect(i * size, j * size, size, size);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 1);
    return texture;
}

// Create obstacles (trees on track)
function createObstacles() {
    // Reduce segments for better performance
    const treeGeometry = new THREE.ConeGeometry(2, 6, 6);
    const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x0f7938 });
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 6);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });

    // Optimized obstacles with extra challenge
    const obstaclePositions = [
        // First straight
        { x: -7, z: -20 },
        { x: 5, z: -30 },
        { x: -2, z: -45 }, // New random tree

        // First curve (right)
        { x: 15, z: -70 },
        { x: 25, z: -80 },
        { x: 20, z: -85 }, // New random tree

        // Middle straight
        { x: 15, z: -110 },
        { x: 20, z: -130 },
        { x: 10, z: -120 }, // New tree in middle

        // Second curve (left)
        { x: -5, z: -170 },
        { x: -15, z: -180 },
        { x: 0, z: -190 }, // New random tree

        // Straight after curve
        { x: -25, z: -210 },
        { x: -20, z: -230 },
        { x: -12, z: -245 }, // New random tree

        // Final straight
        { x: -8, z: -260 },
        { x: 5, z: -270 }, // New tree near end
        { x: 0, z: -280 }
    ];

    obstaclePositions.forEach(pos => {
        const treeGroup = new THREE.Group();

        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1;
        treeGroup.add(trunk);

        const tree = new THREE.Mesh(treeGeometry, treeMaterial);
        tree.position.y = 5;
        treeGroup.add(tree);

        treeGroup.position.set(pos.x, 0, pos.z);
        // Disable tree shadows for better performance
        // treeGroup.castShadow = true;

        scene.add(treeGroup);
        obstacles.push(treeGroup);
    });
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
            // Start countdown after loading
            startCountdown();
        }
    }

    // Load house (finish line)
    loader.load(
        'assets/house.glb',
        (gltf) => {
            house = gltf.scene;
            house.position.set(0, 0, gameState.finishLineZ - 20);
            house.scale.set(15, 15, 15); // Increased 5x (from 3 to 15)

            const box = new THREE.Box3().setFromObject(house);
            if (box.min.y < 0) {
                house.position.y = -box.min.y;
            }

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
            car.position.copy(gameState.startPosition);
            car.scale.set(6, 6, 6); // Increased 3x (from 2 to 6)

            // Calculate and adjust car height
            const box = new THREE.Box3().setFromObject(car);
            const carHeight = box.max.y - box.min.y;
            gameState.carGroundLevel = -box.min.y + 0.1; // Add small margin
            car.position.y = gameState.carGroundLevel;

            console.log('Car height adjusted:', gameState.carGroundLevel);

            // Set initial position and rotation BEFORE countdown
            car.position.set(0, gameState.carGroundLevel, 0);
            car.rotation.y = -Math.PI / 2; // -90 degrees to point forward to track
            vehicleState.rotation = Math.PI; // Adjust initial rotation state

            car.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.material && child.material.name &&
                        (child.material.name.toLowerCase().includes('glass') ||
                         child.material.name.toLowerCase().includes('window'))) {
                        child.material.transparent = true;
                        child.material.opacity = 0.6;
                    }
                }
            });

            // Create bounding box for collision
            carBoundingBox = new THREE.Box3().setFromObject(car);

            scene.add(car);

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

// Start countdown
function startCountdown() {
    // First reset car to correct position and orientation
    resetCar();

    // Hide mobile controls during countdown
    if (mobileControls.container) {
        mobileControls.container.style.display = 'none';
    }

    gameState.isCountingDown = true;
    gameState.countdown = 3;
    countdownElement.style.display = 'block';

    const countInterval = setInterval(() => {
        if (gameState.countdown > 0) {
            countdownElement.textContent = gameState.countdown;
            gameState.countdown--;
        } else {
            countdownElement.textContent = 'GO!';
            setTimeout(() => {
                countdownElement.style.display = 'none';
                startRace();
            }, 500);
            clearInterval(countInterval);
        }
    }, 1000);
}

// Start race
function startRace() {
    gameState.isPlaying = true;
    gameState.isCountingDown = false;
    gameState.freeRoam = false;
    gameState.raceTime = 0;
    gameState.hasWon = false;
    gameState.hasLost = false;
    timerElement.style.display = 'block';
    messageElement.style.display = 'none';

    // Show mobile controls when race starts
    if (mobileControls.container) {
        mobileControls.container.style.display = 'block';
    }

    // Don't reset car here, it's already in correct position
    // resetCar();
}

// Reset car
function resetCar() {
    if (!car) return;

    car.visible = true; // Make car visible again
    car.position.set(0, gameState.carGroundLevel, 0); // Use correct height
    car.rotation.set(0, -Math.PI / 2, 0); // Facing forward (car front to track)
    vehicleState.rotation = Math.PI; // Forward rotation state
    vehicleState.velocity = 0;
    vehicleState.steerAngle = 0;
    vehicleState.driftAngle = 0;
    vehicleState.driftVelocity = 0;
    vehicleState.isDrifting = false;
    vehicleState.driftFactor = 0;

    // Clear remaining explosion particles
    for (let particle of explosionParticles) {
        scene.remove(particle);
    }
    explosionParticles = [];

    // Reset camera to correct position
    updateCarCamera(0);
}

// Check collisions
function checkCollisions() {
    if (!car || !carBoundingBox || !gameState.isPlaying) return;

    // Update car bounding box
    carBoundingBox.setFromObject(car);

    // Reduce car bounding box size for fairer collision
    const carCenter = new THREE.Vector3();
    const carSize = new THREE.Vector3();
    carBoundingBox.getCenter(carCenter);
    carBoundingBox.getSize(carSize);

    // Reduce car collision box size by 25%
    carSize.multiplyScalar(0.75);
    carBoundingBox.setFromCenterAndSize(carCenter, carSize);

    // Check collision with obstacles
    for (let obstacle of obstacles) {
        // Create specific collision box for trunk
        // Trunk has radius 0.5 and height 2 in original model
        const obstacleCenter = new THREE.Vector3();
        obstacle.getWorldPosition(obstacleCenter);

        // Adjust to trunk center (half trunk height = 1)
        obstacleCenter.y = 1;

        // Create collision box with trunk size
        // Considering scale and actual trunk size
        const trunkSize = new THREE.Vector3(
            1.2, // Trunk width (reduced for visual match)
            4.0, // Trunk height
            1.2  // Trunk depth (reduced for visual match)
        );

        const obstacleBB = new THREE.Box3();
        obstacleBB.setFromCenterAndSize(obstacleCenter, trunkSize);

        if (carBoundingBox.intersectsBox(obstacleBB)) {
            createExplosion(car.position.clone());
            // Hide car during explosion
            car.visible = false;
            gameOver(false);
            return;
        }
    }

    // Check if reached finish line
    if (car.position.z < gameState.finishLineZ) {
        gameOver(true);
        return;
    }

    // Check if out of track
    const carZ = car.position.z;
    const carX = car.position.x;

    // Find current track segment
    let onTrack = false;
    for (let segment of gameState.trackSegments) {
        if (carZ <= segment.start && carZ >= segment.end) {
            const leftLimit = segment.xOffset - segment.width / 2;
            const rightLimit = segment.xOffset + segment.width / 2;

            if (carX >= leftLimit && carX <= rightLimit) {
                onTrack = true;
                break;
            }
        }
    }

    // If not on track, game over
    if (!onTrack && carZ < 0) { // Only check after starting to move
        gameOver(false, "OUT OF BOUNDS!");
    }
}

// Create explosion
function createExplosion(position) {
    const particleCount = 30; // Reduce particles for better performance
    const colors = [0xff0000, 0xff5500, 0xffaa00, 0xffff00, 0xff8800];

    for (let i = 0; i < particleCount; i++) {
        // Particle geometry and material
        const size = Math.random() * 0.5 + 0.2;
        const geometry = new THREE.BoxGeometry(size, size, size); // Box is faster than Sphere
        const material = new THREE.MeshBasicMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            emissive: colors[Math.floor(Math.random() * colors.length)],
            emissiveIntensity: 1
        });

        const particle = new THREE.Mesh(geometry, material);

        // Initial position
        particle.position.copy(position);
        particle.position.x += (Math.random() - 0.5) * 2;
        particle.position.y += Math.random() * 2;
        particle.position.z += (Math.random() - 0.5) * 2;

        // Random velocity
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 15,
            Math.random() * 15 + 5,
            (Math.random() - 0.5) * 15
        );

        particle.life = 1.0;
        particle.decay = Math.random() * 0.02 + 0.01;

        scene.add(particle);
        explosionParticles.push(particle);
    }

    // Add light flash
    const flash = new THREE.PointLight(0xffaa00, 10, 50);
    flash.position.copy(position);
    flash.position.y += 2;
    scene.add(flash);

    // Remove flash after short period
    setTimeout(() => {
        scene.remove(flash);
    }, 100);

    // Explosion sound (visual feedback with camera shake)
    if (camera) {
        const originalPosition = camera.position.clone();
        let shakeTime = 0;
        const shakeIntensity = 1.5;

        const shakeCamera = setInterval(() => {
            shakeTime += 0.05;
            camera.position.x = originalPosition.x + (Math.random() - 0.5) * shakeIntensity * (1 - shakeTime);
            camera.position.y = originalPosition.y + (Math.random() - 0.5) * shakeIntensity * (1 - shakeTime);

            if (shakeTime >= 1) {
                clearInterval(shakeCamera);
                camera.position.copy(originalPosition);
            }
        }, 16);
    }
}

// Update explosion particles
function updateExplosionParticles(delta) {
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const particle = explosionParticles[i];

        // Apply physics
        particle.position.add(particle.velocity.clone().multiplyScalar(delta));
        particle.velocity.y -= 20 * delta; // Gravity
        particle.velocity.multiplyScalar(0.98); // Deceleration

        // Decrease life and scale
        particle.life -= particle.decay;
        particle.scale.setScalar(particle.life);

        // Fade out
        if (particle.material.opacity !== undefined) {
            particle.material.transparent = true;
            particle.material.opacity = particle.life;
        }

        // Remove dead particle
        if (particle.life <= 0) {
            scene.remove(particle);
            explosionParticles.splice(i, 1);
        }
    }
}

// Enable free roam mode
function enableFreeRoam() {
    gameState.freeRoam = true;
    gameState.isPlaying = false;
    messageElement.style.display = 'none';
    timerElement.style.display = 'none';

    // Show mobile controls in free roam
    if (mobileControls.container) {
        mobileControls.container.style.display = 'block';
    }

    // Show free roam message
    const freeRoamMessage = document.createElement('div');
    freeRoamMessage.id = 'free-roam-message';
    freeRoamMessage.style.cssText = `
        position: fixed;
        top: 160px;
        right: 20px;
        font-size: 20px;
        font-weight: bold;
        color: white;
        background: rgba(33, 150, 243, 0.8);
        padding: 10px 20px;
        border-radius: 10px;
        display: block;
        z-index: 100;
    `;
    freeRoamMessage.innerHTML = `
        <div>🚗 FREE ROAM MODE</div>
        <div style="font-size: 14px; margin-top: 5px;">Press R to race again</div>
    `;
    document.body.appendChild(freeRoamMessage);

    // Reactivate vehicle controls
    vehicleState.velocity = 0;
    vehicleState.accelerating = false;
    vehicleState.braking = false;
}

// Game over
function gameOver(won, reason = null) {
    gameState.isPlaying = false;
    gameState.hasWon = won;
    gameState.hasLost = !won;

    if (won) {
        const time = gameState.raceTime.toFixed(2);
        messageElement.innerHTML = `
            <div style="color: #00ff00;">YOU WON!</div>
            <div style="font-size: 24px; margin-top: 10px;">Time: ${time}s</div>
            <div style="display: flex; justify-content: center; gap: 20px; margin-top: 20px;">
                <button id="restart-btn" style="
                    padding: 10px 20px;
                    font-size: 18px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: background-color 0.3s;
                ">🔄 Restart Race</button>
                <button id="explore-btn" style="
                    padding: 10px 20px;
                    font-size: 18px;
                    background-color: #2196F3;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: background-color 0.3s;
                ">🚗 Free Roam</button>
            </div>
            <div style="font-size: 14px; margin-top: 10px; color: #ccc;">Or press R to restart</div>
        `;

        // Check and save best time
        const previousBest = localStorage.getItem('bestTime');
        if (!previousBest || gameState.raceTime < parseFloat(previousBest)) {
            gameState.bestTime = time;
            localStorage.setItem('bestTime', time);

            // Show new record notification
            messageElement.innerHTML += `
                <div style="font-size: 28px; color: gold; margin-top: 15px; animation: pulse 1s infinite;">
                    🏆 NEW RECORD! 🏆
                </div>
                <div style="font-size: 20px; color: gold; margin-top: 5px;">
                    Previous: ${previousBest || 'N/A'}s
                </div>
            `;

            // Update record display
            recordElement.innerHTML = `
                <div style="color: white; font-size: 14px; margin-bottom: 5px;">🏆 BEST TIME</div>
                <div style="font-size: 24px; animation: pulse 1s infinite;">${time}s</div>
            `;

            // Add pulse animation
            if (!document.getElementById('pulse-animation')) {
                const style = document.createElement('style');
                style.id = 'pulse-animation';
                style.textContent = `
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                        100% { transform: scale(1); }
                    }
                `;
                document.head.appendChild(style);
            }
        }

        // Add event listeners for buttons
        setTimeout(() => {
            const restartBtn = document.getElementById('restart-btn');
            const exploreBtn = document.getElementById('explore-btn');

            if (restartBtn) {
                restartBtn.onclick = () => {
                    messageElement.style.display = 'none';
                    startCountdown();
                };
            }

            if (exploreBtn) {
                exploreBtn.onclick = () => {
                    enableFreeRoam();
                };
            }
        }, 100);
    } else {
        const message = reason || "YOU CRASHED!";
        messageElement.innerHTML = `
            <div style="color: #ff0000;">${message}</div>
            <div style="font-size: 18px; margin-top: 10px;">Press R to try again</div>
        `;
    }

    messageElement.style.display = 'block';
    timerElement.style.display = 'none';

    // Stop the car
    vehicleState.velocity = 0;
    vehicleState.accelerating = false;
    vehicleState.braking = false;
}

// Update car camera
function updateCarCamera(delta) {
    if (!car) return;

    const idealOffset = new THREE.Vector3(
        -Math.sin(vehicleState.rotation) * vehicleState.cameraDistance,
        vehicleState.cameraHeight,
        -Math.cos(vehicleState.rotation) * vehicleState.cameraDistance
    );

    const speedOffset = vehicleState.velocity * 0.1;
    idealOffset.multiplyScalar(1 + Math.abs(speedOffset) * 0.05);

    const idealPosition = car.position.clone().add(idealOffset);

    const lookAheadDistance = vehicleState.cameraLookAhead + Math.abs(vehicleState.velocity) * 0.2;
    const idealLookAt = new THREE.Vector3(
        car.position.x + Math.sin(vehicleState.rotation) * lookAheadDistance,
        car.position.y + 1,
        car.position.z + Math.cos(vehicleState.rotation) * lookAheadDistance
    );

    if (delta > 0) {
        camera.position.lerp(idealPosition, vehicleState.cameraSmooth * delta);

        const currentLookAt = new THREE.Vector3();
        camera.getWorldDirection(currentLookAt);
        currentLookAt.multiplyScalar(10).add(camera.position);
        currentLookAt.lerp(idealLookAt, vehicleState.cameraSmooth * delta);
        camera.lookAt(currentLookAt);
    } else {
        camera.position.copy(idealPosition);
        camera.lookAt(idealLookAt);
    }
}

// Update vehicle physics
function updateVehiclePhysics(delta) {
    if (!car || (!gameState.isPlaying && !gameState.freeRoam)) return;

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
        // Natural deceleration
        if (vehicleState.velocity > 0) {
            vehicleState.velocity -= vehicleState.friction * delta;
            if (vehicleState.velocity < 0) vehicleState.velocity = 0;
        } else if (vehicleState.velocity < 0) {
            vehicleState.velocity += vehicleState.friction * delta;
            if (vehicleState.velocity > 0) vehicleState.velocity = 0;
        }
    }

    // Drift system
    if (vehicleState.handbrake && Math.abs(vehicleState.velocity) > 3) {
        vehicleState.isDrifting = true;
        vehicleState.driftFactor = Math.min(vehicleState.driftFactor + delta * 3, 1);
        vehicleState.velocity *= vehicleState.driftFriction;

        if (vehicleState.steeringLeft || vehicleState.steeringRight) {
            const driftDirection = vehicleState.steeringLeft ? 1 : -1;
            vehicleState.driftAngle += driftDirection * vehicleState.velocity * 0.05 * delta;
            vehicleState.driftVelocity = vehicleState.velocity * 0.3;
        }

        const lateralDrift = Math.sin(vehicleState.driftAngle) * vehicleState.driftVelocity * delta;
        car.position.x += Math.cos(vehicleState.rotation) * lateralDrift * vehicleState.driftFactor;
        car.position.z -= Math.sin(vehicleState.rotation) * lateralDrift * vehicleState.driftFactor;

    } else {
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
        -vehicleState.maxSpeed * 0.3,
        vehicleState.maxSpeed
    );

    // Apply steering
    if (Math.abs(vehicleState.velocity) > 0.1) {
        let steerMultiplier = 1;
        if (vehicleState.isDrifting) {
            steerMultiplier = vehicleState.driftMultiplier;
        }
        const steerInfluence = vehicleState.steerAngle * Math.min(Math.abs(vehicleState.velocity) / 5, 1) * steerMultiplier;
        vehicleState.rotation += steerInfluence * vehicleState.velocity * delta;
    }

    // Apply rotation to car (adjusted for correct orientation)
    car.rotation.y = vehicleState.rotation - Math.PI / 2;

    // Move car
    const moveDistance = vehicleState.velocity * delta;
    car.position.x += Math.sin(vehicleState.rotation) * moveDistance;
    car.position.z += Math.cos(vehicleState.rotation) * moveDistance;

    // Keep car at correct height
    car.position.y = gameState.carGroundLevel;

    // No longer limit lateral movement - let player leave track
    // car.position.x = THREE.MathUtils.clamp(car.position.x, -13, 13);

    // Tilt car in curves
    let tiltMultiplier = vehicleState.isDrifting ? 0.06 : 0.02;
    car.rotation.z = -vehicleState.steerAngle * vehicleState.velocity * tiltMultiplier;

    if (vehicleState.isDrifting) {
        const driftOscillation = Math.sin(Date.now() * 0.01) * 0.02 * vehicleState.driftFactor;
        car.rotation.y += driftOscillation;
        car.rotation.x = -vehicleState.driftFactor * 0.05;
    } else {
        car.rotation.x = 0;
    }

    // Check collisions only if not in free mode
    if (!gameState.freeRoam) {
        checkCollisions();
    }

    // Update camera
    updateCarCamera(delta);
}

// Event handlers
function onKeyDown(event) {
    keys[event.key] = true;

    // Restart game
    if (event.key.toLowerCase() === 'r' && !gameState.isPlaying && !gameState.isCountingDown) {
        // Remove free roam message if exists
        const freeRoamMsg = document.getElementById('free-roam-message');
        if (freeRoamMsg) {
            freeRoamMsg.remove();
        }
        gameState.freeRoam = false;
        messageElement.style.display = 'none';
        startCountdown();
        return;
    }

    // Car controls during game or free mode
    if (!gameState.isPlaying && !gameState.freeRoam) return;

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

    // Update race time
    if (gameState.isPlaying) {
        gameState.raceTime += delta;
        timerElement.textContent = `Time: ${gameState.raceTime.toFixed(2)}s`;
    }

    // Update vehicle physics
    updateVehiclePhysics(delta);

    // Update explosion particles
    updateExplosionParticles(delta);

    // Render scene
    renderer.render(scene, camera);
}

// Start application
init();