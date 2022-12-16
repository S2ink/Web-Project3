let canvas = document.getElementById("frame").getContext('2d');
let width = 500;
let height = 500;
let wscale = 0.5;
let hscale = 0.5;

canvas.fillStyle = 'black';
canvas.fillRect(0, 0, width * wscale, height * hscale);

function paint() {
	for(let y = 0; y < height / hscale; y++) {
		for(let x = 0; x < width / wscale ; x++) {
			
			let clr;
			// get color from scene
			clr = new CCT.Vector3(0, x, y);
			canvas.fillStyle = `rgb(${clr.x},${clr.y},${clr.z})`;
			canvas.fillRect(x * wscale, y * hscale, wscale, hscale);
			
		}
	}
}
let start = Date.now();
paint();
let end = Date.now();
console.log(end - start);