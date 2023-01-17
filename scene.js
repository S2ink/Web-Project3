// utility
class Ray {
    constructor() {
        this.origin = vec3.create();
        this.direction = vec3.create();
    }
}
class Hit {
    constructor() {
        this.reverse_intersect = false;
        this.time = 0;
        this.normal = new Ray();
        //this.uv = [0, 0];   // create Vec2
    }
}

/**
 * Extendable class for all things that should be bound to glsl structs
 */
class GLStruct {
	constructor() {
		this.bindings = {};
	}

	bind(gl, program, struct)	// cache the locations of all struct elements (for the name of the struct passed in)
		{ return GLStruct.bindStruct(gl, program, this, struct); }
	update(gl)	// update the values of the bound struct to the current js values
		{ return GLStruct.updateStruct(gl, this); }

	static bindStruct(gl, program, sobj, sname) {
		if(!(sobj instanceof GLStruct)) return false;
		let ret = true;
		const base = sname + '.';
		for(const key in sobj) {
			if(key == "bindings") continue;
			const val = sobj[key];
			if(val instanceof GLStruct) {
				ret &= this.bindStruct(gl, program, val, base + key);
				sobj.bindings[key] = undefined;
			} else {
				const pos = gl.getUniformLocation(program, base + key);
				if(pos != null) {
					sobj.bindings[key] = pos;
					continue
				}
				ret = false;
			}
		}
		return ret;
	}
	static updateStruct(gl, sobj) {
		if(!(sobj instanceof GLStruct)) return false;
		let ret = true;
		for(const key in sobj.bindings) {
			const val = sobj[key];
			if(val instanceof GLStruct) {
				ret &= this.updateStruct(gl, val);
			} else {
				const loc = sobj.bindings[key];
				if(val instanceof glMatrix.glMatrix.ARRAY_TYPE) {
					switch(val.length) {
						case 2: gl.uniform2fv(loc, val); continue;
						case 3: gl.uniform3fv(loc, val); continue;
						case 4: gl.uniform4fv(loc, val); continue;
						case 9: gl.uniformMatrix3fv(loc, false, val); continue;
						case 16: gl.uniformMatrix4fv(loc, false, val); continue;
						default: ret = false;
					}
				} else {
					gl.uniform1f(loc, val);
				}
			}
		}
		return ret;
	}

}



class Material extends GLStruct {	// This doesn't have to be the only material type
	static F32_LEN = 4;
	constructor(r, g, t, rfi) {
		super();
		this.roughness = r ?? 1;
		this.glossiness = g ?? 0;
		this.transparency = t ?? 0;
		this.refraction_index = rfi ?? 1;
	}

	copy() {
		return new Material(
			this.roughness,
			this.glossiness,
			this.transparency,
			this.refraction_index
		);
	}

	update(gl) {	// overload the default
		gl.uniform1f(this.bindings.roughness, this.roughness);
		gl.uniform1f(this.bindings.glossiness, this.glossiness);
		gl.uniform1f(this.bindings.transparency, this.transparency);
		gl.uniform1f(this.bindings.refraction_index, this.refraction_index);
		return true;
	}

}
function Mat(r, g, t, rfi) { return new Material(r, g, t, rfi); }

/**
 * All interactables should "have" (not be) a surface. (this makes it easy to send to glsl)
 * This contains / defines ray redirection behavior as well as albedo and luminance
 */
class Surface extends GLStruct {
	static F32_LEN = 5;
	constructor(lum, clr, mat) {
		super();
		this.luminance = lum ?? 0;
		this.albedo = clr ?? vec3.create();	// might need to expand this into a texture system if we want image textures
		this.mat = mat ?? new Material();	// and expand this if we need more exotic material defs
	}

	copy() {
		return new Surface(
			this.luminance,
			this.albedo,
			this.mat.copy()
		);
	}

	update(gl) {
		gl.uniform1f(this.bindings.luminance, this.luminance);
		gl.uniform3fv(this.bindings.albedo, this.albedo);
		return this.mat.update(gl);
	}

}
function Srf(lum, clr, mat) { return new Surface(lum, clr, mat); }

class Sphere extends GLStruct {
	static F32_LEN = 5;
	constructor(pos, rad, surface) {
		super();
		this.center = pos ?? vec3.create();
		this.radius = rad ?? 1;
		this.surface = surface ?? new Surface();
	}

	update(gl) {	// overload the default
		console.log(this);
		gl.uniform3fv(this.bindings.center, this.center);
		gl.uniform1f(this.bindings.radius, this.radius);
		return this.surface.update(gl);
	}

}
class Triangle extends GLStruct {
	static F32_LEN = 10;
	constructor(a, b, c, surface) {
		super();
		this.a = a ?? vec3.create();
		this.b = b ?? vec3.create();
		this.c = c ?? vec3.create();
		this.surface = surface ?? new Surface();
		// buffers for rotating, resizing, moving, etc (ex. center pos)
	}

	update(gl) {
		console.log(this);
		gl.uniform3fv(this.bindings.a, this.a);
		gl.uniform3fv(this.bindings.b, this.b);
		gl.uniform3fv(this.bindings.c, this.c);
		return this.surface.update(gl);
	}

}
class Cube {
	constructor() {
		this.primatives = [];
	}

	static fromSize(w, h, d, o, srf) {

	}
	static fromPoints(a, b, c, d, e, f, g, h, srf) {
		const q = new Cube();
		const s = srf ?? new Surface();
		q.primitives = [
			new Triangle(a, b, c, s.copy()),	//       a
			new Triangle(a, c, d, s.copy()),	//   b  |     d
			new Triangle(a, b, h, s.copy()),	//  |  h  c  |
			new Triangle(b, g, h, s.copy()),	// g     |  e
			new Triangle(b, c, g, s.copy()),	//      f
			new Triangle(c, f, g, s.copy()),
			new Triangle(c, d, f, s.copy()),
			new Triangle(d, f, e, s.copy()),
			new Triangle(a, d, e, s.copy()),
			new Triangle(a, h, e, s.copy()),
			new Triangle(e, f, g, s.copy()),
			new Triangle(g, h, e, s)
		];
		return q;
	}
}



Sphere.test = function(s, src, t_min = 0, t_max = Number.POSITIVE_INFINITY) {
	return this._test(s.center, s.radius, src, t_min, t_max);
}
Sphere._test = function(xyz, r, src, t_min = 0, t_max = Number.POSITIVE_INFINITY) {
	let o = vec3.sub(vec3.create(), src.origin, xyz);
	let a = vec3.dot(src.direction, src.direction);
	let b = 2 * vec3.dot(o, src.direction);
	let c = vec3.dot(o, o) - (r * r);
	let d = (b * b) - (4 * a * c);
	if(d < 0) return 0;
	let time = (Math.sqrt(d) + b) / (-2 * a);
	if(time < t_min || time > t_max) return 0;
	return time;
}
Sphere.interacts = function(s, src, hit, t_min = 0, t_max = Number.POSITIVE_INFINITY) {
	return this._interacts(s.center, s.radius, src, hit, t_min, t_max);
}
Sphere._interacts = function(xyz, r, src, hit, t_min = 0, t_max = Number.POSITIVE_INFINITY) {
	let o = vec3.sub(vec3.create(), src.origin, xyz);
	let a = vec3.dot(src.direction, src.direction);
	let b = 2 * vec3.dot(o, src.direction);
	let c = vec3.dot(o, o) - (r * r);
	let d = (b * b) - (4 * a * c);
	if(d < 0) return false;
	hit.time = (Math.sqrt(d) + b) / (-2 * a);
	if(hit.time < t_min || hit.time > t_max) return false;
	vec3.scaleAndAdd(hit.normal.origin, src.origin, src.direction, hit.time);
	vec3.sub(hit.normal.direction, hit.normal.origin, xyz);
	vec3.scale(hit.normal.direction, hit.normal.direction, 1 / r);
	if(hit.reverse_intersect = vec3.dot(hit.normal.direction, src.direction) > 0) {
		vec3.negate(hit.normal.direction, hit.normal.direction);
	}
	return true;
}
Triangle.test = function(t, src, t_min = 0, t_max = Number.POSITIVE_INIFINITY) {
	return this._test(t.a, t.b, t.c, src, t_min, t_max);
}
Triangle._test = function(a, b, c, src, t_min = 0, t_max = Number.POSITIVE_INFINITY) {
	const EPSILON = 1e-5;
	const s1 = vec3.sub(vec3.create(), b, a);	// side 1
	const s2 = vec3.sub(vec3.create(), c, a);	// side 2
	const h = vec3.create(), s = vec3.create(), q = vec3.create();
	let d, f, u, v;

	vec3.cross(h, src.direction, s2);
	d = vec3.dot(s1, h);
	if(d > -EPSILON && d < EPSILON) return 0;
	f = 1 / d;
	vec3.sub(s, src.origin, a);
	u = f * vec3.dot(s, h);
	if(u < 0 || u > 1) return 0;
	vec3.cross(q, s, s1);
	v = f * vec3.dot(src.direction, q);
	if(v < 0 || u + v > 1) return 0;

	let time = f * vec3.dot(s2, q);
	if(time <= EPSILON || time < t_min || time > t_max) return 0;
	return time;
}
Triangle.interacts = function(t, src, hit, t_min = 0, t_max = Number.POSITIVE_INFINITY) {
	return this._interacts(t.a, t.b, t.c, src, hit, t_min, t_max);
}
Triangle._interacts = function(a, b, c, src, hit, t_min = 0, t_max = Number.POSITIVE_INFINITY) {
	const EPSILON = 1e-5;
	const s1 = vec3.sub(vec3.create(), b, a);	// side 1
	const s2 = vec3.sub(vec3.create(), c, a);	// side 2
	const h = vec3.create(), s = vec3.create(), q = vec3.create();
	let d, f, u, v;

	vec3.cross(h, src.direction, s2);
	d = vec3.dot(s1, h);
	if(d > -EPSILON && d < EPSILON) return false;
	f = 1 / d;
	vec3.sub(s, src.origin, a);
	u = f * vec3.dot(s, h);
	if(u < 0 || u > 1) return false;
	vec3.cross(q, s, s1);
	v = f * vec3.dot(src.direction, q);
	if(v < 0 || u + v > 1) return false;

	hit.time = f * vec3.dot(s2, q);
	if(hit.time <= EPSILON || hit.time < t_min || hit.time > t_max) return false;
	vec3.scaleAndAdd(hit.normal.origin, src.origin, src.direction, hit.time);
	vec3.cross(hit.normal.direction, s1, s2);
	if(vec3.dot(hit.normal.direction, src.direction) > 0) {
		vec3.negate(hit.normal.direction, hit.normal.direction);
	}
	hit.reverse_intersect = false;
	return true;
}



class Float32ArrayTexture {
	constructor(arr_item1, gl, unit, prog, unif) {
		this.data = new Float32Array(arr_item1);
		this.texture = undefined;
		this.unit = -1;
		if(gl) {
			this.attach(gl, unit, prog, unif);
		}
	}

	bindActive(gl) {
		if(this.unit >= 0) {
			if(this.texture == undefined) { this.texture = gl.createTexture(); }
			gl.activeTexture(gl.TEXTURE0 + this.unit);
			gl.bindTexture(gl.TEXTURE_2D, this.texture);
			return this;
		}
		return null;
	}
	attach(gl, t_unit, prog, unif) {
		if(t_unit != undefined) { this.unit = t_unit; }
		if(this.bindActive(gl)) {
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
			gl.activeTexture(gl.TEXTURE0);
			if(prog) {
				bindTextureUnit(gl, prog, this.unit, unif);
			}
			return this;
		}
		return null;
	}
	attachUniform(gl, program, uniform) {
		if(this.unit >= 0) {
			bindTextureUnit(gl, program, this.unit, uniform);
			return this;
		}
		return null;
	}
	update(gl, blksz = 1) {
		if(this.bindActive(gl)) {
			gl.texImage2D(
				gl.TEXTURE_2D, 0, gl.R32F,
				blksz, Math.floor(this.data.length / blksz),
				0, gl.RED, gl.FLOAT,
				this.data
			);
			gl.activeTexture(gl.TEXTURE0);
			return this;
		}
		return null;
	}
}
class Scene {
	static SPHERE_SAMPLER_UNIFORM = "sphere_data";
	static TRIANGLE_SAMPLER_UNIFORM = "triangle_data";
	static SURFACE_SAMPLER_UNIFORM = "surface_data";
	static MATERIAL_SAMPLER_UNIFORM = "material_data";
	constructor(gl, start_unit, prog) {
		this.spheres = new Float32ArrayTexture();
		this.triangles = new Float32ArrayTexture();
		this.surfaces = new Float32ArrayTexture();
		this.materials = new Float32ArrayTexture();
		if(gl) {
			this.attachTextures(gl, start_unit, prog);
		}
	}

	attachTextures(gl, start_unit, program) {
		this.spheres.attach(
			gl, start_unit + 0, program, Scene.SPHERE_SAMPLER_UNIFORM);
		this.triangles.attach(
			gl, start_unit + 1, program, Scene.TRIANGLE_SAMPLER_UNIFORM);
		this.surfaces.attach(
			gl, start_unit + 2, program, Scene.SURFACE_SAMPLER_UNIFORM);
		this.materials.attach(
			gl, start_unit + 3, program, Scene.MATERIAL_SAMPLER_UNIFORM);
		return this;
	}
	update(gl) {
		this.spheres.update(gl, Sphere.F32_LEN);
		this.triangles.update(gl, Triangle.F32_LEN);
		this.surfaces.update(gl, Surface.F32_LEN);
		this.materials.update(gl, Material.F32_LEN);
		return this;
	}

	addSpheres(...spheres) {
		const arr = Array.from(spheres).flat().filter(s => s instanceof Sphere);
		const floats = new Float32Array(arr.length * Sphere.F32_LEN);
		const surfaces = new Array(arr.length);
		let f = 0;
		for(let i = 0; i < arr.length; i++) {
			floats.set(arr[i].center, f);
			floats[f + 3] = arr[i].radius;
			surfaces[i] = arr[i].surface;
			f += Sphere.F32_LEN;
		}
		let ids = this.addSurfaces(surfaces);
		f = 4;
		for(let i = 0; i < arr.length; i++) {
			floats[f] = ids[i];
			f += Sphere.F32_LEN;
		}
		this.spheres.data = this.spheres.data.concat(floats);
	}
	addTriangles(...triangles) {
		const arr = Array.from(triangles).flat().filter(t => t instanceof Triangle);
		const floats = new Float32Array(arr.length * Triangle.F32_LEN);
		const surfaces = new Array(arr.length);
		let f = 0;
		for(let i = 0; i < arr.length; i++) {
			floats.set(arr[i].a, f + 0);
			floats.set(arr[i].b, f + 3);
			floats.set(arr[i].c, f + 6);
			surfaces[i] = arr[i].surface;
			f += Triangle.F32_LEN;
		}
		let ids = this.addSurfaces(surfaces);
		f = 9;
		for(let i = 0; i < arr.length; i++) {
			floats[f] = ids[i];
			f += Triangle.F32_LEN;
		}
		this.triangles.data = this.triangles.data.concat(floats);
	}
	addCube() {}

	addSurfaces(...surfaces) {
		const arr = Array.from(surfaces).flat().filter(s => s instanceof Surface);
		const floats = new Float32Array(arr.length * Surface.F32_LEN);
		const mats = new Array(arr.length);
		let f = 0;
		for(let i = 0; i < arr.length; i++) {
			floats[f] = arr[i].luminance;
			floats.set(arr[i].albedo, f + 1);
			mats[i] = arr[i].mat;
			f += Surface.F32_LEN;
		}
		let ids = this.addMaterials(mats);
		f = 4;
		for(let i = 0; i < arr.length; i++) {
			floats[f] = ids[i];
			f += Surface.F32_LEN;
		}
		let start = (this.surfaces.data.length / Surface.F32_LEN);
		this.surfaces.data = this.surfaces.data.concat(floats);
		for(let i = 0; i < mats.length; i++) {	// repurpose mat array because it is already the correct size
			mats[i] = start + i;
		}
		return mats;
	}
	addMaterials(...materials) {
		const arr = Array.from(materials).flat().filter(m => m instanceof Material);
		const floats = new Float32Array(arr.length * Material.F32_LEN);
		const ret_ids = new Array(arr.length);
		let f = 0;
		for(let i = 0; i < arr.length; i++) {
			floats[f + 0] = arr[i].roughness;
			floats[f + 1] = arr[i].glossiness;
			floats[f + 2] = arr[i].transparency;
			floats[f + 3] = arr[i].refraction_index;
			f += Material.F32_LEN;
		}
		let start = (this.materials.data.length / Material.F32_LEN);
		this.materials.data = this.materials.data.concat(floats);
		for(let i = 0; i < ret_ids.length; i++) {
			ret_ids[i] = start + i;
		}
		return ret_ids;
	}

	addObjects() {}


	trySelect(src) {
		let t_max = Number.POSITIVE_INFINITY;
		let ret = { type:"sky", idx:-1 };
		let t;
		for(let i = 0; i < this.spheres.data.length; i += Sphere.F32_LEN) {
			if(t = Sphere._test(
				this.spheres.data.subarray(i, i + 3),
				this.spheres.data[i + 3], src, 0, t_max)
			) {
				t_max = t;
				ret.idx = i / Sphere.F32_LEN;
				ret.type = "sphere";
			}
		}
		for(let i = 0; i < this.triangles.data.length; i += Triangle.F32_LEN) {
			if(t = Triangle._test(
				this.triangles.data.subarray(i + 0, i + 3),
				this.triangles.data.subarray(i + 3, i + 6),
				this.triangles.data.subarray(i + 6, i + 9),
				src, 0, t_max)
			) {
				t_max = t;
				ret.idx = i / Triangle.F32_LEN;
				ret.type = "triangle";
			}
		}
		return ret;
	}
}