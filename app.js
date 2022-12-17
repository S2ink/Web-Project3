let element = document.getElementById("frame");
let canvas = element.getContext('2d');
let width = 640, height = 480;
let scale = 1;
element.width = width;
element.height = height;

let camera = new Camera();
camera.pos = new CCT.Vector3(0,0,0);
camera.fdir = new CCT.Vector3(0,0.5,1);
camera.vwidth = width;
camera.vheight = height;
console.log(camera.recalcView());
console.log(camera.recalcProj());
let directions = camera.getRayDirections();
console.log(directions);

canvas.fillStyle = 'black';
canvas.fillRect(0, 0, width, height);

let obj = CCT.Sphere(new CCT.Vector3(0, 1, 0), 0.5);
let orig = new CCT.Vector3(0, 0, -1);

function paint() {
	for(let y = 0; y < height / scale; y++) {
		for(let x = 0; x < width / scale; x++) {

			let direction = directions[x + y * width];	// the direction based on camera view
			let result = CCT.mathRaycastSphere(camera.pos, direction, obj.pos, obj.radius);

			let clr;
			if(result == null || result.distance == 0) {
				clr = new CCT.Vector3(0, 0, 0);
			} else {
				clr = new CCT.Vector3(0, 1, 0);
			}
			clr = direction;
			canvas.fillStyle = `rgb(${clr.x * 255},${clr.y * 255},${clr.z * 255})`;
			canvas.fillRect(x * scale, y * scale, scale, scale);
			
		}
	}
}
let start = Date.now();
paint();
let end = Date.now();
console.log(end - start);