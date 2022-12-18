class Camera {
	constructor() {
		this.fov = 45.0;	// degrees
		this.nearclip = 0.1;
		this.farclip = 100.0;
		this.pos = new Vec3(0);
		this.fdir = new Vec3(0);		// forward looking direction

		this.vwidth = 0;
		this.vheight = 0;
		this.iview = null;		// mat4
		this.iproject = null;	// mat4
		this.directions = null;
	}

	update() {

	}
	resize() {

	}
	getRayDirections() {
		if(this.directions === null || this.directions.length != this.vwidth * this.vheight) {
			this.directions = new Array(this.vwidth * this.vheight);
		}
		for(let y = 0; y < this.vheight; y++) {
			for(let x = 0; x < this.vwidth; x++) {
				let xs = x / this.vwidth * 2 - 1;
				let ys = y / this.vheight * 2 - 1;
				let target = mat4vec(this.iproject, new Vec4(xs, ys, 1, 1));
				this.directions[x + y * this.vwidth] =
					mat4vec(this.iview, new Vec4(
							target.toVec3().divideScalar(target.w).normalize()
						)).toVec3();
			}
		}
		return this.directions;
	}

	recalcView() {
		return this.iview = Mat4._inverse(
			lookAt(this.pos, Vec3._add(this.pos, this.fdir), new Vec3(0, 1, 0))
		);
	}
	recalcProj() {
		return this.iproject = Mat4._inverse(
			perspectiveFov(this.fov * Math.PI / 180, this.vwidth, this.vheight, this.nearclip, this.farclip)
		);
	}
}

function lookAt(eye, center, up) {
	const f = Vec3._sub(center, eye).normalize();
	const s = Vec3._cross(f, up).normalize();
	const u = Vec3._cross(s, f);
	return new Mat4(
		[s.x, u.x, -f.x, 1],
		[s.y, u.y, -f.y, 1],
		[s.z, u.z, -f.z, 1],
		[-s.dot(eye), -u.dot(eye), -f.dot(eye), 1]
	);
}
function perspectiveFov(fov, wd, ht, near, far) {
	// assert w, h, fov are all > 0
	const h = Math.cos(0.5 * fov) / Math.sin(0.5 * fov);
	const w = h * ht / wd;
	return new Mat4(
		[w, 0, 0, 0],
		[0, h, 0, 0],
		[0, 0, -(far + near)/(far - near), -1],
		[0, 0, -(2 * far * near)/(far - near), 0]
	);
}