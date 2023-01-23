#ifdef GL_FRAGMENT_PRECISION_HIGH
	precision highp float;
#else
	precision mediump float;
#endif


#define EPSILON 0.00001		// 1e-5
#define PI 3.14159265358979
#define PI2 6.283185307179586
#define PHI 1.61803398874989484820459

uniform sampler2D acc_frame;
uniform mat4 iview, iproj;
uniform vec3 cam_pos;
uniform vec3 cam_vdir;
uniform vec3 cam_rdir;
uniform vec2 fsize;
uniform float focus_distance;
uniform float aperture;
uniform float realtime;
uniform int samples;
uniform int bounces;
uniform int simple;


#define SPHERE_FLOATS 5
#define TRIANGLE_FLOATS 10
#define SURFACE_FLOATS 5
#define MATERIAL_FLOATS 4

struct Sphere {
	vec3 center;
	float radius;
	int _surface;
};
struct Triangle {
	vec3 a, b, c;
	int _surface;
};

struct Surface {
	float luminance;
	vec3 albedo;
	int _material;
};
struct Material {
	float roughness;
	float glossiness;
	float transparency;
	float refraction_index;
};

uniform vec3 skycolor;
uniform sampler2D sphere_data;
uniform sampler2D triangle_data;
uniform sampler2D surface_data;
uniform sampler2D material_data;
// uniform int spheres_count;
// uniform int triangles_count;
// uniform int surfaces_count;
// uniform int materials_count;
// uniform float selected

float sample1d(in sampler2D smp, in int beg) {
	return texelFetch(smp, ivec2(beg, 0), 0).x;
}
vec3 sample1d_v3(in sampler2D smp, in int beg) {
	return vec3(
		texelFetch(smp, ivec2(beg, 0), 0).x,
		texelFetch(smp, ivec2(beg + 1, 0), 0).x,
		texelFetch(smp, ivec2(beg + 2, 0), 0).x
	);
}
void sphere_at(in int num, out Sphere s) {
	s.center = vec3(
		texelFetch(sphere_data, ivec2(0, num), 0).x,
		texelFetch(sphere_data, ivec2(1, num), 0).x,
		texelFetch(sphere_data, ivec2(2, num), 0).x);
	s.radius =
		texelFetch(sphere_data, ivec2(3, num), 0).x;
	s._surface = int(
		texelFetch(sphere_data, ivec2(4, num), 0).x);
}
void triangle_at(in int num, out Triangle t) {
	t.a = vec3(
		texelFetch(triangle_data, ivec2(0, num), 0).x,
		texelFetch(triangle_data, ivec2(1, num), 0).x,
		texelFetch(triangle_data, ivec2(2, num), 0).x);
	t.b = vec3(
		texelFetch(triangle_data, ivec2(3, num), 0).x,
		texelFetch(triangle_data, ivec2(4, num), 0).x,
		texelFetch(triangle_data, ivec2(5, num), 0).x);
	t.c = vec3(
		texelFetch(triangle_data, ivec2(6, num), 0).x,
		texelFetch(triangle_data, ivec2(7, num), 0).x,
		texelFetch(triangle_data, ivec2(8, num), 0).x);
	t._surface = int(
		texelFetch(triangle_data, ivec2(9, num), 0).x);
}
void surface_at(in int num, out Surface s) {
	s.luminance =
		texelFetch(surface_data, ivec2(0, num), 0).x;
	s.albedo = vec3(
		texelFetch(surface_data, ivec2(1, num), 0).x,
		texelFetch(surface_data, ivec2(2, num), 0).x,
		texelFetch(surface_data, ivec2(3, num), 0).x);
	s._material = int(
		texelFetch(surface_data, ivec2(4, num), 0).x);
}
void material_at(in int num, out Material m) {
	m.roughness =
		texelFetch(material_data, ivec2(0, num), 0).x;
	m.glossiness =
		texelFetch(material_data, ivec2(1, num), 0).x;
	m.transparency =
		texelFetch(material_data, ivec2(2, num), 0).x;
	m.refraction_index =
		texelFetch(material_data, ivec2(3, num), 0).x;
}

int sphere_count() {
	return int(textureSize(sphere_data, 0).y);
}
int triangle_count() {
	return int(textureSize(triangle_data, 0).y);
}
int surface_count() {
	return int(textureSize(surface_data, 0).y);
}
int material_count() {
	return int(textureSize(material_data, 0).y);
}


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

vec2 randVec2() {
	return (vec2(
		random_gen(_rc1_),
		random_gen(_rc2_)
	) * 2.0 - 1.0);
}
vec2 srandVec2(in float seed) {
	return (vec2(
		s_random_gen(_rc1_, seed),
		s_random_gen(_rc2_, seed)
	) * 2.0 - 1.0);
}
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
vec2 randomUnitVec2_Reject(float seed) {
	while(true) {
		vec2 test = srandVec2(seed);
		if(dot(test, test) <= 1.0) {
			return test;
		}
		seed += 1.0;
	}
}
vec3 randomUnitVec3_Reject(float seed) {
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
	ret.direction = reflect(src.direction, hit.normal.direction) + (randomUnitVec3_Reject(rseed()) * gloss);
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
	ret.direction = r_out_perp + r_out_para + (randomUnitVec3_Reject(rseed()) * gloss);
	ret.origin = hit.normal.origin;
	return true;
}
bool diffuse(in Hit hit, out Ray ret) {
	ret.origin = hit.normal.origin;
	//ret.direction = cosineWeightedDirection(rseed(), hit.normal.direction);
	//ret.direction = hit.normal.direction + uniformlyRandomVector(rseed());
	ret.direction = hit.normal.direction + randomUnitVec3_Reject(rseed());		// ha, my method is better
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
	vec3 o = ray.origin - s.center;
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
	hit.normal.direction = normalize(hit.normal.origin - s.center);
	hit.reverse_intersect = dot(hit.normal.direction, ray.direction) > 0.0;
	hit.normal.origin = s.center + hit.normal.direction * s.radius;
	if(hit.reverse_intersect) {
		hit.normal.direction *= -1.0;
	}
	//hit.normal.origin += hit.normal.direction * EPSILON;	// no accidental re-collision
	return true;
}
bool interactsTriangle(in Ray ray, in Triangle t, inout Hit hit, float t_min, float t_max) {
	vec3 h, s, q;
	vec3 s1 = t.b - t.a, s2 = t.c - t.a;
	float a, f, u, v;

	h = cross(ray.direction, s2);
	a = dot(s1, h);
	if(a > -EPSILON && a < EPSILON) { return false; }
	f = 1.0 / a;
	s = ray.origin - t.a;
	u = f * dot(s, h);
	if(u < 0.0 || u > 1.0) { return false; }
	q = cross(s, s1);
	v = f * dot(ray.direction, q);
	if(v < 0.0 || u + v > 1.0) { return false; }

	hit.time = f * dot(s2, q);
	if(hit.time <= EPSILON || hit.time < t_min || hit.time > t_max) { return false; }
	hit.normal.origin = ray.origin + ray.direction * hit.time;
	hit.normal.direction = normalize(cross(s1, s2));
	hit.reverse_intersect = false;
	if(dot(hit.normal.direction, ray.direction) > 0.0) {
		hit.normal.direction *= -1.0;
	}
	return true;
}

vec3 getSourceRay(in vec2 proportional, in mat4 inv_proj, in mat4 inv_view) {
	vec4 t = inv_proj * vec4( (proportional * 2.0 - 1.0), 1.0, 1.0);
	return vec3( inv_view * vec4( normalize(vec3(t) / t.w), 0) );
}
void DOFRay(inout Ray ray, vec3 vdir, vec3 rdir, float aperature, float focus_dist) {
	vec3 p = ray.direction * focus_dist;
	vec2 r = randomUnitVec2_Reject(rseed());
	vec3 o = ((vdir * r.x + rdir * r.y) * aperature / 2.0);
	// vec3 o = ((vdir * srand(rseed()) + rdir * srand(rseed())) * aperature / 2.0);	// square bokeh
	ray.direction = normalize(p - o);
	ray.origin += o;
}

vec3 evalRaySimple(in Ray ray) {
	Hit hit;
	float t_max = 10000000000000.;
	int srf = -1;
	Sphere s;
	for(int i = 0; i < sphere_count(); i++) {
		sphere_at(i, s);
		if(interactsSphere(ray, s, hit, EPSILON, t_max)) {
			t_max = hit.time;
			srf = s._surface;
		}
	}
	Triangle t;
	for(int i = 0; i < triangle_count(); i++) {
		triangle_at(i, t);
		if(interactsTriangle(ray, t, hit, EPSILON, t_max)) {
			t_max = hit.time;
			srf = t._surface;
		}
	}
	if(srf >= 0) {
		Surface _s;
		surface_at(srf, _s);
		return _s.albedo;
	}
	return skycolor;
}
vec3 evalRay(in Ray ray, in int bounces) {
	vec3 total = vec3(0.0);
	vec3 cache = vec3(1.0);
	Ray current = ray;
	for(int b = bounces; b >= 0; b--) {
		Hit hit, tmp;
		int _srf = -1;
		hit.time = 10000000000000.;
		Sphere s;
		for(int i = 0; i < sphere_count(); i++) {
			sphere_at(i, s);
			if(interactsSphere(current, s, tmp, EPSILON, hit.time)) {
				hit = tmp;
				_srf = s._surface;
			}
		}
		Triangle t;
		for(int i = 0; i < triangle_count(); i++) {
			triangle_at(i, t);
			if(interactsTriangle(current, t, tmp, EPSILON, hit.time)) {
				hit = tmp;
				_srf = t._surface;
			}
		}
		if(_srf >= 0) {
			Surface srf;
			surface_at(_srf, srf);
			float lum = srf.luminance;
			vec3 clr = srf.albedo;
			if(b == 0 || ((clr.x + clr.y + clr.z) / 3.0 * lum) >= 1.0) {
				total += cache * clr * lum;
				return total;
			}
			Ray redirect;
			Material mat;
			material_at(srf._material, mat);
			if(redirectRay(current, hit, mat, redirect)) {
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
	Ray base = Ray(cam_pos, vec3(0.0));
	vec3 clr = texelFetch(acc_frame, ivec2(gl_FragCoord.xy), 0).rgb;
	if(simple > 0) {
		for(int i = 0; i < samples; i++) {
			float r = rand();
			base.direction = getSourceRay((gl_FragCoord.xy + vec2(r)) / fsize, iproj, iview);
			clr += evalRaySimple(base);
		}
	} else {
		Ray dof;
		for(int i = 0; i < samples; i++) {
			float r = rand();
			base.direction = getSourceRay((vec2(gl_FragCoord) + vec2(r)) / fsize, iproj, iview);
			dof.origin = base.origin;
			dof.direction = base.direction;
			DOFRay(dof, cam_vdir, cam_rdir, aperture, focus_distance);
			clr += evalRay(dof, bounces);
		}
	}
	fragColor = vec4(clr, 1.0);
}