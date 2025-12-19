// Global variables
let scene, camera, renderer, controls;
let rubikCube, solver;
let isAnimating = false;

// Initialize the application
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a2a);
    scene.fog = new THREE.Fog(0x2a2a2a, 10, 50);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    const container = document.getElementById('canvas-container');
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.physicallyCorrectLights = true;
    container.appendChild(renderer.domElement);
    
    // Add lights
    setupLights();
    
    // Create Rubik's cube
    rubikCube = new RubikCube(scene);
    
    // Create solver
    solver = new CubeSolver();
    
    // Setup controls
    setupControls();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start render loop
    animate();
}

function setupLights() {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);
    
    // Main directional light (key light)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(8, 12, 6);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);
    
    // Fill light (softer, from opposite side)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
    
    // Rim light for edge definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(-8, -8, 8);
    scene.add(rimLight);
    
    // Point lights for additional highlights
    const pointLight1 = new THREE.PointLight(0xffffff, 0.6, 20);
    pointLight1.position.set(5, 8, 5);
    pointLight1.castShadow = true;
    scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0xffffff, 0.4, 15);
    pointLight2.position.set(-8, -5, -8);
    scene.add(pointLight2);
    
    // Environment map for reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new THREE.Scene()).texture;
    scene.environment = envTexture;
}

function setupControls() {
    // Mouse controls for camera
    let mouseDown = false;
    let mouseButton = 0;
    let mouseX = 0;
    let mouseY = 0;
    
    const canvas = renderer.domElement;
    
    canvas.addEventListener('mousedown', (event) => {
        mouseDown = true;
        mouseButton = event.button;
        mouseX = event.clientX;
        mouseY = event.clientY;
    });
    
    canvas.addEventListener('mouseup', () => {
        mouseDown = false;
    });
    
    canvas.addEventListener('mousemove', (event) => {
        if (!mouseDown) return;
        
        const deltaX = event.clientX - mouseX;
        const deltaY = event.clientY - mouseY;
        
        if (mouseButton === 0) { // Left mouse button - rotate
            const rotationSpeed = 0.005;
            
            // Rotate around Y axis (horizontal mouse movement)
            rubikCube.group.rotateY(deltaX * rotationSpeed);
            
            // Rotate around X axis (vertical mouse movement)
            rubikCube.group.rotateX(-deltaY * rotationSpeed);
        } else if (mouseButton === 2) { // Right mouse button - pan
            const panSpeed = 0.01;
            camera.position.x -= deltaX * panSpeed;
            camera.position.y += deltaY * panSpeed;
        }
        
        mouseX = event.clientX;
        mouseY = event.clientY;
    });
    
    // Prevent context menu on right click
    canvas.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });
    
    // Zoom with mouse wheel
    canvas.addEventListener('wheel', (event) => {
        const zoomSpeed = 0.1;
        const direction = event.deltaY > 0 ? 1 : -1;
        
        camera.position.multiplyScalar(1 + direction * zoomSpeed);
        event.preventDefault();
    });
}

function setupEventListeners() {
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Handle keyboard input
    document.addEventListener('keydown', onKeyDown);
    
    // Handle input field enter key
    const moveInput = document.getElementById('move-input');
    moveInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            executeMove();
        }
    });
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function onKeyDown(event) {
    // Quick move shortcuts
    const key = event.key.toLowerCase();
    const moves = {
        'r': 'R',
        'l': 'L',
        'u': 'U',
        'd': 'D',
        'f': 'F',
        'b': 'B'
    };
    
    if (moves[key]) {
        let move = moves[key];
        if (event.shiftKey) move += "'";
        if (event.ctrlKey) move += "2";
        
        rubikCube.executeMove(move);
    }
}

// Global variable for tracking animation state
let lastAnimationState = null;

function animate() {
    requestAnimationFrame(animate);
    
    // Update UI state based on animation status
    if (rubikCube && rubikCube.isAnimating !== lastAnimationState) {
        updateUIState();
        lastAnimationState = rubikCube.isAnimating;
    }
    
    renderer.render(scene, camera);
}

// UI Functions
function executeMove() {
    const input = document.getElementById('move-input');
    const move = input.value.trim();
    
    if (move) {
        rubikCube.executeMove(move);
        input.value = '';
        updateUIState();
    }
}

function scrambleCube() {
    if (rubikCube.isAnimating) {
        showMessage('Please wait for current animation to finish');
        return;
    }
    
    const scrambleSequence = rubikCube.scramble();
    console.log('Scrambled with:', scrambleSequence);
    updateUIState();
}

function resetCube() {
    if (rubikCube.isAnimating) {
        showMessage('Please wait for current animation to finish');
        return;
    }
    
    rubikCube.reset();
    document.getElementById('solution-display').innerHTML = 'Click "Solve" to get the shortest solution';
    updateUIState();
}

function solveCube() {
    if (rubikCube.isAnimating) {
        showMessage('Please wait for current animation to finish');
        return;
    }
    
    const solution = solver.solve(rubikCube);
    const solutionDisplay = document.getElementById('solution-display');
    
    if (solution === "Cube is already solved!" || solution === "Already solved!") {
        solutionDisplay.innerHTML = '<strong>Cube is already solved!</strong>';
    } else {
        const moveCount = solution.split(' ').filter(move => move.length > 0).length;
        solutionDisplay.innerHTML = `
            <strong>Solution (${moveCount} moves):</strong><br>
            <span style="font-family: monospace; background: white; padding: 5px; border-radius: 3px; display: inline-block; margin-top: 5px;">${solution}</span><br>
        `;
        
        // Create button element properly to avoid onclick issues
        const applyButton = document.createElement('button');
        applyButton.className = 'button';
        applyButton.textContent = 'Apply Solution';
        applyButton.style.marginTop = '10px';
        applyButton.addEventListener('click', () => applySolution(solution));
        solutionDisplay.appendChild(applyButton);
    }
}

function applySolution(solution) {
    if (rubikCube.isAnimating) {
        showMessage('Please wait for current animation to finish');
        return;
    }
    
    rubikCube.executeMove(solution);
    updateUIState();
}

function updateUIState() {
    const buttons = document.querySelectorAll('.button');
    const input = document.getElementById('move-input');
    
    if (rubikCube.isAnimating) {
        buttons.forEach(btn => btn.disabled = true);
        input.disabled = true;
    } else {
        buttons.forEach(btn => btn.disabled = false);
        input.disabled = false;
    }
}

function showMessage(message) {
    // Create a temporary message element
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff6b6b;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 1000;
        font-size: 14px;
    `;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        document.body.removeChild(messageEl);
    }, 2000);
}

// Initialize the application when the page loads
window.addEventListener('load', init);