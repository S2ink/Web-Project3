const canvas = document.querySelector("#render");
const frame = document.getElementById("frame");
const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
if(gl === null) {
	alert("Error: WebGL is unsupported.");
}
let width, height, scale = 2;
canvas.width = width = 640;
canvas.height = height = 480;
const start_time = Date.now();
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
gl.clearColor(0,0,0,1);
gl.clear(gl.COLOR_BUFFER_BIT);

let fDir = vec3.fromValues(0, 0, 1);
const upDir = vec3.fromValues(0,1,0);
let rDir = vec3.cross(vec3.create(), fDir, upDir);
let camPos = vec3.fromValues(0, 0, 0);

let view_mat = mat4.lookAt(mat4.create(), camPos, fDir, upDir);
let proj_mat = mat4.perspective(mat4.create(), 60 * Math.PI / 180, width / height, 0.1, 100.0);
let iview_mat = mat4.invert(mat4.create(), view_mat);
let iproj_mat = mat4.invert(mat4.create(), proj_mat);

const vertex_src = `#version 300 es
	in vec2 vertex;
	void main() {
		gl_Position = vec4(vertex, 0, 1);
	}
`;
const fragment_src = `#version 300 es
#define EPSILON 0.00001
#define PI 3.1415926538

#ifdef GL_FRAGMENT_PRECISION_HIGH
	precision highp float;
#else
	precision mediump float;
#endif

float r_ = 0.0;
float random(vec3 scale, float seed) {
	r_ += 1.0;
	return fract(sin(dot(gl_FragCoord.xyz + (seed + r_), scale)) * 43758.5453 + (seed + r_));
}
vec3 cosineWeightedDirection(float seed, vec3 normal) {
	float u = random(vec3(12.9898, 78.233, 151.7182), seed);
	float v = random(vec3(63.7264, 10.873, 623.6736), seed);
	float r = sqrt(u);
	float angle = 6.283185307179586 * v;	// compute basis from normal
	vec3 sdir, tdir;
	if (abs(normal.x) < .5) {
		sdir = cross(normal, vec3(1,0,0));
	} else {
		sdir = cross(normal, vec3(0,1,0));
	}
	tdir = cross(normal, sdir);
	return r * cos(angle) * sdir + r * sin(angle) * tdir + sqrt(1. - u) * normal;
}
vec3 uniformlyRandomDirection(float seed) {
	float u = random(vec3(12.9898, 78.233, 151.7182), seed);
	float v = random(vec3(63.7264, 10.873, 623.6736), seed);
	float z = 1.0 - 2.0 * u;
	float r = sqrt(1.0 - z * z);
	float angle = 6.283185307179586 * v;
	return vec3(r * cos(angle), r * sin(angle), z);
}
vec3 uniformlyRandomVector(float seed) {
	return uniformlyRandomDirection(seed) * sqrt(random(vec3(36.7539, 50.3658, 306.2759), seed));
}

struct Ray {
	vec3 origin;
	vec3 direction;
};
struct Hit {
	bool reverse_intersect;
	float time;
	Ray normal;
	vec2 uv;
};

struct Material {
	float roughness;
	float glossiness;
	float transparency;
	float refraction_index;
};

bool _reflect(in Ray src, in Hit hit, out Ray ret) {
	ret.origin = hit.normal.origin;
	ret.direction = reflect(src.direction, hit.normal.direction);
	return dot(ret.direction, hit.normal.direction) > 0.0;
}
bool _refract(in Ray src, in Hit hit, in float ir, out Ray ret) {
	ret.origin = hit.normal.origin;
	ret.direction = refract(src.direction, hit.normal.direction, ir);
	return true;
}
bool reflectGlossy(in Ray src, in Hit hit, out Ray ret, float gloss) {
	ret.origin = hit.normal.origin;
	ret.direction = reflect(src.direction, hit.normal.direction) + (uniformlyRandomDirection(hit.time) * gloss);
	return dot(ret.direction, hit.normal.direction) > 0.0;
}
float reflectance(float cos, float ir) {
	return pow( ((1. - ir) / (1. + ir)), 2. ) + (1. - ir) * pow(1. - cos, 5.);
}
bool refractGlossy(in Ray src, in Hit hit, in float ir, out Ray ret, float gloss) {
	float cos_theta = min(dot(-src.direction, hit.normal.direction), 1.0);
	float sin_theta = sqrt(1.0 - cos_theta * cos_theta);
	if(!hit.reverse_intersect) {
		ir = 1. / ir;
	}
	float r = random(src.direction * hit.normal.direction, hit.time);
	if ((ir * sin_theta) > 1.0 || (reflectance(cos_theta, ir) > r)) {
		return reflectGlossy(src, hit, ret, gloss);
	}
	vec3 r_out_perp = ir * (src.direction + cos_theta * hit.normal.direction);
	vec3 r_out_para = -sqrt(abs(1.0 - dot(r_out_perp, r_out_perp))) * hit.normal.direction;
	ret.direction = r_out_perp + r_out_para;
	ret.origin = hit.normal.origin;
	return true;
}
bool diffuse(in Hit hit, out Ray ret) {
	ret.origin = hit.normal.origin;
	ret.direction = cosineWeightedDirection(hit.time, hit.normal.direction);
	return true;
}
bool redirectRay(in Ray src, in Hit hit, in Material mat, out Ray ret) {
	float rand = random(vec3(36.7539, 50.3658, 306.2759) * src.direction, hit.time);
	if(rand < mat.roughness) {
		return diffuse(hit, ret);
	} else if(rand < mat.transparency) {
		return refractGlossy(src, hit, mat.refraction_index, ret, mat.glossiness);
	} else {
		return reflectGlossy(src, hit, ret, mat.glossiness);
	}
}


struct Sphere {
	vec3 position;
	float radius;
	float luminance;
	vec3 albedo;
	Material mat;
};

bool interactsSphere(in Ray ray, in Sphere s, inout Hit hit, float t_min, float t_max) {
	vec3 o = ray.origin - s.position;
	float a = dot(ray.direction, ray.direction);
	float b = 2.0 * dot(o, ray.direction);
	float c = dot(o, o) - (s.radius * s.radius);
	float d = (b * b) - (4.0 * a * c);
	if(d < 0.0) {
		return false;
	}
	hit.time = (sqrt(d) + b) / (-2.0 * a);
	if(hit.time < t_min || hit.time > t_max) {
		return false;
	}
	hit.normal.origin = ray.direction * hit.time + ray.origin;
	hit.normal.direction = normalize(hit.normal.origin - s.position);
	hit.reverse_intersect = dot(hit.normal.direction, ray.direction) > 0.0;
	if(hit.reverse_intersect) {
		hit.normal.direction *= -1.0;
	}
	return true;
}

vec3 getSourceRay(in vec2 proportional, in mat4 inv_proj, in mat4 inv_view) {
	vec4 t = inv_proj * vec4( (proportional * 2.0 - 1.0), 1.0, 1.0);
	return vec3( inv_view * vec4( normalize(vec3(t) / t.w), 0) );
}

// const Sphere objs[4] = Sphere[4](
// 	Sphere(vec3(0, 0, 4), 0.5, 0.0, vec3(0, 0.5, 0.5), Material(1.0, 0.0, 1.0, 1.5)),
// 	Sphere(vec3(2, 0, 5), 1.6, 0.0, vec3(0.6, 0.5, 0.2), Material(0.0, 0.0, 0.0, 0.0)),
// 	Sphere(vec3(-2, 2, 3), 0.3, 10.0, vec3(0.7, 0.2, 0.8), Material(1.0, 0.0, 0.0, 0.0)),
// 	Sphere(vec3(0, -100.3, 0), 100.0, 0.0, vec3(0.5, 0.7, 0.9), Material(1.0, 0.0, 0.0, 0.0))
// );
const Sphere objs[5] = Sphere[5](
	Sphere(vec3(0, 0.1, 3), 0.6, 0.0, vec3(0.1, 0.7, 0.7), Material(0.0, 0.0, 1.0, 1.4)),
	Sphere(vec3(0, -10, 4), 9.6, 0.0, vec3(0.7, 0.6, 0.8), Material(1.0, 0.0, 0.0, 0.0)),
	Sphere(vec3(1, 1, 5), 1.0, 7.0, vec3(0.5, 0.2, 0.2), Material(1.0, 0.0, 0.0, 0.0)),
	Sphere(vec3(-2, -0.3, 7), 3.0, 0.0, vec3(0.5, 0.7, 0.2), Material(1.0, 0.0, 0.0, 0.0)),
	Sphere(vec3(-1.8, 0, 3), 0.7, 0.0, vec3(0.7, 0.5, 0.1), Material(0.0, 0.0, 0.0, 0.0))
);
vec3 evalRay(in Ray ray, in int bounces) {
	vec3 total = vec3(0.0);
	vec3 cache = vec3(1.0);
	Ray current = ray;
	for(int b = bounces; b >= 0; b--) {
		Hit hit;
		hit.time = 10000000000000.;
		Hit tmp;
		bool interaction = false;
		int idx = -1;
		for(int i = 0; i < objs.length(); i++) {
			if(interactsSphere(current, objs[i], tmp, 0.0, hit.time)) {
				hit = tmp;
				interaction = true;
				idx = i;
			}
		}
		if(interaction) {
			float lum = objs[idx].luminance;
			vec3 clr = objs[idx].albedo;
			if(b == 0 || ((clr.x + clr.y + clr.z) / 3. * lum) >= 1.) {
				total += cache * clr * lum;
				return total;
			}
			Ray redirect;
			if(redirectRay(current, hit, objs[idx].mat, redirect)) {
				cache *= clr;
				total += cache * lum;
				current = redirect;
				continue;
			}
		}
		total += cache * vec3(0.05);
		break;
	}
	return total;
}

uniform mat4 iview, iproj;
uniform vec3 cam_pos;
uniform vec2 fsize;
uniform float realtime;
uniform float scale;
out vec4 pixColor;
void main() {
	//vec3 ray = getSourceRay(vec2(gl_FragCoord) / vec2(1280.0, 720.0), iproj, iview);
	Ray src = Ray(cam_pos, vec3(0.0));
	vec3 clr;
	for(int i = 0; i < 20; i++) {
		float r = random(clr, float(i));
		src.direction = getSourceRay((vec2(gl_FragCoord) + vec2(r)) / fsize, iproj, iview);
		clr += evalRay(src, 5);
	}
	clr /= 20.0;
	pixColor = vec4(sqrt(clr), 1.0);
	// Hit h;
	// if(interactsSphere(src, sp, h, 0.0, 1000000.0)) {
	// 	gl_FragColor = vec4(h.normal.direction * 0.5 + 0.5, 1);
	// } else {
	// 	gl_FragColor = vec4(0, 0, 0, 1);
	// }
	//ray = ray / 2.0 + 0.5;
	//gl_FragColor = vec4(ray.x, ray.y, ray.z, 1);
}
`;

const program = linkProgram( gl,
	compileShader(gl, vertex_src, gl.VERTEX_SHADER),
	compileShader(gl, fragment_src, gl.FRAGMENT_SHADER)
);
gl.useProgram(program);

var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1,  -1, 1,  1, -1,  -1, -1]), gl.STATIC_DRAW);
const vertex_pos = gl.getAttribLocation(program, "vertex");
gl.vertexAttribPointer(vertex_pos, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(vertex_pos);

gl.uniformMatrix4fv(
	gl.getUniformLocation(program, "iview"),
	false, iview_mat
);
gl.uniformMatrix4fv(
	gl.getUniformLocation(program, "iproj"),
	false, iproj_mat
);
gl.uniform3fv(
	gl.getUniformLocation(program, "cam_pos"),
	camPos
);
gl.uniform2fv(
	gl.getUniformLocation(program, "fsize"),
	vec2.fromValues(width, height)
);
gl.uniform1f(
	gl.getUniformLocation(program, "realtime"),
	Date.now() - start_time
);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);



let key_states = {
	w : false,
	a : false,
	s : false,
	d : false,
	q : false,
	e : false,
	shift : false,
	mouse_xy : vec2.create(),
	mouse_xy2 : vec2.create(),
	move_enabled : false,
	any() { return this.w || this.a || this.s || this.d || this.q || this.e || this.shift; },
	anyNotShift() { return this.w || this.a || this.s || this.d || this.q || this.e; },
	resetKeys() { this.w = this.a = this.s = this.d = this.q = this.e = this.shift = false; },
	resetDxDy() { vec2.copy(this.mouse_xy, this.mouse_xy2); }
};
canvas.addEventListener('mousedown', function(e){
	key_states.move_enabled = true;
	vec2.copy(
		key_states.mouse_xy2,
		vec2.set(
			key_states.mouse_xy,
			e.clientX,
			e.clientY
		),
	);
});
document.body.addEventListener('mousemove', function(e){
	if(key_states.move_enabled) {
		vec2.set(
			key_states.mouse_xy2,
			e.clientX,
			e.clientY
		);
	}
});
document.body.addEventListener('mouseup', function(e){
	if(key_states.move_enabled) {
		key_states.move_enabled = false;
		key_states.resetKeys();
	}
});
document.body.addEventListener('keydown', function(e){
	if(key_states.move_enabled) {
		key_states.w |= (e.key.toLowerCase() == 'w');
		key_states.a |= (e.key.toLowerCase() == 'a');
		key_states.s |= (e.key.toLowerCase() == 's');
		key_states.d |= (e.key.toLowerCase() == 'd');
		key_states.q |= (e.key.toLowerCase() == 'q');
		key_states.e |= (e.key.toLowerCase() == 'e');
		key_states.shift |= (e.key == 'Shift');
		console.log(e);
		return false;
	}
	return true;
});
document.body.addEventListener('keyup', function(e){		// technically don't need
	if(key_states.move_enabled) {
		key_states.w &= (e.key.toLowerCase() != 'w');
		key_states.a &= (e.key.toLowerCase() != 'a');
		key_states.s &= (e.key.toLowerCase() != 's');
		key_states.d &= (e.key.toLowerCase() != 'd');
		key_states.q &= (e.key.toLowerCase() != 'q');
		key_states.e &= (e.key.toLowerCase() != 'e');
		key_states.shift &= (e.key != 'Shift');
		return false;
	}
	return true;
});


let fsize_state = {
	changed : false,
	nwidth : 0,
	nheight : 0
};
const frameResize = new ResizeObserver((entries) => {
	const size = entries[0].contentBoxSize[0];
	fsize_state.nwidth = size.inlineSize;
	fsize_state.nheight = size.blockSize;
	fsize_state.changed = true;
});
frameResize.observe(frame);


var ltime;
function renderTick(timestamp) {
	const dt = timestamp - ltime;
	ltime = timestamp;
	let updated = false;
	if(key_states.move_enabled) {
		if(key_states.anyNotShift()) {
			updated = true;
			let speed = 5 / 1000;
			if(key_states.shift) { speed *= 5; }
			if(key_states.w) { vec3.scaleAndAdd(camPos, camPos, fDir, speed * dt); }
			if(key_states.a) { vec3.scaleAndAdd(camPos, camPos, rDir, -speed * dt); }
			if(key_states.s) { vec3.scaleAndAdd(camPos, camPos, fDir, -speed * dt); }
			if(key_states.d) { vec3.scaleAndAdd(camPos, camPos, rDir, speed * dt); }
			if(key_states.q) { vec3.scaleAndAdd(camPos, camPos, upDir, -speed * dt); }
			if(key_states.e) { vec3.scaleAndAdd(camPos, camPos, upDir, speed * dt); }
		}
		if(!vec2.equals(key_states.mouse_xy, key_states.mouse_xy2)) {
			updated = true;
			let dxy = vec2.sub(vec2.create(), key_states.mouse_xy2, key_states.mouse_xy);
			//console.log(dxy);
			vec2.scale(dxy, dxy, 0.002 * 0.8);
			vec3.cross(rDir, fDir, upDir);
			let rot = quat.multiply(
				quat.create(),
				quat.setAxisAngle(quat.create(), rDir, -dxy[1]),
				quat.setAxisAngle(quat.create(), upDir, -dxy[0])
			);
			vec3.transformQuat(fDir, fDir, rot);
			mat4.lookAt(view_mat, camPos, vec3.add(vec3.create(), camPos, fDir), upDir);
			mat4.invert(iview_mat, view_mat);
		}
		key_states.resetDxDy();
	}
	if(fsize_state.changed) {
		updated = true;
		canvas.width = width = fsize_state.nwidth;
		canvas.height = height = fsize_state.nheight;
		gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		mat4.perspective(proj_mat, 60 * Math.PI / 180, width / height, 0.1, 100.0);
		mat4.invert(iproj_mat, proj_mat);
		fsize_state.changed = false;
	}

	if(updated) {
		gl.uniformMatrix4fv(
			gl.getUniformLocation(program, "iview"),
			false, iview_mat
		);
		gl.uniformMatrix4fv(
			gl.getUniformLocation(program, "iproj"),
			false, iproj_mat
		);
		gl.uniform3fv(
			gl.getUniformLocation(program, "cam_pos"),
			camPos
		);
		gl.uniform2fv(
			gl.getUniformLocation(program, "fsize"),
			vec2.fromValues(width, height)
		);
		gl.uniform1f(
			gl.getUniformLocation(program, "realtime"),
			Date.now() - start_time
		);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	window.requestAnimationFrame(renderTick);
}
ltime = performance.now();
window.requestAnimationFrame(renderTick);