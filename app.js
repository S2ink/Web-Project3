const { vec2, vec3, vec4, quat, mat2, mat3, mat4 } = glMatrix;

const frame = document.querySelector("#frame");
const gl = frame.getContext("webgl2") || frame.getContext("webgl") || frame.getContext("experimental-webgl");
if(gl === null) {
	alert("Error: WebGL is unsupported.");
}
let width, height;
frame.width = width = 1280;
frame.height = height = 720;
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
gl.clearColor(0,0,0,1);
gl.clear(gl.COLOR_BUFFER_BIT);

let fDir = vec3.fromValues(0, 0, 1);
const upDir = vec3.fromValues(0,1,0);
let rDir = vec3.cross(vec3.create(), fDir, upDir);
let camPos = vec3.fromValues(0, 0, 0);

let view_mat = mat4.lookAt(mat4.create(), camPos, fDir, upDir);
const proj_mat = mat4.perspective(mat4.create(), 60 * Math.PI / 180, width / height, 0.1, 100.0);
let iview_mat = mat4.invert(mat4.create(), view_mat);
const iproj_mat = mat4.invert(mat4.create(), proj_mat);

var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
	1, 1,
	-1, 1,
	1, -1,
	-1, -1
]), gl.STATIC_DRAW);

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
out vec4 pixColor;
void main() {
	//vec3 ray = getSourceRay(vec2(gl_FragCoord) / vec2(1280.0, 720.0), iproj, iview);
	Ray src = Ray(cam_pos, vec3(0.0));
	vec3 clr;
	for(int i = 0; i < 10; i++) {
		float r = random(clr, float(i));
		src.direction = getSourceRay((vec2(gl_FragCoord) + vec2(r)) / vec2(1280.0, 720.0), iproj, iview);
		clr += evalRay(src, 5);
	}
	clr /= 10.0;
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

const vertex_shader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertex_shader, vertex_src);
gl.compileShader(vertex_shader);
if(!gl.getShaderParameter(vertex_shader, gl.COMPILE_STATUS)) {
	//alert(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(vertex_shader)}`);
	console.log(gl.getShaderInfoLog(vertex_shader));
	alert("Vertex shader compilation error: see console for details.");
}
const fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fragment_shader, fragment_src);
gl.compileShader(fragment_shader);
if(!gl.getShaderParameter(fragment_shader, gl.COMPILE_STATUS)) {
	// alert(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(fragment_shader)}`);
	console.log(gl.getShaderInfoLog(fragment_shader));
	alert("Fragment shader compilation error: see console for details.");
}

const program = gl.createProgram();
gl.attachShader(program, vertex_shader);
gl.attachShader(program, fragment_shader);
gl.linkProgram(program);
if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
	// alert(`Unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`);
	console.log(gl.getProgramInfoLog(program));
	alert("Unable to link program: see console for details.")
}
gl.useProgram(program);

const position_loc = gl.getAttribLocation(program, "vertex");
gl.vertexAttribPointer(position_loc, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(position_loc);

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

gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);


let mdown = false;
let mPos = vec2.create();
frame.addEventListener('mousedown', function(e){
	console.log('Mouse down');
	let rect = frame.getBoundingClientRect();
	mPos[0] = e.clientX - rect.left;
	mPos[1] = e.clientY - rect.top;
	mdown = true;
});
frame.addEventListener('mouseup', function(e){
	console.log('Mouse up');
	mdown = false;
});
document.addEventListener('keydown', function(e){
	if(mdown) {
		let speed = 5;
		// if(e.code === "Shift") {
		// 	speed *= 5;
		// }
		if(e.key == 'w') {
			vec3.add(camPos, camPos, vec3.scale(vec3.create(), fDir, speed / 75));
		}
		if(e.key == 's') {
			vec3.sub(camPos, camPos, vec3.scale(vec3.create(), fDir, speed / 75));
		}
		if(e.key == 'a') {
			vec3.sub(camPos, camPos, vec3.scale(vec3.create(), rDir, speed / 75));
		}
		if(e.key == 'd') {
			vec3.add(camPos, camPos, vec3.scale(vec3.create(), rDir, speed / 75));
		}
		if(e.key == 'q') {
			vec3.sub(camPos, camPos, vec3.scale(vec3.create(), upDir, speed / 75));
		}
		if(e.key == 'e') {
			vec3.add(camPos, camPos, vec3.scale(vec3.create(), upDir, speed / 75));
		}

		gl.uniform3fv(
			gl.getUniformLocation(program, "cam_pos"),
			camPos
		);
		mat4.lookAt(view_mat, camPos, vec3.add(vec3.create(), camPos, fDir), upDir);
		mat4.invert(iview_mat, view_mat);

		gl.uniformMatrix4fv(
			gl.getUniformLocation(program, "iview"),
			false, iview_mat
		);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
});
document.addEventListener('keyup', function(e){
	// reset speed if shift;
});
frame.addEventListener('mousemove', function(e){
	if(mdown) {
		let rect = frame.getBoundingClientRect();
		let x = (e.clientX - rect.left);
		let y = (e.clientY - rect.top);
		//console.log(x, y);
		let dx = (x - mPos[0]) * 0.002 * 0.8;
		let dy = (y - mPos[1]) * 0.002 * 0.8;
		vec2.set(mPos, x, y);
		if(dx != 0 || dy != 0) {
			//console.log(dx + ', ' + dy);
			vec3.cross(rDir, fDir, upDir);
			let rot = quat.multiply(
				quat.create(),
				quat.setAxisAngle(quat.create(), rDir, -dy),
				quat.setAxisAngle(quat.create(), upDir, -dx)
			);
			fDir = quaRotate(
				vec3.create(),
				quat.normalize(rot, rot),
				fDir
			);
			//console.log(fDir);
			mat4.lookAt(view_mat, camPos, vec3.add(vec3.create(), camPos, fDir), upDir);
			mat4.invert(iview_mat, view_mat);

			gl.uniformMatrix4fv(
				gl.getUniformLocation(program, "iview"),
				false, iview_mat
			);
			// gl.uniformMatrix4fv(
			// 	gl.getUniformLocation(program, "iproj"),
			// 	false, iproj_mat
			// );
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}
	}
});


function quaRotate(out, q, v) {
	let quatv = vec3.fromValues(q[0], q[1], q[2]);
	let uv = vec3.cross(vec3.create(), quatv, v);
	let uuv = vec3.cross(vec3.create(), quatv, uv);
	let ret = vec3.scale(vec3.create(), uv, q[3]);
	vec3.add(ret, ret, uuv);
	vec3.scale(ret, ret, 2);
	return vec3.add(out, ret, v);
}


// let element = document.getElementById("frame");
// let canvas = element.getContext('2d');
// let width = 640, height = 480;
// let scale = 4;
// let samples = 20;
// element.width = width;
// element.height = height;

// let scale_input = document.getElementById("scale");
// scale_input.setAttribute('value', scale);
// let samples_input = document.getElementById("samples");
// samples_input.setAttribute('value', samples);
// // let width_input = document.getElementById("width");
// // let height_input = document.getElementById("height");
// // let resize_button = document.getElementById("resize");
// // let render_action = document.getElementById("render");


// let camera = new Camera();
// camera.fov = 60;
// camera.pos = new Vec3(0,0,0);
// camera.fdir = new Vec3(0,0,1);
// camera.vwidth = width;
// camera.vheight = height;
// camera.recalcView();
// camera.recalcProj();
// let directions = camera.getRayDirections();
// directions;

// canvas.fillStyle = 'black';
// canvas.fillRect(0, 0, width, height);

// scene = new Scene(
// 	[
// 		new Sphere(new Vec3(0, -0.1, 3), 0.6, new PhysicalBase(0, 0, 1, 1.5), new StaticTexture(0.1, 0.7, 0.7)),
// 		new Sphere(new Vec3(0, 10, 4), 9.6, PhysicalBase.DEFAULT, new StaticTexture(0.7, 0.6, 0.8)),
// 		new Sphere(new Vec3(1, -1, 5), 1, PhysicalBase.DEFAULT, new StaticTexture(0.5, 0.2, 0.2), 7),
// 		new Sphere(new Vec3(-2, 0.3, 7), 3, PhysicalBase.DEFAULT, new StaticTexture(0.5, 0.7, 0.2)),
// 		new Sphere(new Vec3(-1.8, 0, 3), 0.7, new PhysicalBase(0), new StaticTexture(0.7, 0.5, 0.1))
// 	],
// 	new Vec3(0.05)
// );

// function evalRay(sce, ray, bounces) {
// 	let hit = new Hit();
// 	let obj = null;
// 	if(obj = sce.interacts(ray, hit)) {
// 		const lum = obj.emmission(hit);
// 		const clr = obj.albedo(hit);
// 		if(bounces == 0 || ((clr.x + clr.y + clr.z) / 3 * lum) >= 1) {
// 			return clr.scale(lum);
// 		}
// 		let redirect = new Ray();
// 		if(obj.redirect(ray, hit, redirect)) {
// 			return clr.iMul(evalRay(sce, redirect, bounces - 1).sadd(lum));
// 		}
// 	}
// 	return sce.albedo(hit);
// }

// function paint() {
// 	scale = parseInt(scale_input.value)
// 	samples = parseInt(samples_input.value);
// 	let ray = new Ray();
// 	ray.origin = camera.pos.clone();
// 	for(let y = 0; y < height / scale; y++) {
// 		for(let x = 0; x < width / scale; x++) {

// 			ray.direction = directions[x * scale + y * scale * width];	// the direction based on camera view
// 			let clr = new Vec3(0);
// 			for(let s = 0; s < samples; s++) {
// 				clr.add(evalRay(scene, ray, 5));
// 			}
// 			clr.scale(1 / samples).clamp(0, 1).sqrt();
// 			canvas.fillStyle = `rgb(${clr.x * 255},${clr.y * 255},${clr.z * 255})`;
// 			canvas.fillRect(x * scale, y * scale, scale, scale);
			
// 		}
// 	}
// }
// function camPaint(d) {
// 	camera.fdir = d.clone();
// 	camera.recalcView();
// 	camera.recalcProj();
// 	directions = camera.getRayDirections();
// 	paint();
// }
// // function improve() {
// // 	if(scale != 1) {
// // 		scale /= 2;
// // 	}
// // 	samples *= 10;
// // 	if(scale / 2 < 1 && samples > 100) {
// // 		return;
// // 	}
// // 	console.log("Beggining Render - Scale: " + scale + ", Samples: " + samples);
// // 	paint();
// // 	setTimeout(improve, 100);
// // }
// let start = Date.now();
// paint();
// let end = Date.now();
// console.log(end - start);

// //setTimeout(improve, 100);

// let mdown = false;
// let lastx = 0, lasty = 0;
// element.addEventListener('mousedown', function(e){
// 	let rect = element.getBoundingClientRect();
// 	lastx = e.clientX - rect.left;
// 	lasty = e.clientY - rect.top;
// 	mdown = true;
// });
// element.addEventListener('mouseup', function(){
// 	mdown = false;
// });
// element.addEventListener('mousemove', function(e){
// 	if(mdown) {
// 		let rect = element.getBoundingClientRect();
// 		let x = (e.clientX - rect.left) * 0.002 * 0.3;
// 		let y = (e.clientY - rect.top) * 0.002 * 0.3;
// 		let dx = x - lastx;
// 		let dy = y - lasty;
// 		lastx = x;
// 		lasty = y;
// 		if(dx != 0 || dy != 0) {
// 			console.log(dx + ', ' + dy);
// 		}
// 	}
// });