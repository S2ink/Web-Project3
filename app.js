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

const gl_render = buildProgram(gl, fb_vertex_src, fb_fragment_src);
const gl_trace = buildProgram(gl, vertex_src, fragment_src);
gl.useProgram(gl_trace);

gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());	// go back to creating var for buffer if this inlining causes problems
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.bindBuffer(gl.ARRAY_BUFFER, null);


const Uniforms = {
	iview :				gl.getUniformLocation(gl_trace, "iview"),
	iproj :				gl.getUniformLocation(gl_trace, "iproj"),
	cam_pos :			gl.getUniformLocation(gl_trace, "cam_pos"),
	cam_vdir :			gl.getUniformLocation(gl_trace, "cam_vdir"),
	cam_rdir :			gl.getUniformLocation(gl_trace, "cam_rdir"),
	fsize :				gl.getUniformLocation(gl_trace, "fsize"),
	focus_dist :		gl.getUniformLocation(gl_trace, "focus_distance"),
	aperture :			gl.getUniformLocation(gl_trace, "aperture"),
	realtime :			gl.getUniformLocation(gl_trace, "realtime"),
	samples :			gl.getUniformLocation(gl_trace, "samples"),
	bounces :			gl.getUniformLocation(gl_trace, "bounces"),
	simple :			gl.getUniformLocation(gl_trace, "simple"),
	sky_color :			gl.getUniformLocation(gl_trace, "skycolor"),

	total_samples :		gl.getUniformLocation(gl_render, "total_samples"),
};
const Elements = {
	div_overlay :			document.getElementById("overlay"),
	div_render_opts :		document.getElementById("render-options"),
	div_scene_opts :		document.getElementById("scene-options"),

	display_fps :			document.getElementById("fps-display"),
	display_samples :		document.getElementById("total-samples-display"),
	display_fsize :			document.getElementById("fsize-display"),
	display_selected :		document.getElementById("selected-object-display"),

	select_fsize :			document.getElementById("fixed-fsize-select"),
	button_fullscreen :		document.getElementById("fullscreen-button"),
	input_downscale :		document.getElementById("downscale-input"),
	range_cam_fov :			document.getElementById("cam-fov-range"),
	input_cam_fov :			document.getElementById("cam-fov-input"),
	range_cam_aperture :	document.getElementById("cam-aperture-range"),
	input_cam_aperture :	document.getElementById("cam-aperture-input"),
	range_cam_focus_dist :	document.getElementById("cam-focus-dist-range"),
	input_cam_focus_dist :	document.getElementById("cam-focus-dist-input"),
	input_frame_samples :	document.getElementById("frame-samples-input"),
	input_samples_limit :	document.getElementById("samples-limit-input"),
	input_bounce_limit :	document.getElementById("bounce-limit-input"),
	input_sky_color :		document.getElementById("sky-color-input"),
	toggle_simple_render :	document.getElementById("render-simple-toggle"),
	toggle_overlay :		document.getElementById("enable-overlay-toggle")
};

const State = {	// all application state variables
	frame : {
		updated : false,
		fixed : false,
		fullscreen : false,
		listener : null,

		width : canvas.width,
		height : canvas.height,
		downscale : 1,

		_new : { width: 0, height: 0 },
		_cache : { width: 0, height: 0 },

		get ratio() { return this.width / this.height; },
		get scaledWidth() { return this.width / this.downscale; },
		get scaledHeight() { return this.height / this.downscale; }
	},
	camera : {
		updated: false,
		updated_fov : false,

		fov : 60,
		aperture : 0.1,
		focus_dist : 3,
		nearclip : 0,
		farclip : 100,

		updir : vec3.fromValues(0, 1, 0),
		fdir : vec3.fromValues(0, 0, 1),
		rdir : vec3.fromValues(1, 0, 0),
		vdir : vec3.fromValues(0, 1, 0),
		pos : vec3.fromValues(0, 0, 0),

		view_mat : null,
		proj_mat : null,
		iview_mat : null,
		iproj_mat : null
	},
	render : {
		updated : false,

		bounces : 5,
		sample_rate : 1,
		sample_limit : 1e4,
		simple : false
	},
	input : {
		updated : false,
		enabled : false,

		mouse_xy : vec2.create(),
		mouse_xy2 : vec2.create(),
		keys : {
			w : false,
			a : false,
			s : false,
			d : false,
			q : false,
			e : false,
			shift : false,
			ctrl : false,
		}
	},
	scene : {
		updated : false
	},

	get w() { return this.frame.width; },
	get h() { return this.frame.height; }
};
State.camera.view_mat = mat4.lookAt(mat4.create(), State.camera.pos, State.camera.fdir, State.camera.updir);
State.camera.proj_mat = mat4.perspective(mat4.create(), State.camera.fov * Math.PI / 180, State.frame.ratio, State.camera.nearclip, State.camera.farclip);
State.camera.iview_mat = mat4.invert(mat4.create(), State.camera.view_mat);
State.camera.iproj_mat = mat4.invert(mat4.create(), State.camera.proj_mat);
console.log(State.camera);

const scene = new Scene(gl, 1, gl_trace);
scene.setSky(0.05, 0.05, 0.05);
scene.addSpheres(
	new Sphere(Vec3(2.1, 0.1, 2.5), 0.8, Srf(2.0, Vec3(0.5, 0.2, 0.2), Mat(1.0, 0.0, 1.0, 1.4))),
	new Sphere(Vec3(0, 0.0, 2.5), 0.5, Srf(0.0, Vec3(1,1,1), Mat(0.0, 0.0, 1.0, 1.7))),
	new Sphere(Vec3(0, -10, 4), 9.6, Srf(0.0, Vec3(0.7, 0.6, 0.8), Mat(0.9, 0.0, 0.0, 0.0))),
	new Sphere(Vec3(0.5, 1.8, 4.5), 0.7, Srf(2.0, Vec3(0.1, 0.7, 0.7), Mat(1.0, 0.0, 0.0, 0.0))),
	new Sphere(Vec3(-2, -0.3, 7), 3.0, Srf(0.0, Vec3(0.5, 0.7, 0.2), Mat(0.9, 0.1, 0.0, 0.0))),
	new Sphere(Vec3(-2, 0, 3), 0.7, Srf(0.0, Vec3(1.0, 0.1, 0.1), Mat(0.7, 0.0, 0.0, 0.0))),
	new Sphere(Vec3(0, 0, 4), 0.5, Srf(0.0, Vec3(0, 0.5, 0.5), Mat(0.9, 0.0, 0.0, 1.5))),
	new Sphere(Vec3(2, 0, 5), 1.6, Srf(0.0, Vec3(0.2, 0.7, 0.3), Mat(0.1, 0.0, 1.0, 1.4))),
	new Sphere(Vec3(-6, 2, 3), 0.3, Srf(200.0, Vec3(1, 1, 1), Mat(1.0, 0.0, 0.0, 0.0)))
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

const Renderer = {
	samplecount : 0,
	framebuff : gl.createFramebuffer(),
	textures : [
		genTextureRGBA32F(gl, State.w, State.h),
		genTextureRGBA32F(gl, State.w, State.h)
	],

	regenTextures(w, h) {
		gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
		gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
		gl.bindTexture(gl.TEXTURE_2D, null);
		this.samplecount = 0;
	},
	renderToTexture(tracer, sample_rate) {
		gl.useProgram(tracer);
		gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuff);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[1], 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		this.textures.reverse();
		this.samplecount += sample_rate;
	},
	renderFromTextureBuff(renderer) {
		gl.useProgram(renderer);
		gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	},

	renderAccFrame(tracer, renderer, sample_rate) {
		this.renderToTexture(tracer, sample_rate);
		this.renderFromTextureBuff(renderer);
	}
};


(State.frame.listener = new ResizeObserver(							handleDragResize)).observe(frame);
canvas.addEventListener(						'mousedown',		handleCanvasClick);
canvas.addEventListener(						'touchstart',		handleCanvasTouch);
canvas.addEventListener(						'touchmove',		handleTouchDrag);
document.addEventListener(						'fullscreenchange',	handleFullscreen);
document.body.addEventListener(					'mousemove',		handleMouseDrag);
document.body.addEventListener(					'mouseup',			handleDragRelease);
document.body.addEventListener(					'touchend',			handleDragRelease);
document.body.addEventListener(					'keydown',			handleKeyDown);
document.body.addEventListener(					'keyup',			handleKeyUp);
Elements.select_fsize.addEventListener(			'change',			handleResolutionSelect);
Elements.button_fullscreen.addEventListener(	'click',			handleFullscreenButton);
Elements.input_downscale.addEventListener(		'input',			handleDownscaleInput);
Elements.range_cam_fov.addEventListener(		'input',			handleFovRange);
Elements.input_cam_fov.addEventListener(		'input',			handleFovInput);
Elements.range_cam_aperture.addEventListener(	'input',			handleApertureRange);
Elements.input_cam_aperture.addEventListener(	'input',			handleApertureInput);
Elements.range_cam_focus_dist.addEventListener(	'input',			handleFocusDistRange);
Elements.input_cam_focus_dist.addEventListener(	'input',			handleFocusDistInput);
Elements.input_frame_samples.addEventListener(	'input',			handleSampleRateInput);
Elements.input_samples_limit.addEventListener(	'input',			handleSampleLimitInput);
Elements.input_bounce_limit.addEventListener(	'input',			handleBounceLimitInput);
Elements.input_sky_color.addEventListener(		'input',			handleSkyColorInput);
Elements.toggle_simple_render.addEventListener(	'input',			handleSimpleRenderToggle);
Elements.toggle_overlay.addEventListener(		'input',			handleOverlayToggle);


function handleCanvasClick(e) {
	const input = State.input;
	if(input.keys.ctrl) {

	} else {
		input.enabled = true;
		vec2.copy(input.mouse_xy2,
			vec2.set(input.mouse_xy, e.clientX, e.clientY)
		);
	}
}
function handleMouseDrag(e) {
	const input = State.input;
	if(input.enabled) {
		vec2.set(input.mouse_xy2, e.clentX, e.clientY);
	}
}
function handleCanvasTouch(e) {
	const input = State.input;
	input.enabled = true;
	vec2.copy(input.mouse_xy2,
		vec2.set(input.mouse_xy,
			e.changedTouches[0].clientX,
			e.changedTouches[0].clientY
		)
	);
}
function handleTouchDrag(e) {
	const input = State.input;
	if(input.enabled) {
		vec2.set(input.mouse_xy,
			e.changedTouches[0].clientX,
			e.changedTouches[0].clientY);
	}
}
function handleDragRelease(e) {
	const input = State.input;
	if(input.enabled) {
		input.enabled = false;
		const k = input.keys;
		k.w = k.a = k.s = k.d = k.q = k.e = k.shift = k.ctrl = false;
	}
}
function handleKeyDown(e) {
	const keys = State.input.keys;
	const k = e.key;
	keys.ctrl |= (k == 'Control');
	if(State.input.enabled) {
		keys.w |= (k == 'w' || k == 'W');
		keys.a |= (k == 'a' || k == 'A');
		keys.s |= (k == 's' || k == 'S');
		keys.d |= (k == 'd' || k == 'D');
		keys.q |= (k == 'q' || k == 'Q');
		keys.e |= (k == 'e' || k == 'E');
		keys.shift |= (k == 'Shift');
		return false;
	}
	return true;
}
function handleKeyUp(e) {
	const keys = State.input.keys;
	const k = e.key;
	keys.ctrl &= (k != 'Control');
	if(State.input.enabled) {
		keys.w &= (k != 'w' && k != 'W');
		keys.a &= (k != 'a' && k != 'A');
		keys.s &= (k != 's' && k != 'S');
		keys.d &= (k != 'd' && k != 'D');
		keys.q &= (k != 'q' && k != 'Q');
		keys.e &= (k != 'e' && k != 'E');
		keys.shift &= (k != 'Shift');
		return false;
	}
	return true;
}

function handleDragResize(e) {
	const size = e[0].contentBoxSize[0];
	const x = size.inlinSize, y = size.blockSize;
	if((x && x != State.w) || (y && y != State.h)) {
		const f = State.frame;
		f._new.width = x;
		f._new.height = y;
		f.updated = true;
		f.fixed = false;
	}
}
function handleResolutionSelect(e) {
	const xy = e.target.value.split('_');
	const x = parseInt(xy[0]), y = parseInt(xy[1]);
	if((x && x != State.w) || (y && y != State.h)) {
		const f = State.frame;
		f._new.width = x;
		f._new.height = y;
		f.updated = true;
		f.fixed = true;
	}
}
function handleFullscreenButton(e) {
	frame.requestFullscreen();
}
function handleFullscreen(e) {
	State.frame.fullscreen = !!document.fullscreenElement;
	State.frame.updated = true;
}
function handleDownscaleInput(e) {
	const v = parseFloat(e.target.value);
	if(v > 0) {
		State.frame.downscale = v;
		State.frame.updated = true;
	}
}
function handleFovRange(e) {
	const val = e.target.value;
	const v = parseFloat(val);
	if(v > 0) {
		Elements.input_cam_fov.value = val;
		State.camera.fov = v;
		State.camera.updated = true;
		State.camera.updated_fov = true;
	}
}
function handleFovInput(e) {
	const val = e.target.value;
	const v = parseFloat(val);
	if(v > 0) {
		Elements.range_cam_fov.value = val;
		State.camera.fov = v;
		State.camera.updated = true;
		State.camera.updated_fov = true;
	}
}
function handleApertureRange(e) {
	const val = e.target.value;
	const v = parseFloat(val);
	if(v > 0) {
		Elements.input_cam_aperture.value = val;
		State.camera.aperture = v;
		State.camera.updated = true;
	}
}
function handleApertureInput(e) {
	const val = e.target.value;
	const v = parseFloat(val);
	if(v > 0) {
		Elements.range_cam_aperture.value = val;
		State.camera.aperture = v;
		State.camera.updated = true;
	}
}
function handleFocusDistRange(e) {
	const val = e.target.value;
	const v = parseFloat(val);
	if(v > 0) {
		Elements.input_cam_focus_dist.value = val;
		State.camera.focus_dist = v;
		State.camera.updated = true;
	}
}
function handleFocusDistInput(e) {
	const val = e.target.value;
	const v = parseFloat(val);
	if(v > 0) {
		Elements.range_cam_focus_dist.value = val;
		State.camera.focus_dist = v;
		State.camera.updated = true;
	}
}
function handleSampleRateInput(e) {
	const v = parseInt(e.target.value);
	if(v > 0) {
		State.render.sample_rate = v;
		// State.render.updated = true;
	}
}
function handleSampleLimitInput(e) {
	const v = parseInt(e.target.value);
	if(v >= 0) {
		State.render.sample_limit = v;
	}
}
function handleBounceLimitInput(e) {
	const v = parseInt(e.target.value);
	if(v >= 0) {
		State.render.bounces = v;
		State.render.updated = true;
	}
}
function handleSkyColorInput(e) {
	const hex = e.target.value;
	scene.setSky(
		parseInt(hex[1] + hex[2], 16) / 255,
		parseInt(hex[3] + hex[4], 16) / 255,
		parseInt(hex[5] + hex[6], 16) / 255
	);
	State.scene.updated = true;
}
function handleSimpleRenderToggle(e) {
	State.render.simple = e.target.checked;
	State.render.updated = true;
}
function handleOverlayToggle(e) {
	if(e.target.checked) {
		Elements.div_overlay.style.display = 'block';
	} else {
		Elements.div_overlay.style.display = 'none';
	}
}



// const ui = {
// 	elem_overlay_div : document.getElementById("overlay"),
// 	elem_scene_options_div : document.getElementById("scene-options"),

// 	elem_fsize_selector : document.getElementById("fixed-fsize-select"),
// 	elem_fsize_display : document.getElementById("fsize-display"),
// 	elem_downscale : document.getElementById("downscale"),
// 	elem_cam_fov : document.getElementById("cam-fov"),
// 	elem_cam_fov2 : document.getElementById("cam-fov2"),
// 	elem_cam_aperature : document.getElementById("cam-aperature"),
// 	elem_cam_focus_dist : document.getElementById("cam-focus-dist"),
// 	elem_samples_ppx : document.getElementById("samples-ppx"),
// 	elem_samples_display : document.getElementById("total-samples-display"),
// 	elem_samples_limit : document.getElementById("samples-limit"),
// 	elem_bounce_limit : document.getElementById("bounce-limit"),
// 	elem_sky_color : document.getElementById("sky-color"),
// 	elem_fps_display: document.getElementById("fps-display"),
// 	elem_selected_display: document.getElementById("selected-object-display"),

// 	keys : {
// 		w : false,
// 		a : false,
// 		s : false,
// 		d : false,
// 		q : false,
// 		e : false,
// 		shift : false,
// 		ctrl : false,
// 	},
// 	mouse_xy : vec2.create(),
// 	mouse_xy2 : vec2.create(),
// 	enable_camera : false,

// 	fsize : {
// 		changed : false,
// 		fixed : false,
// 		fullscreen : false,
// 		_width : width,		// these are both a cache for fullscreen and a buffer for resize events
// 		_height : height,
// 		scale : 1
// 	},
// 	resize_listener : null,

// 	scene : {
// 		updated : false,
// 		simple_render : false,
// 		skycolor : vec3.fromValues(0.05, 0.05, 0.05)
// 	}

// };

// ui.downscaling = function() { return parseFloat(this.elem_downscale.value); }
// ui.updateFov = function() { return fov != (fov = parseFloat(this.elem_cam_fov.value)); }
// ui.aperature = function() { return parseFloat(this.elem_cam_aperature.value); }
// ui.focusDist = function() { return parseFloat(this.elem_cam_focus_dist.value); }
// ui.sampleRate = function() { return parseInt(this.elem_samples_ppx.value); }
// ui.sampleLimit = function() { return parseInt(this.elem_samples_limit.value); }
// ui.updateBounceLimit = function() { return bounces != (bounces = parseInt(this.elem_bounce_limit.value)); }

// ui.keys.reset = function() {
// 	this.w = this.a = this.s = this.d = this.q = this.e = this.shift = this.ctrl = false;
// }
// ui.keys.anyRaw = function() {
// 	return this.w || this.a || this.s || this.d || this.q || this.e;
// }
// ui.keys.anyAlts = function() {
// 	return this.shift || this.ctrl;
// }

// ui.zeroMouse = function() {
// 	vec2.copy(this.mouse_xy, this.mouse_xy2);
// }
// ui.onMouseDown = function(e) {
// 	if(ui.keys.ctrl) {
// 		let rect = canvas.getBoundingClientRect();
// 		let ray = new Ray();
// 		let prop = vec2.fromValues(
// 			(e.clientX - rect.left) / width,
// 			1 - ((e.clientY - rect.top) / height));
// 		ray.origin = camPos;
// 		ray.direction = calcRayDirection(
// 			prop, iproj_mat, iview_mat);
// 		let sel = scene.trySelect(ray);
// 		ui.elem_selected_display.innerHTML = `Selected: ${sel.type} ${sel.idx}`;
// 		ui.elem_scene_options_div.style.display = "inline-block";
// 	} else {
// 		ui.enable_camera = true;
// 		vec2.copy(ui.mouse_xy2, vec2.set(
// 			ui.mouse_xy, e.clientX, e.clientY) );
// 	}
// }
// ui.onTouchDown = function(e) {
// 	ui.enable_camera = true;
// 	vec2.copy(ui.mouse_xy2, vec2.set(
// 		ui.mouse_xy, e.changedTouches[0].clientX, e.changedTouches[0].clientY) );
// }
// ui.onMouseMove = function(e) {
// 	if(ui.enable_camera) {
// 		vec2.set(
// 			ui.mouse_xy2, e.clientX, e.clientY);
// 	}
// }
// ui.onTouchMove = function(e) {
// 	if(ui.enable_camera) {
// 		vec2.set(
// 			ui.mouse_xy2, e.changedTouches[0].clientX, e.changedTouches[0].clientY);
// 	}
// }
// ui.onMouseUp = function(e) {
// 	if(ui.enable_camera) {
// 		ui.enable_camera = false;
// 		ui.keys.reset();
// 	}
// }
// ui.onKeyDown = function(e) {	// add this and all other to .prototype if this object is every reused
// 	ui.keys.ctrl |= (e.key == 'Control');
// 	if(ui.enable_camera) {
// 		const k = e.key;
// 		ui.keys.w |= (k == 'w' || k == 'W');
// 		ui.keys.a |= (k == 'a' || k == 'A');
// 		ui.keys.s |= (k == 's' || k == 'S');
// 		ui.keys.d |= (k == 'd' || k == 'D');
// 		ui.keys.q |= (k == 'q' || k == 'Q');
// 		ui.keys.e |= (k == 'e' || k == 'E');
// 		ui.keys.shift |= (k == 'Shift');
// 		return false;
// 	}
// 	return true;
// }
// ui.onKeyUp = function(e) {
// 	ui.keys.ctrl &= (e.key != 'Control');
// 	if(ui.enable_camera) {
// 		const k = e.key;
// 		ui.keys.w &= (k != 'w' && k != 'W');
// 		ui.keys.a &= (k != 'a' && k != 'A');
// 		ui.keys.s &= (k != 's' && k != 'S');
// 		ui.keys.d &= (k != 'd' && k != 'D');
// 		ui.keys.q &= (k != 'q' && k != 'Q');
// 		ui.keys.e &= (k != 'e' && k != 'E');
// 		ui.keys.shift &= (k != 'Shift');
// 		return false;
// 	}
// 	return true;
// }
// ui.onResize = function(e) {		// e is for entries in this one
// 	const size = e[0].contentBoxSize[0];
// 	const x = size.inlineSize, y = size.blockSize;
// 	if((x && x != width) || (y && y != height)) {
// 		ui.fsize._width = x;
// 		ui.fsize._height = y;
// 		ui.fsize.changed = true;
// 		ui.fsize.fixed = false;
// 	}
// }
// ui.onResSelect = function(e) {
// 	const xy = e.target.value.split('_');
// 	const x = parseInt(xy[0]);
// 	const y = parseInt(xy[1]);
// 	if((x && x != width) || (y && y != height)) {
// 		ui.fsize._width = x;
// 		ui.fsize._height = y;
// 		ui.fsize.changed = true;
// 		ui.fsize.fixed = true;
// 	}
// }
// ui.onScaling = function(e) {
// 	let v = ui.downscaling();
// 	if(v > 0) {
// 		ui.fsize.scale = v;
// 		ui.fsize.changed = true;
// 	}
// }
// ui.onFullScreen = function(e) {
// 	console.log(e);
// 	ui.fsize.fullscreen = !!document.fullscreenElement;
// 	ui.fsize.changed = true;
// }
// ui.scene.onSkyChange = function(e) {
// 	let hex = e.target.value;
// 	let r = parseInt(hex[1] + hex[2], 16);
// 	let g = parseInt(hex[3] + hex[4], 16);
// 	let b = parseInt(hex[5] + hex[6], 16);
// 	vec3.set(ui.scene.skycolor, r / 255, g / 255, b / 255);
// 	ui.scene.updated = true;
// }
// ui.scene.onRenderChange = function(val) {
// 	this.simple_render = val;
// 	this.updated = true;
// }
// ui.onOverlayView = function(val) {
// 	if(val) {
// 		ui.elem_overlay_div.style.display = "block";
// 	} else {
// 		ui.elem_overlay_div.style.display = "none";
// 	}
// }

// canvas.addEventListener('mousedown', ui.onMouseDown);
// canvas.addEventListener('touchstart', ui.onTouchDown);
// document.body.addEventListener('mousemove', ui.onMouseMove);
// canvas.addEventListener('touchmove', ui.onTouchMove);
// document.body.addEventListener('mouseup', ui.onMouseUp);
// document.body.addEventListener('touchend', ui.onMouseUp);
// document.body.addEventListener('keydown', ui.onKeyDown);
// document.body.addEventListener('keyup', ui.onKeyUp);
// document.addEventListener('fullscreenchange', ui.onFullScreen);
// ui.elem_fsize_selector.addEventListener('change', ui.onResSelect);
// ui.elem_downscale.addEventListener('input', ui.onScaling);
// (ui.resize_listener = new ResizeObserver(ui.onResize)).observe(frame);
// ui.elem_sky_color.addEventListener('input', ui.scene.onSkyChange);



// const accumulater = {
// 	framebuff : gl.createFramebuffer(),
// 	textures : [
// 		genTextureRGBA32F(gl, width, height),
// 		genTextureRGBA32F(gl, width, height)
// 	],
// 	samples : 0,
// 	mixWeight(sppx) { return this.samples / (this.samples + sppx); },
// 	resetSamples() { this.samples = 0; },
// 	regenTextures(w, h) {
// 		gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
// 		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
// 		gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
// 		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
// 		gl.bindTexture(gl.TEXTURE_2D, null);
// 		this.resetSamples();
// 	},
// 	renderToTexture(trace_program, sppx) {
// 		gl.useProgram(trace_program);
// 		gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
// 		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuff);
// 		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[1], 0);
// 		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
// 		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

// 		this.textures.reverse();
// 		this.samples += sppx;
// 	},
// 	renderTextureToFrame(render_program) {
// 		gl.useProgram(render_program);
// 		gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
// 		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
// 	}
// };

function initProgram() {
	const cam = State.camera;
	const fsize = State.frame;
	const input = State.input;
	gl.useProgram(gl_trace);

	gl.uniformMatrix4fv(Uniforms.iview, false, cam.iview_mat);
	gl.uniformMatrix4fv(Uniforms.iproj, false, cam.iproj_mat);
	gl.uniform3fv(Uniforms.cam_pos, cam.pos);
	gl.uniform3fv(Uniforms.cam_vdir, cam.vdir);
	gl.uniform3fv(Uniforms.cam_rdir, cam.rdir);
	gl.uniform2f(Uniforms.fsize, fsize.scaledWidth, fsize.scaledHeight);
	gl.uniform1f(Uniforms.focus_dist, cam.focus_dist);
	gl.uniform1f(Uniforms.aperture, cam.aperture);
	gl.uniform1i(Uniforms.bounces, State.render.bounces);
	gl.uniform1i(Uniforms.simple, State.render.simple * 1);
	gl.uniform3fv(Uniforms.sky_color, scene.skycolor);
}

let ltime;
function renderTick(timestamp) {
	const dt = timestamp - ltime;
	ltime = timestamp;

	let updated = false;
	
	const cam = State.camera;
	const fsize = State.frame;
	const input = State.input;
	const keys = input.keys;

	gl.useProgram(gl_trace);

	if(input.enabled) {
		if(keys.w || keys.a || keys.s || keys.d || keys.q || keys.e) {
			updated = true;
			let speed = 5 / 1000;
			if(keys.shift) { speed *= 5; }
			if(keys.w) { vec3.scaleAndAdd(cam.pos, cam.pos, cam.fdir, speed * dt); }
			if(keys.a) { vec3.scaleAndAdd(cam.pos, cam.pos, cam.rdir, -speed * dt); }
			if(keys.s) { vec3.scaleAndAdd(cam.pos, cam.pos, cam.fdir, -speed * dt); }
			if(keys.d) { vec3.scaleAndAdd(cam.pos, cam.pos, cam.rdir, speed * dt); }
			if(keys.q) { vec3.scaleAndAdd(cam.pos, cam.pos, cam.updir, -speed * dt); }
			if(keys.e) { vec3.scaleAndAdd(cam.pos, cam.pos, cam.updir, speed * dt); }

			gl.uniform3fv(Uniforms.cam_pos, cam.pos);
		}
		if(!vec2.equals(input.mouse_xy, input.mouse_xy2)) {
			updated = true;
			let dxy = vec2.sub(vec2.create(), input.mouse_xy2, input.mouse_xy);
			vec2.scale(dxy, dxy, 0.002 * 0.8);
			const rot = quat.multiply(
				quat.create(),
				quat.setAxisAngle(quat.create(), cam.rdir, -dxy[1]),
				quat.setAxisAngle(quat.create(), cam.updir, -dxy[0])
			);
			vec3.transformQuat(cam.fdir, cam.fdir, rot);
			vec3.cross(cam.rdir, cam.fdir, cam.updir);
			vec3.cross(cam.vdir, cam.rdir, cam.fdir);
			mat4.lookAt(cam.view_mat, cam.pos, vec3.add(vec3.create(), cam.pos, cam.fdir), cam.updir);
			mat4.invert(cam.iview_mat, cam.view_mat);
			vec2.copy(input.mouse_xy, input.mouse_xy2);

			gl.uniformMatrix4fv(Uniforms.iview, false, cam.iview_mat);
			gl.uniform3fv(Uniforms.cam_vdir, cam.vdir);
			gl.uniform3fv(Uniforms.cam_rdir, cam.rdir);
		}
	}
	if(fsize.updated) {
		updated = true;
		if(fsize.fullscreen) {
			fsize._cache.width = fsize.width;
			fsize._cache.height = fsize.height;
			canvas.style.width = (fsize.width = window.screen.width) + 'px';
			canvas.style.height = (fsize.height = window.screen.height) + 'px';
			canvas.width = fsize.scaledWidth;
			canvas.height = fsize.scaledHeight;
		} else {
			canvas.style.width = (fsize.width = fsize._new.width) + 'px';
			canvas.style.height = (fsize.height = fsize._new.height) + 'px';
			canvas.width = fsize.scaledWidth;
			canvas.height = fsize.scaledHeight;
			if(fsize.fixed) {
				frame.style.width = fsize.width;
				frame.style.height = fsize.height;
			} else {
				frame.style.width = 'fit-content';
				frame.style.height = 'fit-content';
				Elements.select_fsize.value = "Custom";
			}
		}
		Elements.display_fsize.innerHTML = fsize.width + 'x' + fsize.height;

		mat4.perspective(cam.proj_mat, cam.fov * Math.PI / 180, fsize.ratio, cam.nearclip, cam.farclip);
		mat4.invert(cam.iproj_mat, cam.proj_mat);
		gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		gl.uniform2f(Uniforms.fsize, fsize.scaledWidth, fsize.scaledHeight);
		gl.uniformMatrix4fv(Uniforms.iproj, false, cam.iproj_mat);

		fsize.updated = false;

	} else if(cam.updated_fov) {
		updated = true;
		mat4.perspective(cam.proj_mat, cam.fov * Math.PI / 180, fsize.ratio, cam.nearclip, cam.farclip);
		mat4.invert(cam.iproj_mat, cam.proj_mat);
		gl.uniformMatrix4fv(Uniforms.iproj, false, cam.iproj_mat);
		cam.updated_fov = false;
	}
	if(cam.updated) {
		updated = true;
		gl.uniform1f(Uniforms.focus_dist, cam.focus_dist);
		gl.uniform1f(Uniforms.aperture, cam.aperture);
	}
	if(State.render.updated) {
		updated = true;
		gl.uniform1i(Uniforms.bounces, State.render.bounces);
		gl.uniform1i(Uniforms.simple, State.render.simple * 1);
	}
	if(State.scene.updated) {
		updated = true;
		gl.uniform3fv(Uniforms.sky_color, scene.skycolor);
		// update texture arrays
	}

	if(updated) {
		Renderer.regenTextures(fsize.scaledWidth, fsize.scaledHeight);
		Renderer.samplecount = 0;
	}

	if(Renderer.samplecount < State.render.sample_limit) {
		gl.uniform1f(Uniforms.realtime, performance.now() - start_time);
		gl.uniform1i(Uniforms.samples, State.render.sample_rate);
		Renderer.renderToTexture(gl_trace, State.render.sample_rate);
		gl.useProgram(gl_render);
		gl.uniform1f(Uniforms.total_samples, Renderer.samplecount);
		Renderer.renderFromTextureBuff(gl_render);
	}
	Elements.display_samples.innerHTML = Renderer.samplecount;
	let fps = 1000 / dt;
	Elements.display_fps.innerHTML = fps.toFixed(2) + " fps";

	window.requestAnimationFrame(renderTick);
}
initProgram();
ltime = performance.now();
window.requestAnimationFrame(renderTick);