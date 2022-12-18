let element = document.getElementById("frame");
let canvas = element.getContext('2d');
let width = 640, height = 480;
let scale = 4;
let samples = 20;
element.width = width;
element.height = height;

let scale_input = document.getElementById("scale");
scale_input.setAttribute('value', scale);
let samples_input = document.getElementById("samples");
samples_input.setAttribute('value', samples);
// let width_input = document.getElementById("width");
// let height_input = document.getElementById("height");
// let resize_button = document.getElementById("resize");
// let render_action = document.getElementById("render");


let camera = new Camera();
camera.fov = 60;
camera.pos = new Vec3(0,0,0);
camera.fdir = new Vec3(0,0,1);
camera.vwidth = width;
camera.vheight = height;
camera.recalcView();
camera.recalcProj();
let directions = camera.getRayDirections();
directions;

canvas.fillStyle = 'black';
canvas.fillRect(0, 0, width, height);

scene = new Scene(
	[
		new Sphere(new Vec3(0, -0.1, 3), 0.6, new PhysicalBase(0, 0, 1, 1.5), new StaticTexture(0.1, 0.7, 0.7)),
		new Sphere(new Vec3(0, 10, 4), 9.6, PhysicalBase.DEFAULT, new StaticTexture(0.7, 0.6, 0.8)),
		new Sphere(new Vec3(1, -1, 5), 1, PhysicalBase.DEFAULT, new StaticTexture(0.5, 0.2, 0.2), 7),
		new Sphere(new Vec3(-2, 0.3, 7), 3, PhysicalBase.DEFAULT, new StaticTexture(0.5, 0.7, 0.2)),
		new Sphere(new Vec3(-1.8, 0, 3), 0.7, new PhysicalBase(0), new StaticTexture(0.7, 0.5, 0.1))
	],
	new Vec3(0.05)
);

function evalRay(sce, ray, bounces) {
	let hit = new Hit();
	let obj = null;
	if(obj = sce.interacts(ray, hit)) {
		const lum = obj.emmission(hit);
		const clr = obj.albedo(hit);
		if(bounces == 0 || ((clr.x + clr.y + clr.z) / 3 * lum) >= 1) {
			return clr.scale(lum);
		}
		let redirect = new Ray();
		if(obj.redirect(ray, hit, redirect)) {
			return clr.iMul(evalRay(sce, redirect, bounces - 1).sadd(lum));
		}
	}
	return sce.albedo(hit);
}

function paint() {
	scale = parseInt(scale_input.value)
	samples = parseInt(samples_input.value);
	let ray = new Ray();
	ray.origin = camera.pos.clone();
	for(let y = 0; y < height / scale; y++) {
		for(let x = 0; x < width / scale; x++) {

			ray.direction = directions[x * scale + y * scale * width];	// the direction based on camera view
			let clr = new Vec3(0);
			for(let s = 0; s < samples; s++) {
				clr.add(evalRay(scene, ray, 5));
			}
			clr.scale(1 / samples).clamp(0, 1).sqrt();
			canvas.fillStyle = `rgb(${clr.x * 255},${clr.y * 255},${clr.z * 255})`;
			canvas.fillRect(x * scale, y * scale, scale, scale);
			
		}
	}
}
function camPaint(d) {
	camera.fdir = d.clone();
	camera.recalcView();
	camera.recalcProj();
	directions = camera.getRayDirections();
	paint();
}
// function improve() {
// 	if(scale != 1) {
// 		scale /= 2;
// 	}
// 	samples *= 10;
// 	if(scale / 2 < 1 && samples > 100) {
// 		return;
// 	}
// 	console.log("Beggining Render - Scale: " + scale + ", Samples: " + samples);
// 	paint();
// 	setTimeout(improve, 100);
// }
let start = Date.now();
paint();
let end = Date.now();
console.log(end - start);

//setTimeout(improve, 100);

let mdown = false;
let lastx = 0, lasty = 0;
element.addEventListener('mousedown', function(e){
	let rect = element.getBoundingClientRect();
	lastx = e.clientX - rect.left;
	lasty = e.clientY - rect.top;
	mdown = true;
});
element.addEventListener('mouseup', function(){
	mdown = false;
});
element.addEventListener('mousemove', function(e){
	if(mdown) {
		let rect = element.getBoundingClientRect();
		let x = (e.clientX - rect.left) * 0.002 * 0.3;
		let y = (e.clientY - rect.top) * 0.002 * 0.3;
		let dx = x - lastx;
		let dy = y - lasty;
		lastx = x;
		lasty = y;
		if(dx != 0 || dy != 0) {
			console.log(dx + ', ' + dy);
		}
	}
});