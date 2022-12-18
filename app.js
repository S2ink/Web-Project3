let element = document.getElementById("frame");
let canvas = element.getContext('2d');
let width = 640, height = 480;
let scale = 10;
element.width = width;
element.height = height;


let camera = new Camera();
camera.fov = 60;
camera.pos = new Vec3(0,0,0);
camera.fdir = new Vec3(0,0,1);
camera.vwidth = width;
camera.vheight = height;
console.log(camera.recalcView());
console.log(camera.recalcProj());
let directions = camera.getRayDirections();
console.log(directions);

canvas.fillStyle = 'black';
canvas.fillRect(0, 0, width, height);

let obj = new Sphere(new Vec3(0, 0, 2), 0.5);

function paint() {
	let ray = new Ray();
	ray.origin = camera.pos.clone();
	for(let y = 0; y < height / scale; y++) {
		for(let x = 0; x < width / scale; x++) {

			ray.direction = directions[x * scale + y * scale * width];	// the direction based on camera view
			let hit = new Hit();
			let clr;
			if(obj.interacts(ray, hit) == obj) {
				clr = new Vec3(0, 1, 0);
			} else {
				clr = new Vec3(0, 0, 0);
			}
			//let clr = directions[x * scale + y * scale * width];
			//clr.divideScalar(2).add(new Vec3(0.5));
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
let start = Date.now();
paint();
//setTimeout(camPaintRecurse, 100, new Vec3(0.2,0,0.8));
// setTimeout(camPaint, 100, new Vec3(0.2,0,0.8));
// setTimeout(camPaint, 200, new Vec3(0.4,0,0.6));
// setTimeout(camPaint, 300, new Vec3(0.6,0,0.4));
// setTimeout(camPaint, 400, new Vec3(0.8,0,0.2));
// setTimeout(camPaint, 500, new Vec3(1,0,0));
let end = Date.now();
console.log(end - start);

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
//let rot = 0;
// setInterval(function() {
// 	//rot += 0.1;
// 	//let dir = new Vec3(/*Math.sin(rot)*/0, Math.sin(rot + Math.PI), 1/*Math.cos(rot)*/);
// 	camPaint(dir);
// }, 100);

let m = new Mat4(1);
console.log(m);