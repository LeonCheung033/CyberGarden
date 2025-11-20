/**
 * Physics World
 * 使用 Cannon.js 物理引擎
 */

import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -2, 0) // 轻微重力
        });
        
        // 设置默认材质
        this.defaultMaterial = new CANNON.Material('default');
        this.defaultContactMaterial = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: 0.1,
                restitution: 0.3
            }
        );
        this.world.addContactMaterial(this.defaultContactMaterial);
        this.world.defaultContactMaterial = this.defaultContactMaterial;
        
        // 时间步长
        this.timeStep = 1 / 60;
        this.maxSubSteps = 3;
    }

    addBody(body) {
        this.world.addBody(body);
    }

    removeBody(body) {
        this.world.removeBody(body);
    }

    step(deltaTime) {
        this.world.step(this.timeStep, deltaTime, this.maxSubSteps);
    }

    createGround(size = 40) {
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        groundBody.position.set(0, -2.5, 0);
        this.addBody(groundBody);
        return groundBody;
    }

    createButterflyBody(position, size = 0.1) {
        const shape = new CANNON.Sphere(size);
        const body = new CANNON.Body({ mass: 0.1 });
        body.addShape(shape);
        body.position.set(position.x, position.y, position.z);
        body.linearDamping = 0.4; // 空气阻力
        body.angularDamping = 0.4;
        this.addBody(body);
        return body;
    }
}

export { PhysicsWorld };

