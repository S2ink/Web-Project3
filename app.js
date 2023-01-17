const start_time = performance.now();
const frame = document.getElementById("frame");		// the resizable div container
const canvas = document.getElementById("render");	// the canvas to render pixels on
const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
if(gl === null) {
	alert("Error: WebGL is unsupported.");
}
console.log("WebGL Version: " + gl.getParameter(gl.VERSION));

gl.getExtension('EXT_color_buffer_float');
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
gl.clearColor(0, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);

let width = canvas.width;	// used to default set to 640x480
let height = canvas.height;
let fov = 60;
const c_near = 0.1, c_far = 100;	// these don't do anything because we aren't using traditional rendering and don't have clip space
let bounces = 5;

const upDir = vec3.fromValues(0, 1, 0);
let fDir = vec3.fromValues(0, 0, 1);
let rDir = vec3.cross(vec3.create(), fDir, upDir);
let camPos = vec3.fromValues(0, 0, 0);

let view_mat = mat4.lookAt(mat4.create(), camPos, fDir, upDir);
let proj_mat = mat4.perspective(mat4.create(), fov * Math.PI / 180, width / height, c_near, c_far);
let iview_mat = mat4.invert(mat4.create(), view_mat);
let iproj_mat = mat4.invert(mat4.create(), proj_mat);

gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());	// go back to creating var for buffer if this inlining causes problems
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.bindBuffer(gl.ARRAY_BUFFER, null);

const gl_render = buildProgram(gl, fb_vertex_src, fb_fragment_src);
const gl_trace = buildProgram(gl, vertex_src, fragment_src);
gl.useProgram(gl_trace);



const uni_iview = gl.getUniformLocation(gl_trace, "iview");
const uni_iproj = gl.getUniformLocation(gl_trace, "iproj");
const uni_cam_pos = gl.getUniformLocation(gl_trace, "cam_pos");
const uni_fsize = gl.getUniformLocation(gl_trace, "fsize");
const uni_realtime = gl.getUniformLocation(gl_trace, "realtime");
const uni_samples = gl.getUniformLocation(gl_trace, "samples");
const uni_bounces = gl.getUniformLocation(gl_trace, "bounces");
const uni_simple = gl.getUniformLocation(gl_trace, "simple");
const uni_sky_color = gl.getUniformLocation(gl_trace, "skycolor");
const uni_total_samples = gl.getUniformLocation(gl_render, "total_samples");



let scene = new Scene(gl, 1, gl_trace);
scene.addSpheres(
	new Sphere(Vec3(2.1, 0.1, 2.5), 0.8, Srf(2.0, Vec3(0.5, 0.2, 0.2), Mat(1.0, 0.0, 1.0, 1.4))),
	new Sphere(Vec3(0, 0.0, 2.5), 0.5, Srf(0.0, Vec3(1,1,1), Mat(0.0, 0.0, 1.0, 1.7))),
	new Sphere(Vec3(0, -10, 4), 9.6, Srf(0.0, Vec3(0.7, 0.6, 0.8), Mat(1.0, 0.5, 0.0, 0.0))),
	new Sphere(Vec3(0.5, 1.8, 4.5), 0.7, Srf(2.0, Vec3(0.1, 0.7, 0.7), Mat(1.0, 0.0, 0.0, 0.0))),
	new Sphere(Vec3(-2, -0.3, 7), 3.0, Srf(0.0, Vec3(0.5, 0.7, 0.2), Mat(1.0, 0.1, 0.0, 0.0))),
	new Sphere(Vec3(-2, 0, 3), 0.7, Srf(0.0, Vec3(0.7, 0.5, 0.1), Mat(0.0, 0.0, 0.0, 0.0))),
	new Sphere(Vec3(0, 0, 4), 0.5, Srf(0.0, Vec3(0, 0.5, 0.5), Mat(1.0, 0.0, 1.0, 1.5))),
	new Sphere(Vec3(2, 0, 5), 1.6, Srf(0.0, Vec3(0.2, 0.7, 0.3), Mat(0.0, 0.0, 0.0, 0.0))),
	new Sphere(Vec3(-2, 3, 4), 0.3, Srf(50.0, Vec3(1, 1, 1), Mat(1.0, 0.0, 0.0, 0.0)))
);
scene.addTriangles(
	Cube.fromPoints(
		Vec3(-2, 2.5, 4),
		Vec3(-2, 2.5, 3),
		Vec3(-1, 2.5, 3),
		Vec3(-1, 2.5, 4),
		Vec3(-1, 1.5, 4),
		Vec3(-1, 1.5, 3),
		Vec3(-2, 1.5, 3),
		Vec3(-2, 1.5, 4),
		Srf(0, Vec3(0.9, 0.8, 0.3), Mat(0, 0, 1, 1.4))
	).primitives
);
scene.update(gl);

console.log(scene);
listActiveUniforms(gl, gl_trace);


const ui = {
	elem_fsize_selector : document.getElementById("fixed-fsize-select"),
	elem_fsize_display : document.getElementById("fsize-display"),
	elem_downscale : document.getElementById("downscale"),
	elem_cam_fov : document.getElementById("cam-fov"),
	// elem_cam_nearclip : document.getElementById("cam-nearclip"),
	// elem_cam_farclip : document.getElementById("cam-farclip"),
	elem_samples_ppx : document.getElementById("samples-ppx"),
	elem_samples_display : document.getElementById("total-samples-display"),
	elem_samples_limit : document.getElementById("samples-limit"),
	elem_bounce_limit : document.getElementById("bounce-limit"),
	elem_sky_color : document.getElementById("sky-color"),
	elem_fps_display: document.getElementById("fps-display"),
	// elem_reset_sky : document.getElementById("reset-sky-color"),

	keys : {
		w : false,
		a : false,
		s : false,
		d : false,
		q : false,
		e : false,
		shift : false,
		ctrl : false,
	},
	mouse_xy : vec2.create(),
	mouse_xy2 : vec2.create(),
	enable_camera : false,

	fsize : {
		changed : false,
		fixed : false,
		fullscreen : false,
		_width : width,		// these are both a cache for fullscreen and a buffer for resize events
		_height : height,
		scale : 1
	},
	resize_listener : null,

	scene : {
		updated : false,
		simple_render : false,
		skycolor : vec3.fromValues(0.05, 0.05, 0.05)
	}

};

ui.downscaling = function() { return parseFloat(this.elem_downscale.value); }
ui.updateFov = function() { return fov != (fov = parseFloat(this.elem_cam_fov.value)); }
// ui.updateNearClip = function() { return c_near != (c_near = parseFloat(this.elem_cam_nearclip.value)); }
// ui.updateFarClip = function() { return c_far != (c_far = parseFloat(this.elem_cam_farclip.value)); }
ui.sampleRate = function() { return parseInt(this.elem_samples_ppx.value); }
ui.sampleLimit = function() { return parseInt(this.elem_samples_limit.value); }
ui.updateBounceLimit = function() { return bounces != (bounces = parseInt(this.elem_bounce_limit.value)); }

ui.keys.reset = function() {
	this.w = this.a = this.s = this.d = this.q = this.e = this.shift = this.ctrl = false;
}
ui.keys.anyRaw = function() {
	return this.w || this.a || this.s || this.d || this.q || this.e;
}
ui.keys.anyAlts = function() {
	return this.shift || this.ctrl;
}

ui.zeroMouse = function() {
	vec2.copy(this.mouse_xy, this.mouse_xy2);
}
ui.onMouseDown = function(e) {
	if(ui.keys.ctrl) {
		let rect = canvas.getBoundingClientRect();
		let ray = new Ray();
		let prop = vec2.fromValues(
			(e.clientX - rect.left) / width,
			1 - ((e.clientY - rect.top) / height));
		ray.origin = camPos;
		ray.direction = calcRayDirection(
			prop, iproj_mat, iview_mat);
		let sel = scene.trySelect(ray);
		console.log(`Selected ${sel.type} [${sel.idx}]`);
	} else {
		ui.enable_camera = true;
		vec2.copy(ui.mouse_xy2, vec2.set(
			ui.mouse_xy, e.clientX, e.clientY) );
	}
}
ui.onMouseMove = function(e) {
	if(ui.enable_camera) {
		vec2.set(
			ui.mouse_xy2, e.clientX, e.clientY);
	}
}
ui.onMouseUp = function(e) {
	if(ui.enable_camera) {
		ui.enable_camera = false;
		ui.keys.reset();
	}
}
ui.onKeyDown = function(e) {	// add this and all other to .prototype if this object is every reused
	ui.keys.ctrl |= (e.key == 'Control');
	if(ui.enable_camera) {
		const k = e.key;
		ui.keys.w |= (k == 'w' || k == 'W');
		ui.keys.a |= (k == 'a' || k == 'A');
		ui.keys.s |= (k == 's' || k == 'S');
		ui.keys.d |= (k == 'd' || k == 'D');
		ui.keys.q |= (k == 'q' || k == 'Q');
		ui.keys.e |= (k == 'e' || k == 'E');
		ui.keys.shift |= (k == 'Shift');
		return false;
	}
	return true;
}
ui.onKeyUp = function(e) {
	ui.keys.ctrl &= (e.key != 'Control');
	if(ui.enable_camera) {
		const k = e.key;
		ui.keys.w &= (k != 'w' && k != 'W');
		ui.keys.a &= (k != 'a' && k != 'A');
		ui.keys.s &= (k != 's' && k != 'S');
		ui.keys.d &= (k != 'd' && k != 'D');
		ui.keys.q &= (k != 'q' && k != 'Q');
		ui.keys.e &= (k != 'e' && k != 'E');
		ui.keys.shift &= (k != 'Shift');
		return false;
	}
	return true;
}
ui.onResize = function(e) {		// e is for entries in this one
	const size = e[0].contentBoxSize[0];
	const x = size.inlineSize, y = size.blockSize;
	if((x && x != width) || (y && y != height)) {
		ui.fsize._width = x;
		ui.fsize._height = y;
		ui.fsize.changed = true;
		ui.fsize.fixed = false;
	}
}
ui.onResSelect = function(e) {
	const xy = e.target.value.split('_');
	const x = parseInt(xy[0]);
	const y = parseInt(xy[1]);
	if((x && x != width) || (y && y != height)) {
		ui.fsize._width = x;
		ui.fsize._height = y;
		ui.fsize.changed = true;
		ui.fsize.fixed = true;
	}
}
ui.onScaling = function(e) {
	let v = ui.downscaling();
	if(v > 0) {
		ui.fsize.scale = v;
		ui.fsize.changed = true;
	}
}
ui.onFullScreen = function(e) {
	ui.fsize.fullscreen = !!document.fullscreenElement;
	ui.fsize.changed = true;
}
ui.scene.onSkyChange = function(e) {
	let hex = e.target.value;
	let r = parseInt(hex[1] + hex[2], 16);
	let g = parseInt(hex[3] + hex[4], 16);
	let b = parseInt(hex[5] + hex[6], 16);
	vec3.set(ui.scene.skycolor, r / 255, g / 255, b / 255);
	ui.scene.updated = true;
}
ui.scene.onRenderChange = function(val) {
	this.simple_render = val;
	this.updated = true;
}

canvas.addEventListener('mousedown', ui.onMouseDown);
document.body.addEventListener('mousemove', ui.onMouseMove);
document.body.addEventListener('mouseup', ui.onMouseUp);
document.body.addEventListener('keydown', ui.onKeyDown);
document.body.addEventListener('keyup', ui.onKeyUp);
document.addEventListener('fullscreenchange', ui.onFullScreen);
ui.elem_fsize_selector.addEventListener('change', ui.onResSelect);
ui.elem_downscale.addEventListener('input', ui.onScaling);
(ui.resize_listener = new ResizeObserver(ui.onResize)).observe(frame);
ui.elem_sky_color.addEventListener('input', ui.scene.onSkyChange);



function genTextureRGBA32F(gl, w, h) {
	let t = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, t);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);	// <-- textbuff_type (can always use float in webgl2)
	gl.bindTexture(gl.TEXTURE_2D, null);
	return t;
}

const accumulater = {
	framebuff : gl.createFramebuffer(),
	textures : [
		genTextureRGBA32F(gl, width, height),
		genTextureRGBA32F(gl, width, height)
	],
	samples : 0,
	mixWeight(sppx) { return this.samples / (this.samples + sppx); },
	resetSamples() { this.samples = 0; },
	regenTextures(w, h) {
		gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
		gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
		gl.bindTexture(gl.TEXTURE_2D, null);
		this.resetSamples();
	},
	renderToTexture(trace_program, sppx) {
		gl.useProgram(trace_program);
		gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuff);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[1], 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		this.textures.reverse();
		this.samples += sppx;
	},
	renderTextureToFrame(render_program) {
		gl.useProgram(render_program);
		gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
};

var ltime;
function renderTick(timestamp) {
	const dt = timestamp - ltime;
	ltime = timestamp;

	let needs_reproject = ui.updateFov();
	let updated = needs_reproject || ui.updateBounceLimit();
	gl.useProgram(gl_trace);
	if(ui.enable_camera) {
		if(ui.keys.anyRaw()) {
			updated = true;
			let speed = 5 / 1000;
			if(ui.keys.shift) { speed *= 5; }
			if(ui.keys.w) { vec3.scaleAndAdd(camPos, camPos, fDir, speed * dt); }
			if(ui.keys.a) { vec3.scaleAndAdd(camPos, camPos, rDir, -speed * dt); }
			if(ui.keys.s) { vec3.scaleAndAdd(camPos, camPos, fDir, -speed * dt); }
			if(ui.keys.d) { vec3.scaleAndAdd(camPos, camPos, rDir, speed * dt); }
			if(ui.keys.q) { vec3.scaleAndAdd(camPos, camPos, upDir, -speed * dt); }
			if(ui.keys.e) { vec3.scaleAndAdd(camPos, camPos, upDir, speed * dt); }
		}
		if(!vec2.equals(ui.mouse_xy, ui.mouse_xy2)) {
			updated = true;
			let dxy = vec2.sub(vec2.create(), ui.mouse_xy2, ui.mouse_xy);
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
			ui.zeroMouse();
		}
	}
	if(ui.fsize.changed) {
		updated = true;
		if(ui.fsize.fullscreen) {
			ui.fsize._width = width;		// cache old size
			ui.fsize._height = height;
			canvas.style.width = width = window.screen.width;
			canvas.style.height = height = window.screen.height;
			canvas.width = width / ui.fsize.scale;
			canvas.height = height / ui.fsize.scale;
		} else {
			canvas.style.width = (width = ui.fsize._width) + 'px';
			canvas.style.height = (height = ui.fsize._height) + 'px';
			canvas.width = width / ui.fsize.scale;
			canvas.height = height / ui.fsize.scale;
			if(ui.fsize.fixed) {
				frame.style.width = width;
				frame.style.height = height;
			} else {
				frame.style.width = 'fit-content';
				frame.style.height = 'fit-content';
				ui.elem_fsize_selector.value = "Custom";
			}
		}
		ui.elem_fsize_display.innerHTML = width + 'x' + height;
		gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		mat4.perspective(proj_mat, fov * Math.PI / 180, width / height, c_near, c_far);
		mat4.invert(iproj_mat, proj_mat);
		ui.fsize.changed = false;
	} else if(needs_reproject) {
		mat4.perspective(proj_mat, fov * Math.PI / 180, width / height, c_near, c_far);
		mat4.invert(iproj_mat, proj_mat);
	}
	if(ui.scene.updated) {
		updated = true;
		ui.scene.updated = false;
		gl.uniform3fv(uni_sky_color, ui.scene.skycolor);
	}

	let sppx = ui.sampleRate();
	if(updated) {
		gl.uniformMatrix4fv(uni_iview, false, iview_mat);
		gl.uniformMatrix4fv(uni_iproj, false, iproj_mat);
		gl.uniform3fv(uni_cam_pos, camPos);
		gl.uniform2f(uni_fsize, width / ui.fsize.scale, height / ui.fsize.scale);
		gl.uniform1i(uni_bounces, bounces);
		gl.uniform1i(uni_simple, ui.scene.simple_render * 1);
		accumulater.regenTextures(width / ui.fsize.scale, height / ui.fsize.scale);
		accumulater.resetSamples();
	}
	if(accumulater.samples < ui.sampleLimit()) {
		gl.uniform1f(uni_realtime, performance.now() - start_time);
		gl.uniform1i(uni_samples, sppx);
		accumulater.renderToTexture(gl_trace, sppx);
		gl.useProgram(gl_render);
		gl.uniform1f(uni_total_samples, accumulater.samples);
		accumulater.renderTextureToFrame(gl_render);
	}
	ui.elem_samples_display.innerHTML = accumulater.samples;
	let fps = 1000 / dt;
	ui.elem_fps_display.innerHTML = fps.toFixed(2) + " fps";

	window.requestAnimationFrame(renderTick);
}
ui.fsize.changed = true;	// manually trigger update on first frame
ui.scene.updated = true;
ltime = performance.now();
window.requestAnimationFrame(renderTick);