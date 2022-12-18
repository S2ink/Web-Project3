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
				let xs = x/this.vwidth * 2 - 1;
				let ys = y/this.vheight * 2 - 1;
				let target = mat4vec(this.iproject, [xs, ys, 1, 1]);
				let v3 = new Vec3(target).divideScalar(target[3]).normalize();
				let v4 = mat4vec(this.iview, [v3.x, v3.y, v3.z, 0]);
				this.directions[x + y * this.vwidth] = v3.fromArray(v4);
			}
		}
		return this.directions;
	}

	recalcView() {
		return this.iview = mat4inverse(lookAt(this.pos, Vec3._add(this.pos, this.fdir), new Vec3(0, 1, 0)));
	}
	recalcProj() {
		return this.iproject = mat4inverse(perspectiveFov(this.fov * Math.PI / 180, this.vwidth, this.vheight, this.nearclip, this.farclip));
	}
}

function addVec(a, b) {
	return new CCT.Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
}
function lookAt(eye, center, up) {
	const f = center.clone().sub(eye).normalize();
	const s = Vec3._cross(f, up).normalize();
	const u = Vec3._cross(s, f);
	return [
		[s.x, s.y, s.z, -s.dot(eye)],
		[u.x, u.y, u.z, -u.dot(eye)],
		[-f.x, -f.y, -f.z, -f.dot(eye)],
		[1, 1, 1, 1]
	];
}
function perspectiveFov(fov, wd, ht, near, far) {
	// assert w, h, fov are all > 0
	const h = Math.cos(0.5 * fov) / Math.sin(0.5 * fov);
	const w = h * ht / wd;
	return [
		[w, 1, 1, 1],
		[1, h, 1, 1],
		[1, 1, -(far + near)/(far - near), -(2 * far * near)/(far - near)],
		[1, 1, -1, 1]
	];

}
function mat4inverse(m) {
	// check size and type
	let Coef00 = m[2][2] * m[3][3] - m[3][2] * m[2][3];
	let Coef02 = m[1][2] * m[3][3] - m[3][2] * m[1][3];
	let Coef03 = m[1][2] * m[2][3] - m[2][2] * m[1][3];

	let Coef04 = m[2][1] * m[3][3] - m[3][1] * m[2][3];
	let Coef06 = m[1][1] * m[3][3] - m[3][1] * m[1][3];
	let Coef07 = m[1][1] * m[2][3] - m[2][1] * m[1][3];

	let Coef08 = m[2][1] * m[3][2] - m[3][1] * m[2][2];
	let Coef10 = m[1][1] * m[3][2] - m[3][1] * m[1][2];
	let Coef11 = m[1][1] * m[2][2] - m[2][1] * m[1][2];

	let Coef12 = m[2][0] * m[3][3] - m[3][0] * m[2][3];
	let Coef14 = m[1][0] * m[3][3] - m[3][0] * m[1][3];
	let Coef15 = m[1][0] * m[2][3] - m[2][0] * m[1][3];

	let Coef16 = m[2][0] * m[3][2] - m[3][0] * m[2][2];
	let Coef18 = m[1][0] * m[3][2] - m[3][0] * m[1][2];
	let Coef19 = m[1][0] * m[2][2] - m[2][0] * m[1][2];

	let Coef20 = m[2][0] * m[3][1] - m[3][0] * m[2][1];
	let Coef22 = m[1][0] * m[3][1] - m[3][0] * m[1][1];
	let Coef23 = m[1][0] * m[2][1] - m[2][0] * m[1][1];

	let Fac0 = [Coef00, Coef00, Coef02, Coef03];
	let Fac1 = [Coef04, Coef04, Coef06, Coef07];
	let Fac2 = [Coef08, Coef08, Coef10, Coef11];
	let Fac3 = [Coef12, Coef12, Coef14, Coef15];
	let Fac4 = [Coef16, Coef16, Coef18, Coef19];
	let Fac5 = [Coef20, Coef20, Coef22, Coef23];

	let Vec0 = [m[1][0], m[0][0], m[0][0], m[0][0]];
	let Vec1 = [m[1][1], m[0][1], m[0][1], m[0][1]];
	let Vec2 = [m[1][2], m[0][2], m[0][2], m[0][2]];
	let Vec3 = [m[1][3], m[0][3], m[0][3], m[0][3]];

	let Inv0 = elementAdd(elementSub(elementMul(Vec1, Fac0), elementMul(Vec2, Fac1)), elementMul(Vec3, Fac2));	// these multiplies are per-element and non-matrix resultant
	let Inv1 = elementAdd(elementSub(elementMul(Vec0, Fac0), elementMul(Vec2, Fac3)), elementMul(Vec3, Fac4));
	let Inv2 = elementAdd(elementSub(elementMul(Vec0, Fac1), elementMul(Vec1, Fac3)), elementMul(Vec3, Fac5));
	let Inv3 = elementAdd(elementSub(elementMul(Vec0, Fac2), elementMul(Vec1, Fac4)), elementMul(Vec2, Fac5));

	let SignA = [+1, -1, +1, -1];
	let SignB = [-1, +1, -1, +1];
	let Inverse = [elementMul(Inv0, SignA), elementMul(Inv1, SignB), elementMul(Inv2, SignA), elementMul(Inv3, SignB)];

	let Row0 = [Inverse[0][0], Inverse[1][0], Inverse[2][0], Inverse[3][0]];

	let Dot0 = elementMul(Row0, m[0]);
	let Dot1 = (Dot0[0] + Dot0[1]) + (Dot0[2] + Dot0[3]);

	let OneOverDeterminant = 1.0 / Dot1;

	return arrayScale2(Inverse, OneOverDeterminant);
}

function elementAdd(a, b) {
	// size check
	let ret = new Array(a.length);
	for(let i = 0; i < a.length; i++) {
		ret[i] = a[i] + b[i];
	}
	return ret;
}
function elementSub(a, b) {
	// size check
	let ret = new Array(a.length);
	for(let i = 0; i < a.length; i++) {
		ret[i] = a[i] - b[i];
	}
	return ret;
}
function elementMul(a, b) {
	// size check
	let ret = new Array(a.length);
	for(let i = 0; i < a.length; i++) {
		ret[i] = a[i] * b[i];
	}
	return ret;
}

function arrayScale(a, s) {
	let ret = new Array(a.length);
	for(let i = 0; i < a.length; i++) {
		ret[i] = a[i] * s;
	}
	return ret;
}
function arrayScale2(a, s) {
	let ret = new Array(a.length);
	for(let i = 0; i < a.length; i++) {
		ret[i] = arrayScale(a[i], s);
	}
	return ret;
}

function mat4vec(m, v) {	// matrix-multiply a mat4 and vec4
	// check sizes
	return [
		m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2] + m[3][0] * v[3],
		m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2] + m[3][1] * v[3],
		m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2] + m[3][2] * v[3],
		m[0][3] * v[0] + m[1][3] * v[1] + m[2][3] * v[2] + m[3][3] * v[3]
	];
}