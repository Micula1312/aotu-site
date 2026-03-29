// Three.js constellation visualization with media rendering

import * as THREE from 'three';

// Create scene
const scene = new THREE.Scene();

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Create renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create stars
const starGeometry = new THREE.BufferGeometry();
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff });
const stars = new Float32Array(10000 * 3);

for (let i = 0; i < 10000; i++) {
    stars[i * 3] = (Math.random() - 0.5) * 2000;
    stars[i * 3 + 1] = (Math.random() - 0.5) * 2000;
    stars[i * 3 + 2] = (Math.random() - 0.5) * 2000;
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
const starField = new THREE.Points(starGeometry, starMaterial);
scene.add(starField);

// Position camera
camera.position.z = 5;

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    starField.rotation.y += 0.001;
    renderer.render(scene, camera);
}
animate();
