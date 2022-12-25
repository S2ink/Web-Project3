//Promise.resolve(getShaderSource("fragment.glsl")).then((src) => {main(src);});
async function getShaderSource(fname) {
	return await fetch(fname).then(result => result.text());
}
function compileShader(gl, source, type) {
	let shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.log(gl.getShaderInfoLog(shader));
		alert(`Failed to compile shader (type: ${type}) - see console for details.`);
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}
function linkProgram(gl, vshader, fshader) {
	let program = gl.createProgram();
	gl.attachShader(program, vshader);
	gl.attachShader(program, fshader);
	gl.linkProgram(program);
	if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.log(gl.getProgramInfoLog(program));
		alert("Failed to link program - see console for details.");
		gl.deleteProgram(program);
		return null;
	}
	return program;
}
function buildProgram(gl, vsource, fsource) {		// faster than calling all methods in separate
	let start = performance.now();
	let vshader = gl.createShader(gl.VERTEX_SHADER);
	let fshader = gl.createShader(gl.FRAGMENT_SHADER);
	let program = gl.createProgram();
	gl.shaderSource(vshader, vsource);
	gl.shaderSource(fshader, fsource);
	gl.attachShader(program, vshader);
	gl.attachShader(program, fshader);

	gl.compileShader(vshader);
	gl.compileShader(fshader);
	gl.linkProgram(program);
	console.log("Compiled shaders in " + (performance.now() - start) + "ms");

	if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(`WebGL shader program link failed: ${gl.getProgramInfoLog(program)}`);
		if(!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)) {
			console.log(`Vertex shader log:\n${gl.getShaderInfoLog(vshader)}`);
		}
		if(!gl.getShaderParameter(fshader, gl.COMPILE_STATUS)) {
			console.log(`Fragment shader log:\n${gl.getShaderInfoLog(fshader)}`);
		}
		alert("Failed to compile WebGL shader program - see console for logs.");
		return null;
	}
	return program;
}