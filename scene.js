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
	constructor(r, g, t, rfi) {
		super();
		this.roughness = r ?? 1;
		this.glossiness = g ?? 0;
		this.transparency = t ?? 0;
		this.refraction_index = rfi ?? 1;
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
	constructor(lum, clr, mat) {
		super();
		this.luminance = lum ?? 0;
		this.albedo = clr ?? vec3.create();	// might need to expand this into a texture system if we want image textures
		this.mat = mat ?? new Material();	// and expand this if we need more exotic material defs
	}

	update(gl) {
		gl.uniform1f(this.bindings.luminance, this.luminance);
		gl.uniform3fv(this.bindings.albedo, this.albedo);
		return this.mat.update(gl);
	}

}
function Srf(lum, clr, mat) { return new Surface(lum, clr, mat); }
class Sphere extends GLStruct {
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
	constructor(a, b, c, surface) {
		super();
		this.a = a ?? vec3.create();
		this.b = b ?? vec3.create();
		this.c = c ?? vec3.create();
		this.surface = surface ?? new Surface();
		// buffers for rotating, resizing, moving, etc (ex. center pos)
	}

	update(gl) {
		gl.uniform3fv(this.bindings.a, this.a);
		gl.uniform3fv(this.bindings.b, this.b);
		gl.uniform3fv(this.bindings.c, this.c);
		return this.surface.update(gl);
	}

}

class Scene {
	constructor() {
		this.spheres = [];
	}

	cacheSphereLocations(gl, program, arrname) {
		for(let i = 0; i < this.spheres.length; i++) {
			const n = arrname + '[' + i + ']';
			this.spheres[i].bind(gl, program, n);
		}
	}
	updateSpheres(gl) {
		for(let i =0; i < this.spheres.length; i++) {
			this.spheres[i].update(gl);
		}
	}

	trySelect(src) {
		let t_max = Number.POSITIVE_INFINITY;
		let ret = -1;
		for(let i = 0; i < this.spheres.length; i++) {
			let t;
			if(t = Sphere.test(src, this.spheres[i], hit, 0, t_max)) {
				t_max = t;
				ret = i;
			}
		}
		return ret;
	}
}



Sphere.test = function(src, s, t_min = 0, t_max = Number.POSITIVE_INFINITY) {
	let o = vec3.sub(vec3.create(), src.origin, s.center);
	let a = vec3.dot(src.direction, src.direction);
	let b = 2 * vec3.dot(o, src.direction);
	let c = vec3.dot(o, o) - (s.radius * s.radius);
	let d = (b * b) - (4 * a * c);
	if(d < 0) return 0;
	let time = (Math.sqrt(d) + b) / (-2 * a);
	if(time < t_min || time > t_max) return 0;
	return time;
}
Sphere.interacts = function(src, s, hit, t_min = 0, t_max = Number.POSITIVE_INFINITY) {
	let o = vec3.sub(vec3.create(), src.origin, s.center);
	let a = vec3.dot(src.direction, src.direction);
	let b = 2 * vec3.dot(o, src.direction);
	let c = vec3.dot(o, o) - (s.radius * s.radius);
	let d = (b * b) - (4 * a * c);
	if(d < 0) return false;
	hit.time = (Math.sqrt(d) + b) / (-2 * a);
	if(hit.time < t_min || hit.time > t_max) return false;
	vec3.scaleAndAdd(hit.normal.origin, src.origin, src.direction, hit.time);
	vec3.sub(hit.normal.direction, hit.normal.origin, s.center);
	vec3.scale(hit.normal.direction, hit.normal.direction, 1 / s.radius);
	if(hit.reverse_intersect = vec3.dot(hit.normal.direction, src.direction) > 0) {
		vec3.negate(hit.normal.direction, hit.normal.direction);
	}
	return true;
}
Triangle.test = function(src, t, t_min = 0, t_max = Number.POSITIVE_INFINITY) {

}
Triangle.interacts = function(src, t, hit, t_min = 0, t_max = Number.POSITIVE_INFINITY) {

}