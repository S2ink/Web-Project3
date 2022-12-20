const { vec2, vec3, vec4, quat, mat2, mat3, mat4 } = glMatrix;

const frame = document.querySelector("#frame");
const gl = frame.getContext("webgl2") || frame.getContext("webgl") || frame.getContext("experimental-webgl");
if(gl === null) {
	alert("Error: WebGL is unsupported.");
}
let width, height;
frame.width = width = 640;
frame.height = height = 480;
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
gl.clearColor(0,0,0,1);
gl.clear(gl.COLOR_BUFFER_BIT);

let fDir = vec3.fromValues(1, 1, 1);
let camPos = vec3.fromValues(0, 0, 0);
const upDir = vec3.fromValues(0,1,0);
const view_mat = mat4.lookAt(mat4.create(), camPos, fDir, upDir);
const proj_mat = mat4.perspective(mat4.create(), 60 * Math.PI / 180, width / height, 0.1, 100.0);
const iview_mat = mat4.invert(mat4.create(), view_mat);
const iproj_mat = mat4.invert(mat4.create(), proj_mat);

var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
	1, 1,
	-1, 1,
	1, -1,
	-1, -1
]), gl.STATIC_DRAW);

const vertex_src = `
	attribute vec2 vertex;
	//uniform vec3 eye, ray00, ray01, ray10, ray11;
	//varying vec3 frag_ray;
	void main() {
		//vec2 proportion = vertex * 0.5 + 0.5;
		//frag_ray = mix(mix(ray00, ray01, proportion.y), mix(ray10, ray11, proportion.y), proportion.x);
		gl_Position = vec4(vertex, 0, 1);
	}
`;
const fragment_src = `
	#ifdef GL_FRAGMENT_PRECISION_HIGH
		precision highp float;
	#else
		precision mediump float;
	#endif

	//varying vec2 frag_ray;
	uniform mat4 iview, iproj;
	void main() {
		vec2 prop = vec2(gl_FragCoord) / vec2(640.0, 480.0);
		prop = prop * 2.0 - 1.0;
		vec4 target = iproj * vec4(prop, 1.0, 1.0);
		vec3 ray = vec3(iview * vec4(normalize(vec3(target) / target.w), 0));
		//float r = 1.0 - (gl_FragCoord.x * gl_FragCoord.y / (640.0 * 480.0));
		//gl_FragColor = vec4(r, gl_FragCoord.y / 480.0, gl_FragCoord.x / 640.0, 1);
		ray = ray / 2.0 + 0.5;
		gl_FragColor = vec4(ray.x, ray.y, ray.z, 1);
	}
`;

const vertex_shader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertex_shader, vertex_src);
gl.compileShader(vertex_shader);
if(!gl.getShaderParameter(vertex_shader, gl.COMPILE_STATUS)) {
	alert(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(vertex_shader)}`);
}
const fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fragment_shader, fragment_src);
gl.compileShader(fragment_shader);
if(!gl.getShaderParameter(fragment_shader, gl.COMPILE_STATUS)) {
	alert(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(fragment_shader)}`);
}

const program = gl.createProgram();
gl.attachShader(program, vertex_shader);
gl.attachShader(program, fragment_shader);
gl.linkProgram(program);
if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
	alert(`Unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`);
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
frame.addEventListener('mousemove', function(e){
	if(mdown) {
		let rect = frame.getBoundingClientRect();
		let x = (e.clientX - rect.left) * 0.002 * 0.3;
		let y = (e.clientY - rect.top) * 0.002 * 0.3;
		let dx = x - mPos[0];
		let dy = y - mPos[1];
		vec2.set(mPos, x, y);
		if(dx != 0 || dy != 0) {
			console.log(dx + ', ' + dy);
			let right = vec3.cross(vec3.create(), fDir, upDir);
			let q1 = quat.setAxisAngle(quat.create(), right, -dy);
			let q2 = quat.setAxisAngle(quat.create(), upDir, -dx);
			let rot = quat.fromValues(
				q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z,
				q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
				q1.w * q2.y + q1.y * q2.w + q1.z * q2.x - q1.x * q2.z,
				q1.w * q2.z + q1.z * q2.w + q1.x * q2.y - q1.y * q2.x
			);
			console.log(rot);
		}
	}
});


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