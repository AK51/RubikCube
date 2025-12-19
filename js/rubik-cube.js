class RubikCube {
    constructor(scene) {
        this.scene = scene;
        this.cubes = [];
        this.group = new THREE.Group();
        this.scene.add(this.group);
        
        // Cube state representation (6 faces, 9 stickers each)
        this.state = this.getInitialState();
        this.moveHistory = [];
        this.isAnimating = false;
        this.animationQueue = [];
        
        this.createCube();
        this.setupColors();
    }
    
    getInitialState() {
        return {
            U: Array(9).fill('yellow'),  // Up (yellow)
            D: Array(9).fill('white'),   // Down (white)
            F: Array(9).fill('blue'),    // Front (blue)
            B: Array(9).fill('green'),   // Back (green)
            R: Array(9).fill('red'),     // Right (red)
            L: Array(9).fill('orange')   // Left (orange)
        };
    }
    
    createCube() {
        const cubeSize = 0.95;
        const gap = 0.05;
        
        for (let x = 0; x < 3; x++) {
            for (let y = 0; y < 3; y++) {
                for (let z = 0; z < 3; z++) {
                    // Create rounded cube geometry with smoother edges
                    const geometry = this.createRoundedBoxGeometry(cubeSize, cubeSize, cubeSize, 0.08, 16);
                    
                    // Create materials for each face with better appearance
                    const materials = [
                        new THREE.MeshPhysicalMaterial({ 
                            color: 0x1a1a1a,
                            metalness: 0.1,
                            roughness: 0.3,
                            clearcoat: 0.8,
                            clearcoatRoughness: 0.2
                        }), // Right
                        new THREE.MeshPhysicalMaterial({ 
                            color: 0x1a1a1a,
                            metalness: 0.1,
                            roughness: 0.3,
                            clearcoat: 0.8,
                            clearcoatRoughness: 0.2
                        }), // Left
                        new THREE.MeshPhysicalMaterial({ 
                            color: 0x1a1a1a,
                            metalness: 0.1,
                            roughness: 0.3,
                            clearcoat: 0.8,
                            clearcoatRoughness: 0.2
                        }), // Top
                        new THREE.MeshPhysicalMaterial({ 
                            color: 0x1a1a1a,
                            metalness: 0.1,
                            roughness: 0.3,
                            clearcoat: 0.8,
                            clearcoatRoughness: 0.2
                        }), // Bottom
                        new THREE.MeshPhysicalMaterial({ 
                            color: 0x1a1a1a,
                            metalness: 0.1,
                            roughness: 0.3,
                            clearcoat: 0.8,
                            clearcoatRoughness: 0.2
                        }), // Front
                        new THREE.MeshPhysicalMaterial({ 
                            color: 0x1a1a1a,
                            metalness: 0.1,
                            roughness: 0.3,
                            clearcoat: 0.8,
                            clearcoatRoughness: 0.2
                        })  // Back
                    ];
                    
                    const cube = new THREE.Mesh(geometry, materials);
                    cube.castShadow = true;
                    cube.receiveShadow = true;
                    
                    cube.position.set(
                        (x - 1) * (cubeSize + gap),
                        (y - 1) * (cubeSize + gap),
                        (z - 1) * (cubeSize + gap)
                    );
                    
                    cube.userData = { 
                        x, y, z,
                        originalPosition: cube.position.clone(),
                        targetRotation: new THREE.Euler(0, 0, 0)
                    };
                    this.cubes.push(cube);
                    this.group.add(cube);
                }
            }
        }
    }
    
    createRoundedBoxGeometry(width, height, depth, radius, segments) {
        // Use higher segment count for smoother curves
        const smoothSegments = Math.max(segments, 12);
        const geometry = new THREE.BoxGeometry(width, height, depth, smoothSegments, smoothSegments, smoothSegments);
        
        // Get the position attribute
        const position = geometry.attributes.position;
        const vertex = new THREE.Vector3();
        
        // Apply smooth rounding to vertices
        for (let i = 0; i < position.count; i++) {
            vertex.fromBufferAttribute(position, i);
            
            // Calculate distances from face centers
            const x = Math.abs(vertex.x) - (width / 2 - radius);
            const y = Math.abs(vertex.y) - (height / 2 - radius);
            const z = Math.abs(vertex.z) - (depth / 2 - radius);
            
            // Apply rounding with smooth falloff
            if (x > 0 || y > 0 || z > 0) {
                const dx = Math.max(x, 0);
                const dy = Math.max(y, 0);
                const dz = Math.max(z, 0);
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance > 0 && distance > radius * 0.1) {
                    // Smooth rounding function
                    const normalizedDistance = Math.min(distance / radius, 1);
                    const roundingFactor = 1 - Math.pow(1 - normalizedDistance, 2);
                    const adjustment = radius * roundingFactor;
                    
                    // Apply rounding in all directions
                    if (dx > 0) {
                        const sign = vertex.x > 0 ? 1 : -1;
                        vertex.x = sign * (width / 2 - radius + adjustment * (dx / distance));
                    }
                    if (dy > 0) {
                        const sign = vertex.y > 0 ? 1 : -1;
                        vertex.y = sign * (height / 2 - radius + adjustment * (dy / distance));
                    }
                    if (dz > 0) {
                        const sign = vertex.z > 0 ? 1 : -1;
                        vertex.z = sign * (depth / 2 - radius + adjustment * (dz / distance));
                    }
                }
            }
            
            position.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        
        geometry.attributes.position.needsUpdate = true;
        
        // Compute smooth normals for better lighting
        geometry.computeVertexNormals();
        
        // Add additional smoothing
        this.smoothGeometry(geometry, 2);
        
        return geometry;
    }
    
    smoothGeometry(geometry, iterations) {
        const position = geometry.attributes.position;
        const vertex = new THREE.Vector3();
        const neighbors = [];
        
        for (let iter = 0; iter < iterations; iter++) {
            const newPositions = new Float32Array(position.array.length);
            
            for (let i = 0; i < position.count; i++) {
                vertex.fromBufferAttribute(position, i);
                
                // Find neighboring vertices (simplified approach)
                neighbors.length = 0;
                neighbors.push(vertex.clone());
                
                // Average with nearby vertices for smoothing
                for (let j = 0; j < position.count; j++) {
                    if (i !== j) {
                        const neighbor = new THREE.Vector3();
                        neighbor.fromBufferAttribute(position, j);
                        
                        if (vertex.distanceTo(neighbor) < 0.1) {
                            neighbors.push(neighbor);
                        }
                    }
                }
                
                // Calculate average position
                const avgPosition = new THREE.Vector3();
                neighbors.forEach(n => avgPosition.add(n));
                avgPosition.divideScalar(neighbors.length);
                
                // Blend original and averaged position
                const blendFactor = 0.3;
                vertex.lerp(avgPosition, blendFactor);
                
                newPositions[i * 3] = vertex.x;
                newPositions[i * 3 + 1] = vertex.y;
                newPositions[i * 3 + 2] = vertex.z;
            }
            
            position.array.set(newPositions);
            position.needsUpdate = true;
        }
        
        geometry.computeVertexNormals();
    }
    
    setupColors() {
        const colors = {
            white: 0xf8f8f8,
            yellow: 0xffd700,
            green: 0x00c851,
            blue: 0x2196f3,
            red: 0xf44336,
            orange: 0xff9800,
            black: 0x1a1a1a
        };
        
        this.cubes.forEach(cube => {
            const { x, y, z } = cube.userData;
            
            // Create sticker-like appearance with realistic materials
            const stickerMaterial = (color) => new THREE.MeshPhysicalMaterial({
                color: color,
                metalness: 0.0,
                roughness: 0.1,
                clearcoat: 0.9,
                clearcoatRoughness: 0.1,
                reflectivity: 0.8
            });
            
            const borderMaterial = new THREE.MeshPhysicalMaterial({
                color: colors.black,
                metalness: 0.1,
                roughness: 0.3,
                clearcoat: 0.8,
                clearcoatRoughness: 0.2
            });
            
            // Add stickers to visible faces only
            this.addStickers(cube, x, y, z, colors, stickerMaterial, borderMaterial);
        });
    }
    
    addStickers(cube, x, y, z, colors, stickerMaterial, borderMaterial) {
        // Right face (x = 2) - RED
        if (x === 2) {
            cube.material[0] = stickerMaterial(colors.red);
            this.addStickerGeometry(cube, 0, colors.red);
        } else {
            cube.material[0] = borderMaterial;
        }
        
        // Left face (x = 0) - ORANGE
        if (x === 0) {
            cube.material[1] = stickerMaterial(colors.orange);
            this.addStickerGeometry(cube, 1, colors.orange);
        } else {
            cube.material[1] = borderMaterial;
        }
        
        // Top face (y = 2) - YELLOW
        if (y === 2) {
            cube.material[2] = stickerMaterial(colors.yellow);
            this.addStickerGeometry(cube, 2, colors.yellow);
        } else {
            cube.material[2] = borderMaterial;
        }
        
        // Bottom face (y = 0) - WHITE
        if (y === 0) {
            cube.material[3] = stickerMaterial(colors.white);
            this.addStickerGeometry(cube, 3, colors.white);
        } else {
            cube.material[3] = borderMaterial;
        }
        
        // Front face (z = 2) - BLUE
        if (z === 2) {
            cube.material[4] = stickerMaterial(colors.blue);
            this.addStickerGeometry(cube, 4, colors.blue);
        } else {
            cube.material[4] = borderMaterial;
        }
        
        // Back face (z = 0) - GREEN
        if (z === 0) {
            cube.material[5] = stickerMaterial(colors.green);
            this.addStickerGeometry(cube, 5, colors.green);
        } else {
            cube.material[5] = borderMaterial;
        }
    }
    
    addStickerGeometry(cube, faceIndex, color) {
        // Create a slightly raised sticker with rounded corners
        const stickerSize = 0.8;
        const stickerHeight = 0.02;
        const cornerRadius = 0.05;
        
        // Create rounded rectangle geometry for sticker
        const stickerGeometry = this.createRoundedRectGeometry(stickerSize, stickerSize, cornerRadius);
        const stickerMaterial = new THREE.MeshPhysicalMaterial({
            color: color,
            metalness: 0.0,
            roughness: 0.03,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
            reflectivity: 0.95,
            transparent: false
        });
        
        const sticker = new THREE.Mesh(stickerGeometry, stickerMaterial);
        sticker.castShadow = true;
        sticker.receiveShadow = false;
        
        // Position sticker on the appropriate face
        const offset = 0.475 + stickerHeight;
        switch (faceIndex) {
            case 0: // Right
                sticker.position.set(offset, 0, 0);
                sticker.rotation.y = Math.PI / 2;
                break;
            case 1: // Left
                sticker.position.set(-offset, 0, 0);
                sticker.rotation.y = -Math.PI / 2;
                break;
            case 2: // Top
                sticker.position.set(0, offset, 0);
                sticker.rotation.x = -Math.PI / 2;
                break;
            case 3: // Bottom
                sticker.position.set(0, -offset, 0);
                sticker.rotation.x = Math.PI / 2;
                break;
            case 4: // Front
                sticker.position.set(0, 0, offset);
                break;
            case 5: // Back
                sticker.position.set(0, 0, -offset);
                sticker.rotation.y = Math.PI;
                break;
        }
        
        cube.add(sticker);
    }
    
    createRoundedRectGeometry(width, height, radius) {
        const shape = new THREE.Shape();
        
        const x = -width / 2;
        const y = -height / 2;
        const w = width;
        const h = height;
        const r = Math.min(radius, Math.min(w, h) / 2);
        
        shape.moveTo(x + r, y);
        shape.lineTo(x + w - r, y);
        shape.quadraticCurveTo(x + w, y, x + w, y + r);
        shape.lineTo(x + w, y + h - r);
        shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        shape.lineTo(x + r, y + h);
        shape.quadraticCurveTo(x, y + h, x, y + h - r);
        shape.lineTo(x, y + r);
        shape.quadraticCurveTo(x, y, x + r, y);
        
        const geometry = new THREE.ShapeGeometry(shape);
        
        // Add slight extrusion for 3D effect
        const extrudeSettings = {
            depth: 0.01,
            bevelEnabled: true,
            bevelSegments: 4,
            bevelSize: 0.005,
            bevelThickness: 0.005
        };
        
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }
    
    executeMove(move) {
        if (this.isAnimating) {
            // Add to queue if currently animating
            this.animationQueue.push(move);
            return;
        }
        
        const moves = this.parseMoves(move);
        this.executeMoveSequence(moves);
    }
    
    executeMoveSequence(moves) {
        if (moves.length === 0) {
            this.processQueue();
            return;
        }
        
        const move = moves.shift();
        this.performMoveAnimated(move, () => {
            this.moveHistory.push(move);
            this.updateMoveDisplay();
            this.executeMoveSequence(moves);
        });
    }
    
    processQueue() {
        if (this.animationQueue.length > 0) {
            const nextMove = this.animationQueue.shift();
            this.executeMove(nextMove);
        }
    }
    
    parseMoves(moveString) {
        const moves = [];
        const tokens = moveString.trim().split(/\s+/);
        
        tokens.forEach(token => {
            if (token.match(/^[RLUDFB]['2]?$/)) {
                moves.push(token);
            }
        });
        
        return moves;
    }
    
    performMove(move) {
        const face = move[0];
        const modifier = move.slice(1);
        
        let rotations = 1;
        if (modifier === '2') rotations = 2;
        else if (modifier === "'") rotations = 3;
        
        for (let i = 0; i < rotations; i++) {
            this.rotateFace(face);
        }
    }
    
    performMoveAnimated(move, callback) {
        this.isAnimating = true;
        const face = move[0];
        const modifier = move.slice(1);
        
        let rotations = 1;
        if (modifier === '2') rotations = 2;
        else if (modifier === "'") rotations = 3;
        
        this.animateRotation(face, rotations, callback);
    }
    
    rotateFace(face) {
        const axis = new THREE.Vector3();
        const angle = Math.PI / 2;
        
        switch (face) {
            case 'R':
                axis.set(1, 0, 0);
                this.rotateLayer(cube => cube.userData.x === 2, axis, angle);
                break;
            case 'L':
                axis.set(-1, 0, 0);
                this.rotateLayer(cube => cube.userData.x === 0, axis, angle);
                break;
            case 'U':
                axis.set(0, 1, 0);
                this.rotateLayer(cube => cube.userData.y === 2, axis, angle);
                break;
            case 'D':
                axis.set(0, -1, 0);
                this.rotateLayer(cube => cube.userData.y === 0, axis, angle);
                break;
            case 'F':
                axis.set(0, 0, 1);
                this.rotateLayer(cube => cube.userData.z === 2, axis, angle);
                break;
            case 'B':
                axis.set(0, 0, -1);
                this.rotateLayer(cube => cube.userData.z === 0, axis, angle);
                break;
        }
    }
    
    rotateLayer(condition, axis, angle) {
        const layerCubes = this.cubes.filter(condition);
        
        layerCubes.forEach(cube => {
            // Rotate position
            cube.position.applyAxisAngle(axis, angle);
            
            // Update userData coordinates
            const newPos = cube.position.clone();
            cube.userData.x = Math.round(newPos.x) + 1;
            cube.userData.y = Math.round(newPos.y) + 1;
            cube.userData.z = Math.round(newPos.z) + 1;
            
            // Rotate the cube itself
            cube.rotateOnAxis(axis, angle);
        });
    }
    
    animateRotation(face, rotations, callback) {
        const axis = new THREE.Vector3();
        const totalAngle = (Math.PI / 2) * rotations;
        
        // Determine axis and layer condition
        let condition;
        switch (face) {
            case 'R':
                axis.set(1, 0, 0);
                condition = cube => cube.userData.x === 2;
                break;
            case 'L':
                axis.set(-1, 0, 0);
                condition = cube => cube.userData.x === 0;
                break;
            case 'U':
                axis.set(0, 1, 0);
                condition = cube => cube.userData.y === 2;
                break;
            case 'D':
                axis.set(0, -1, 0);
                condition = cube => cube.userData.y === 0;
                break;
            case 'F':
                axis.set(0, 0, 1);
                condition = cube => cube.userData.z === 2;
                break;
            case 'B':
                axis.set(0, 0, -1);
                condition = cube => cube.userData.z === 0;
                break;
        }
        
        const layerCubes = this.cubes.filter(condition);
        
        // Create a temporary group for rotation within the main group
        const rotationGroup = new THREE.Group();
        this.group.add(rotationGroup);
        
        // Store original positions and rotations relative to main group
        const originalTransforms = [];
        layerCubes.forEach(cube => {
            originalTransforms.push({
                position: cube.position.clone(),
                quaternion: cube.quaternion.clone()
            });
            
            // Move cube to rotation group while preserving local transform
            this.group.remove(cube);
            rotationGroup.add(cube);
        });
        
        // Animate the rotation
        const duration = 300; // milliseconds
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeProgress = this.easeInOutCubic(progress);
            
            // Calculate current rotation
            const currentAngle = totalAngle * easeProgress;
            
            // Reset rotation and apply new rotation
            rotationGroup.rotation.set(0, 0, 0);
            rotationGroup.rotateOnAxis(axis, currentAngle);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete - finalize positions
                this.finalizeRotation(rotationGroup, layerCubes, originalTransforms);
                this.group.remove(rotationGroup);
                this.isAnimating = false;
                if (callback) callback();
            }
        };
        
        animate();
    }
    
    finalizeRotation(rotationGroup, layerCubes, originalTransforms) {
        // Apply final transformation to each cube
        layerCubes.forEach((cube, index) => {
            // Get the cube's current transform relative to the rotation group
            const localPosition = cube.position.clone();
            const localQuaternion = cube.quaternion.clone();
            
            // Remove from rotation group and add back to main group
            rotationGroup.remove(cube);
            this.group.add(cube);
            
            // Apply the rotation group's transform to get final position
            localPosition.applyMatrix4(rotationGroup.matrix);
            localQuaternion.premultiply(rotationGroup.quaternion);
            
            // Set final position and rotation
            cube.position.copy(localPosition);
            cube.quaternion.copy(localQuaternion);
            
            // Update userData coordinates based on rounded position
            cube.userData.x = Math.round(cube.position.x) + 1;
            cube.userData.y = Math.round(cube.position.y) + 1;
            cube.userData.z = Math.round(cube.position.z) + 1;
        });
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    scramble() {
        const moves = ['R', 'L', 'U', 'D', 'F', 'B'];
        const modifiers = ['', "'", '2'];
        const scrambleMoves = [];
        
        for (let i = 0; i < 15; i++) {
            const move = moves[Math.floor(Math.random() * moves.length)];
            const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
            scrambleMoves.push(move + modifier);
        }
        
        const scrambleSequence = scrambleMoves.join(' ');
        this.executeMove(scrambleSequence);
        return scrambleSequence;
    }
    
    reset() {
        // Remove all cubes
        this.cubes.forEach(cube => {
            this.group.remove(cube);
        });
        this.cubes = [];
        
        // Recreate cube
        this.createCube();
        this.setupColors();
        this.state = this.getInitialState();
        this.moveHistory = [];
        this.updateMoveDisplay();
    }
    
    updateMoveDisplay() {
        const display = document.getElementById('moves-display');
        if (this.moveHistory.length === 0) {
            display.innerHTML = 'No moves yet';
        } else {
            display.innerHTML = this.moveHistory.map((move, index) => 
                `<div class="move-item">${index + 1}. ${move}</div>`
            ).join('');
            display.scrollTop = display.scrollHeight;
        }
    }
    
    getStateString() {
        // Simple state representation for solver
        return this.moveHistory.join(' ');
    }
}