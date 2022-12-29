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
	let end = performance.now();

	if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(`WebGL shader program link failed in ${end - start}ms: ${gl.getProgramInfoLog(program)}`);
		if(!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)) {
			console.log(`Vertex shader log:\n${gl.getShaderInfoLog(vshader)}`);
		}
		if(!gl.getShaderParameter(fshader, gl.COMPILE_STATUS)) {
			console.log(`Fragment shader log:\n${gl.getShaderInfoLog(fshader)}`);
		}
		alert("Failed to compile WebGL shader program - see console for logs.");
		return null;
	}
	console.log("Compiled shaders in " + (end - start) + "ms");
	return program;
}

function listActiveUniforms(gl, program) {
	const num = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
	for(let i = 0; i < num; i++) {
		console.log(gl.getActiveUniform(program, i).name);
	}
}



const fb_vertex_src = `#version 300 es
layout(location = 0) in vec2 vertex;
out vec2 fragCoord;

void main() {
	fragCoord = vertex * 0.5 + 0.5;
	gl_Position = vec4(vertex, 0.0, 1.0);
}
`;
const fb_fragment_src = `#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
	precision highp float;
#else
	precision mediump float;
#endif

in vec2 fragCoord;
uniform sampler2D framebuff;
uniform float total_samples;

out vec4 fragColor;
void main() {
	fragColor = vec4(sqrt(texture(framebuff, fragCoord).rgb / total_samples), 1.0);
}
`;

const vertex_src = `#version 300 es
layout(location = 0) in vec2 vertex;

void main() {
	gl_Position = vec4(vertex, 0.0, 1.0);
}
`;
const fragment_src = `#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
	precision highp float;
#else
	precision mediump float;
#endif

#define SPHERE_ARRAY_LEN 64	// len for each interactable type... (set by scene)
//#define MATERIALS_ARRAY_LEN 64	// set by scene - if we want to save memory by compacting reused materials
//#define TEXTURES_ARRAY_LEN 64		// set by scene - if we ever add dynamic texturing

#define EPSILON 0.00001		// 10e-5
#define PI 3.14159265358979
#define PI2 6.283185307179586
#define PHI 1.61803398874989484820459

struct Material {
	float roughness;
	float glossiness;
	float transparency;
	float refraction_index;
};
struct Sphere {
	vec3 position;
	float radius;
	float luminance;	// this could be a map	(Texture)
	vec3 albedo;		// and this				(Texture)
	Material mat;
};

uniform sampler2D acc_frame;
uniform mat4 iview, iproj;
uniform vec3 cam_pos;
uniform vec2 fsize;
uniform float realtime;
uniform float samples;
uniform float bounces;
uniform float simple;

uniform vec3 skycolor;
uniform Sphere spheres[SPHERE_ARRAY_LEN];
uniform float sphere_count;
uniform float selected_sphere;


const vec3 _rc1_ = vec3(12.9898, 78.233, 151.7182);
const vec3 _rc2_ = vec3(63.7264, 10.873, 623.6736);
const vec3 _rc3_ = vec3(36.7539, 50.3658, 306.2759);
float _rseed_ = (PI / PHI);
float rseed() {
	_rseed_ += (fract(sqrt(realtime)));
	return _rseed_;
}

float s_random_gen(in vec3 scale, in float seed) {
	highp float d = 43758.5453;
	highp float dt = dot(gl_FragCoord.xyz + seed, scale);
	highp float sn = mod(dt, PI);
	return fract(sin(sn) * d);
}
float random_gen(in vec3 scale) {
	return s_random_gen(scale, rseed());
}
float srand(in float seed) { return s_random_gen(gl_FragCoord.xyz * realtime, seed); }
float rand() { return random_gen(gl_FragCoord.xyz * realtime); }

vec3 randVec3() {
	return (vec3(
		random_gen(_rc1_),
		random_gen(_rc2_),
		random_gen(_rc3_)
	) * 2.0 - 1.0);
}
vec3 srandVec3(in float seed) {
	return (vec3(
		s_random_gen(_rc1_, seed),
		s_random_gen(_rc2_, seed),
		s_random_gen(_rc3_, seed)
	) * 2.0 - 1.0);
}
vec3 randomUnitVector() { return normalize(randVec3()); }
vec3 seededRandomUnitVector(in float seed) { return normalize(srandVec3(seed)); }

vec3 cosineWeightedDirection(float seed, vec3 normal) {
	float u = s_random_gen(_rc1_, seed);
	float v = s_random_gen(_rc2_, seed);
	float r = sqrt(u);
	float angle = PI2 * v;	// compute basis from normal
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
	float u = s_random_gen(_rc1_, seed);
	float v = s_random_gen(_rc2_, seed);
	float z = 1.0 - 2.0 * u;
	float r = sqrt(1.0 - z * z);
	float angle = PI2 * v;
	return vec3(r * cos(angle), r * sin(angle), z);
}
vec3 uniformlyRandomVector(float seed) {
	return uniformlyRandomDirection(seed) * sqrt(s_random_gen(_rc3_, seed));
}
vec3 randomUnitVec_Reject(float seed) {
	while(true) {
		vec3 test = srandVec3(seed);
		if(dot(test, test) <= 1.0) {
			return test;
		}
		seed += 1.0;
	}
}

struct Ray {
	vec3 origin;
	vec3 direction;
};
struct Hit {
	bool reverse_intersect;
	float time;
	Ray normal;
	//vec2 uv;
};

bool _reflect(in Ray src, in Hit hit, out Ray ret) {
	ret.origin = hit.normal.origin;
	ret.direction = reflect(src.direction, hit.normal.direction);
	return dot(ret.direction, hit.normal.direction) > 0.0;
}
bool _refract(in Ray src, in Hit hit, out Ray ret, in float ratio) {
	ret.origin = hit.normal.origin;
	ret.direction = refract(src.direction, hit.normal.direction, ratio);
	return true;
}
bool reflectGlossy(in Ray src, in Hit hit, out Ray ret, float gloss) {
	ret.origin = hit.normal.origin;
	ret.direction = reflect(src.direction, hit.normal.direction) + (randomUnitVec_Reject(rseed()) * gloss);
	return dot(ret.direction, hit.normal.direction) > 0.0;
}
float reflectance_approx(float cos, float ratio) {
	float r0 = (1.0 - ratio) / (1.0 + ratio);
	r0 = r0 * r0;
	return r0 + (1.0 - r0) * pow(1.0 - cos, 5.0);
}
float reflectance_exact(float cosi, float cost, float n1, float n2) {
	float r1 = (n1*cosi - n2*cost) / (n1*cosi + n2*cost);
	float r2 = (n2*cosi - n1*cost) / (n2*cosi + n1*cost);
	return (r1*r1 + r2*r2) / 2.0;
}
bool refractGlossy(in Ray src, in Hit hit, out Ray ret, in float ir, in float gloss) {
	if(!hit.reverse_intersect) { ir = 1.0 / ir; }
	float cos_theta = min(dot(-src.direction, hit.normal.direction), 1.0);
	float sin_theta = sqrt(1.0 - cos_theta * cos_theta);
	float r = rand();
	if ((ir * sin_theta) > 1.0 || (reflectance_approx(cos_theta, ir) > r)) {
		return reflectGlossy(src, hit, ret, gloss);
	}
	vec3 r_out_perp = ir * (src.direction + cos_theta * hit.normal.direction);
	vec3 r_out_para = -sqrt(abs(1.0 - dot(r_out_perp, r_out_perp))) * hit.normal.direction;
	ret.direction = r_out_perp + r_out_para + (randomUnitVec_Reject(rseed()) * gloss);
	ret.origin = hit.normal.origin;
	return true;
}
bool diffuse(in Hit hit, out Ray ret) {
	ret.origin = hit.normal.origin;
	//ret.direction = cosineWeightedDirection(rseed(), hit.normal.direction);
	//ret.direction = hit.normal.direction + uniformlyRandomVector(rseed());
	ret.direction = hit.normal.direction + randomUnitVec_Reject(rseed());		// ha, my method is better
	return true;
}
bool redirectRay(in Ray src, in Hit hit, in Material mat, out Ray ret) {
	float r = rand();
	if(r < mat.roughness) {
		return diffuse(hit, ret);
	} else if(r < mat.transparency) {
		return refractGlossy(src, hit, ret, mat.refraction_index, mat.glossiness);
		//return _refract(src, hit, ret, mat.refraction_index);
	} else {
		return reflectGlossy(src, hit, ret, mat.glossiness);
	}
}


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
		hit.time  = (-sqrt(d) + b) / (-2.0 * a);
		if(hit.time < t_min || hit.time > t_max) {
			return false;
		}
	}
	hit.normal.origin = ray.direction * hit.time + ray.origin;
	hit.normal.direction = normalize(hit.normal.origin - s.position);
	hit.reverse_intersect = dot(hit.normal.direction, ray.direction) > 0.0;
	hit.normal.origin = s.position + hit.normal.direction * s.radius;
	if(hit.reverse_intersect) {
		hit.normal.direction *= -1.0;
	}
	//hit.normal.origin += hit.normal.direction * EPSILON;	// no accidental re-collision
	return true;
}

vec3 getSourceRay(in vec2 proportional, in mat4 inv_proj, in mat4 inv_view) {
	vec4 t = inv_proj * vec4( (proportional * 2.0 - 1.0), 1.0, 1.0);
	return vec3( inv_view * vec4( normalize(vec3(t) / t.w), 0) );
}

vec3 evalRaySimple(in Ray ray) {
	Hit hit;
	float t_max = 10000000000000.;
	vec3 alb = skycolor;
	for(int i = 0; i < int(sphere_count); i++) {
		if(interactsSphere(ray, spheres[i], hit, EPSILON, t_max)) {
			t_max = hit.time;
			alb = spheres[i].albedo;
		}
	}
	return alb;
}
vec3 evalRay(in Ray ray, in int bounces) {
	vec3 total = vec3(0.0);
	vec3 cache = vec3(1.0);
	Ray current = ray;
	for(int b = bounces; b >= 0; b--) {
		Hit hit, tmp;
		hit.time = 10000000000000.;
		int idx = -1;
		for(int i = 0; i < int(sphere_count); i++) {
			if(interactsSphere(current, spheres[i], tmp, EPSILON, hit.time)) {
				hit = tmp;
				idx = i;
			}
		}
		if(idx >= 0) {
			float lum = spheres[idx].luminance;
			vec3 clr = spheres[idx].albedo;
			if(b == 0 || ((clr.x + clr.y + clr.z) / 3.0 * lum) >= 1.0) {
				total += cache * clr * lum;
				return total;
			}
			Ray redirect;
			if(redirectRay(current, hit, spheres[idx].mat, redirect)) {
				cache *= clr;
				total += cache * lum;
				current = redirect;
				continue;
			}
		}
		total += cache * skycolor;
		break;
	}
	return total;
}

out vec4 fragColor;
void main() {
	Ray src = Ray(cam_pos, vec3(0.0));
	vec3 clr = texture(acc_frame, gl_FragCoord.xy / fsize).rgb;
	if(simple == 1.0) {
		for(int i = 0; i < int(samples); i++) {
			float r = rand();
			src.direction = getSourceRay((gl_FragCoord.xy + vec2(r)) / fsize, iproj, iview);
			clr += evalRaySimple(src);
		}
	} else {
		for(int i = 0; i < int(samples); i++) {
			float r = rand();
			src.direction = getSourceRay((vec2(gl_FragCoord) + vec2(r)) / fsize, iproj, iview);
			clr += evalRay(src, int(bounces));
		}
	}
	fragColor = vec4(clr, 1.0);
}
`;